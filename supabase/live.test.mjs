// اختبار حي على خادم Supabase: دخول، بوابة الموظف، حجز متزامن، لوحة الإدارة، الصلاحيات
const U = process.env.API || 'https://bulfwclnhbwpzqwnxjie.supabase.co/functions/v1/books-api';
const call = async (action, payload, token) => { const t = Date.now(); const r = await (await fetch(U, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, payload, token }) })).json(); r._ms = Date.now() - t; return r; };
const ok = (r, l) => { if (!r.success) { console.error('FAIL', l, r.message); process.exit(1); } console.log('✓', l, r._ms + 'ms'); return r; };
const emps = [['1001', '4512', '01012345678'], ['1002', '8834', '01122334455'], ['1003', '0921', '01233445566']];
const tok = [];
for (const [empId, natIdLast4, mobile] of emps) tok.push(ok(await call('LOGIN_EMPLOYEE', { empId, natIdLast4, mobile }), 'دخول موظف ' + empId).sessionToken);
const portal = ok(await call('GET_EMPLOYEE_PORTAL_DATA', {}, tok[0]), 'بوابة الموظف');
const phaseId = portal.activePhase.Phase_ID;
const t0 = Date.now();
const res = await Promise.all(tok.map(t => call('SUBMIT_OR_UPDATE_RESERVATION', { phaseId, items: [{ bookId: 'BK-101', qty: 1 }], paymentMethod: 'CASH' }, t)));
res.forEach((r, i) => ok(r, 'حجز متزامن ' + emps[i][0]));
console.log('  3 حجوزات متزامنة في', Date.now() - t0, 'ms');
const bad = await call('GET_ADMIN_DASHBOARD_DATA', {}, tok[0]); if (bad.success) { console.error('FAIL الموظف دخل لوحة الإدارة'); process.exit(1); } console.log('✓ منع الموظف من لوحة الإدارة');
const forged = await call('GET_EMPLOYEE_PORTAL_DATA', {}, tok[0].slice(0, -3) + 'abc'); if (forged.success) { console.error('FAIL رمز مزوّر قُبل'); process.exit(1); } console.log('✓ رفض رمز مزوّر');
const adm = ok(await call('LOGIN_ADMIN', { username: 'admin', password: process.env.ADMIN_PASS || 'Admin@2026' }), 'دخول الإدارة');
const dash = ok(await call('GET_ADMIN_DASHBOARD_DATA', {}, adm.sessionToken), 'لوحة الإدارة');
console.log('  بنود الحجز:', dash.resItems.filter(i => i.Phase_ID === phaseId).length);
console.log('ALL LIVE CHECKS PASSED');
