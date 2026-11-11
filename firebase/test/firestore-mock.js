// بديل gas-mock: يشغّل نفس scenarios.test.js على طبقة Firestore الجديدة (مخزن ذاكرة متزامن)
// الاستخدام: SCENARIO_MOCK=../firebase/test/firestore-mock node test/scenarios.test.js
const { createRuntime, memoryStore } = require('../functions/runtime');

function makeContext(clock) {
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(clock.now); else super(...a); }
    static now() { return clock.now; }
  }
  const rt = createRuntime({ DateClass: FakeDate });
  const store = memoryStore();
  const run = (key, fn) => rt.runSync(store, key, fn, { commitOnFailure: process.env.COMMIT_ON_FAILURE === '1' });
  const ctx = {
    __S: rt.S,
    __api: (a, p, t) => {
      // نفس النطاق المحدود المستخدم في الإنتاج (الجلسة من ذاكرة الجلسات)
      const e = t && rt.cache.get(t);
      const scope = rt.scopeFor(a, p, e ? JSON.parse(e.v) : null);
      return rt.runSync(store, a, g => g.callServerApi(a, p, t), { commitOnFailure: process.env.COMMIT_ON_FAILURE === '1', scope });
    },
    __init: () => run('INIT', g => { g.seedInitialData_(); return { success: true }; }),
    __job: () => run('JOB', g => g.dailyMaintenanceJob()),
    __DB: {
      getAllRecords: n => run('T:' + n, g => g.DB_Engine.getAllRecords(n)),
      insertRecordsBatch: (n, a) => run('I:' + n, g => g.DB_Engine.insertRecordsBatch(n, a)),
      updateRecordByPK: (n, k, v, u) => run('U:' + n, g => g.DB_Engine.updateRecordByPK(n, k, v, u))
    }
  };
  const ss = { getSheets: () => rt.TABLES };
  return { ctx, ss, store, rt };
}
module.exports = { makeContext };
