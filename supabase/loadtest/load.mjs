// اختبار حمل حي: N موظف اختبار يدخلون ثم يحجزون في نفس اللحظة على المرحلة PH-LT
const U = 'https://bulfwclnhbwpzqwnxjie.supabase.co/functions/v1/books-api';
const N = +process.argv[2] || 100, OFF = +process.argv[3] || 0;
const call = async (action, payload, token) => {
  const t = Date.now();
  try { const r = await fetch(U, { method: 'POST', body: JSON.stringify({ action, payload, token }) }); const j = await r.json(); j._ms = Date.now() - t; j._st = r.status; return j; }
  catch (e) { return { success: false, message: 'NET ' + e.message, _ms: Date.now() - t }; }
};
const ids = Array.from({ length: N }, (_, i) => 'LT' + String(OFF + i + 1).padStart(4, '0'));
const stat = (name, rs) => {
  const ms = rs.map(r => r._ms).sort((a, b) => a - b), ok = rs.filter(r => r.success).length;
  const errs = {}; rs.filter(r => !r.success).forEach(r => { const k = (r.message || r._st || '?').toString().slice(0, 60); errs[k] = (errs[k] || 0) + 1; });
  console.log(`${name}: نجح ${ok}/${rs.length} | الوسيط ${ms[Math.floor(ms.length / 2)]}ms | p95 ${ms[Math.floor(ms.length * 0.95)]}ms | الأقصى ${ms[ms.length - 1]}ms`, Object.keys(errs).length ? errs : '');
};
// دخول متزامن
let t0 = Date.now();
const logins = await Promise.all(ids.map((id, i) => call('LOGIN_EMPLOYEE', { empId: id, natIdLast4: '1234', mobile: '0100' + String(OFF + i + 1).padStart(7, '0') })));
stat(`دخول ${N} متزامن (${Date.now() - t0}ms)`, logins);
const toks = logins.map(l => l.sessionToken).filter(Boolean);
// حجز متزامن في نفس اللحظة
t0 = Date.now();
const res = await Promise.all(toks.map(t => call('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-LT', items: [{ bookId: 'BK-101', qty: 1 }, { bookId: 'BK-201', qty: 1 }], paymentMethod: 'CASH' }, t)));
stat(`حجز ${toks.length} متزامن (${Date.now() - t0}ms)`, res);
// فتح البوابة متزامن (قراءة)
t0 = Date.now();
const portal = await Promise.all(toks.map(t => call('GET_EMPLOYEE_PORTAL_DATA', { phaseId: 'PH-LT' }, t)));
stat(`بوابة ${toks.length} متزامنة (${Date.now() - t0}ms)`, portal);
