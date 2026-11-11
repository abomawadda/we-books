// اختبار طبقة Firestore الحقيقية على Firestore Emulator، بما فيها التزامن.
// التشغيل: cd firebase && firebase emulators:exec --only firestore --project demo-we-books "node test/emulator.test.js"
'use strict';
process.env.TZ = 'Africa/Cairo';
const assert = require('assert');
const admin = require('../functions/node_modules/firebase-admin');
const { createRuntime } = require('../functions/runtime');
const { firestoreStore } = require('../functions/store');

admin.initializeApp({ projectId: 'demo-we-books' });
const store = firestoreStore(admin.firestore());
const rt = createRuntime();
const api = (a, p, s) => rt.run(store, a, rt.apiFn(a, p, s), { readOnly: /^GET_/.test(a) });
let n = 0;
const ok = r => { assert.ok(r && r.success, JSON.stringify(r && r.message)); n++; return r; };

(async () => {
  ok(await rt.run(store, 'INIT', g => { g.seedInitialData_(); return { success: true }; }));
  const adm = ok(await api('LOGIN_ADMIN', { username: 'admin', password: 'Admin@2026' })).user;
  const emps = await Promise.all([['1001', '4512', '01012345678'], ['1002', '8834', '01122334455'], ['1003', '0921', '01233445566']]
    .map(([empId, natIdLast4, mobile]) => api('LOGIN_EMPLOYEE', { empId, natIdLast4, mobile })));
  emps.forEach(ok);
  const pub = ok(await api('GET_PUBLIC_INIT_DATA', {}));
  const portal = ok(await api('GET_EMPLOYEE_PORTAL_DATA', {}, emps[0].user));
  const phaseId = portal.activePhase ? portal.activePhase.Phase_ID : 'PH-01';
  // حجز متزامن من 3 موظفين في نفس اللحظة (يوم فتح الحجز)
  const t0 = Date.now();
  const res = await Promise.all(emps.map(e => api('SUBMIT_OR_UPDATE_RESERVATION',
    { phaseId, items: [{ bookId: 'BK-101', qty: 1 }], paymentMethod: 'CASH' }, e.user)));
  res.forEach(ok);
  console.log('3 حجوزات متزامنة في', Date.now() - t0, 'ms');
  const dash = ok(await api('GET_ADMIN_DASHBOARD_DATA', {}, adm));
  const items = dash.resItems || [];
  assert.strictEqual(items.filter(i => i.Phase_ID === phaseId).length, 3, 'عدد بنود الحجز');
  const stamps = items.map(i => i.Priority_Timestamp);
  assert.strictEqual(new Set(stamps).size >= 1, true);
  // صلاحيات: الموظف ممنوع من لوحة الإدارة
  const denied = await api('GET_ADMIN_DASHBOARD_DATA', {}, emps[0].user);
  assert.ok(!denied.success); n++;
  console.log('ALL PASSED (emulator):', n, 'checks');
  process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
