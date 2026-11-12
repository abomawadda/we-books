// خادم محاكى للاختبارات: نفس محرك Supabase (engine.js + logic.js) فوق مخزن في الذاكرة
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createRuntime, memoryStore } = require('../supabase/functions/books-api/engine.js');

const code = fs.readFileSync(path.join(__dirname, '../supabase/functions/books-api/logic.js'), 'utf8');
const sha256 = s => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b);

function makeContext(clock) {
  class FakeDate extends Date { constructor(...a) { if (a.length === 0) super(clock.now); else super(...a); } static now() { return clock.now; } }
  const rt = createRuntime({ code, sha256, DateClass: FakeDate });
  const store = memoryStore();
  const run = (key, fn, o) => rt.runSync(store, key, fn, o);
  const api = (a, p, t) => {
    const e = t && rt.cache.get(t);
    const scope = rt.scopeFor(a, p, e ? JSON.parse(e.v) : null);
    return run(a, g => g.callServerApi(a, p || {}, t), { scope });
  };
  const ctx = {
    __S: rt.S,
    __api: api,
    __init: () => run('INIT', g => { g.seedInitialData_(); return { success: true }; }),
    __job: () => run('JOB', g => g.dailyMaintenanceJob()),
    __doPost: e => { const b = JSON.parse(e.postData.contents); return JSON.stringify(api(b.action, b.payload, b.token)); },
    __DB: {
      getAllRecords: n => run('T:' + n, g => g.DB_Engine.getAllRecords(n)),
      insertRecordsBatch: (n, a) => run('I:' + n, g => g.DB_Engine.insertRecordsBatch(n, a)),
      updateRecordByPK: (n, k, v, u) => run('U:' + n, g => g.DB_Engine.updateRecordByPK(n, k, v, u))
    }
  };
  return { ctx, ss: { getSheets: () => rt.TABLES }, store, rt };
}
module.exports = { makeContext, code, sha256 };
