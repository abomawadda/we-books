// يشغّل نفس test/scenarios.test.js على محرك Supabase (مخزن ذاكرة، نفس النطاق المحدود)
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRuntime, memoryStore } from './functions/books-api/engine.js';
export const sha256 = s => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b);
export const code = fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
export function makeContext(clock) {
  class FakeDate extends Date { constructor(...a) { if (a.length === 0) super(clock.now); else super(...a); } static now() { return clock.now; } }
  const rt = createRuntime({ code, sha256, DateClass: FakeDate });
  const store = memoryStore();
  const run = (key, fn, o) => rt.runSync(store, key, fn, o);
  const ctx = {
    __S: rt.S,
    __api: (a, p, t) => { const e = t && rt.cache.get(t); const scope = rt.scopeFor(a, p, e ? JSON.parse(e.v) : null); return run(a, g => g.callServerApi(a, p, t), { scope }); },
    __init: () => run('INIT', g => { g.seedInitialData_(); return { success: true }; }),
    __job: () => run('JOB', g => g.dailyMaintenanceJob()),
    __DB: {
      getAllRecords: n => run('T:' + n, g => g.DB_Engine.getAllRecords(n)),
      insertRecordsBatch: (n, a) => run('I:' + n, g => g.DB_Engine.insertRecordsBatch(n, a)),
      updateRecordByPK: (n, k, v, u) => run('U:' + n, g => g.DB_Engine.updateRecordByPK(n, k, v, u))
    }
  };
  return { ctx, ss: { getSheets: () => rt.TABLES }, store, rt };
}
