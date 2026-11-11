// اختبار حمل يوم الحجز على Firestore Emulator: N موظف يحجزون في نفس اللحظة.
// التشغيل: firebase emulators:exec --only firestore --project demo-we-books "node test/load.test.js 100"
'use strict';
process.env.TZ = 'Africa/Cairo';
const assert = require('assert');
const admin = require('../functions/node_modules/firebase-admin');
const { createRuntime } = require('../functions/runtime');
const { firestoreStore } = require('../functions/store');

const N = parseInt(process.argv[2], 10) || 100;
admin.initializeApp({ projectId: 'demo-we-books' });
const db = admin.firestore();
const rt = createRuntime();
const store = firestoreStore(db, { indexed: rt.EMP_INDEXED });
const reserve = (s, p) => {
  const a = 'SUBMIT_OR_UPDATE_RESERVATION';
  return rt.run(store, a, rt.apiFn(a, p, s), { scope: rt.scopeFor(a, p, s) });
};

(async () => {
  await rt.run(store, 'INIT', g => {
    g.seedInitialData_();
    const rows = [];
    for (let i = 0; i < N; i++) rows.push({ Emp_ID: String(5000 + i), Full_Name: 'موظف ' + i, National_ID_Last4: '1111', Mobile: '0100000' + String(i).padStart(4, '0'), Employment_Status: 'ساري', Installment_Allowed: true, Max_Credit_Limit: 0 });
    g.DB_Engine.insertRecordsBatch(g.SYSTEM_CONFIG.SHEETS.EMPLOYEES, rows);
    return { success: true };
  });
  const S = rt.S;
  const sessions = Array.from({ length: N }, (_, i) => ({ userType: 'EMPLOYEE', empId: String(5000 + i), role: 'Employee', fullName: 'موظف ' + i }));
  const payload = { phaseId: 'PH-01', items: [{ bookId: 'BK-101', qty: 1 }, { bookId: 'BK-201', qty: 1 }], paymentMethod: 'CASH' };

  const t0 = Date.now();
  const lat = [];
  const res = await Promise.all(sessions.map(async s => { const t = Date.now(); const r = await reserve(s, payload); lat.push(Date.now() - t); return r; }));
  const total = Date.now() - t0;
  const bad = res.filter(r => !r.success);
  assert.strictEqual(bad.length, 0, 'فشل: ' + (bad[0] && bad[0].message));

  const items = (await db.collection(S.RES_ITEMS).get()).docs.map(d => d.data());
  const headers = (await db.collection(S.RES_HEADER).get()).size;
  assert.strictEqual(items.length, N * 2, 'عدد البنود');
  assert.strictEqual(headers, N, 'عدد الحجوزات');
  assert.strictEqual(new Set(items.map(i => i.Res_Item_ID)).size, N * 2, 'تكرار بنود');

  // تعديل متزامن لنفس الموظف مرتين: لا تضيع زيادة ولا تتكرر شريحة
  const s0 = sessions[0];
  await Promise.all([reserve(s0, { ...payload, items: [{ bookId: 'BK-101', qty: 2 }, { bookId: 'BK-201', qty: 1 }] }), reserve(s0, { ...payload, items: [{ bookId: 'BK-101', qty: 2 }, { bookId: 'BK-201', qty: 1 }] })]);
  const mine = (await db.collection(S.RES_ITEMS).where('Emp_ID', '==', s0.empId).get()).docs.map(d => d.data()).filter(i => i.Book_ID === 'BK-101');
  assert.strictEqual(mine.reduce((a, i) => a + Number(i.Requested_Qty), 0), 2, 'الكمية بعد التعديل المتزامن');

  lat.sort((a, b) => a - b);
  console.log(`${N} حجز متزامن: الإجمالي ${total}ms | الوسيط ${lat[Math.floor(N / 2)]}ms | p95 ${lat[Math.floor(N * 0.95)]}ms | الأقصى ${lat[N - 1]}ms`);
  console.log('LOAD PASSED', 'محاولات transaction:', global.__wbTries);
  process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
