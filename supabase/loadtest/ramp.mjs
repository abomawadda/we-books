// سيناريو واقعي: N موظف يصلون بمعدل R في الثانية، كل منهم: دخول ← بوابة ← حجز
const U = 'https://bulfwclnhbwpzqwnxjie.supabase.co/functions/v1/books-api';
const N = +process.argv[2] || 300, RATE = +process.argv[3] || 5, OFF = +process.argv[4] || 0;
const call = async (action, payload, token) => { const t = Date.now();
  try { const r = await fetch(U, { method: 'POST', body: JSON.stringify({ action, payload, token }) }); const tx = await r.text(); let j; try { j = JSON.parse(tx); } catch { j = { success: false, message: 'HTTP ' + r.status }; } j._ms = Date.now() - t; return j; }
  catch (e) { return { success: false, message: 'NET', _ms: Date.now() - t }; } };
const out = { login: [], portal: [], reserve: [] };
const one = async i => {
  const n = OFF + i + 1, id = 'LT' + String(n).padStart(4, '0');
  const l = await call('LOGIN_EMPLOYEE', { empId: id, natIdLast4: '1234', mobile: '0100' + String(n).padStart(7, '0') }); out.login.push(l); if (!l.success) return;
  out.portal.push(await call('GET_EMPLOYEE_PORTAL_DATA', { phaseId: 'PH-LT' }, l.sessionToken));
  out.reserve.push(await call('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-LT', items: [{ bookId: 'BK-101', qty: 2 }, { bookId: 'BK-302', qty: 1 }], paymentMethod: 'CASH' }, l.sessionToken));
};
const t0 = Date.now(); const jobs = [];
for (let i = 0; i < N; i++) { jobs.push(one(i)); await new Promise(r => setTimeout(r, 1000 / RATE)); }
await Promise.all(jobs);
for (const [k, rs] of Object.entries(out)) {
  const ms = rs.map(r => r._ms).sort((a, b) => a - b), ok = rs.filter(r => r.success).length, e = {};
  rs.filter(r => !r.success).forEach(r => { const m = String(r.message).slice(0, 50); e[m] = (e[m] || 0) + 1; });
  console.log(`${k}: ${ok}/${rs.length} | وسيط ${ms[ms.length >> 1]}ms | p95 ${ms[Math.floor(ms.length * .95)]}ms | أقصى ${ms[ms.length - 1]}ms`, Object.keys(e).length ? e : '');
}
console.log('المدة الكلية', Math.round((Date.now() - t0) / 1000), 'ث');
