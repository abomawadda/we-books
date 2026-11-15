// اختبار ضغط على الخادم الحي: N موظف اختبار (99000xx) يدخلون ثم يحجزون في نفس اللحظة
// node supabase/loadtest.mjs [N=300] [PHASE=PH-02]
const U = process.env.API || 'https://bulfwclnhbwpzqwnxjie.supabase.co/functions/v1/books-api';
const N = +(process.argv[2] || 300), PH = process.argv[3] || 'PH-02', RATE = +(process.argv[4] || 0); // RATE = حجوزات في الثانية (0 = كلهم في نفس اللحظة)
const sleep = ms => new Promise(r => setTimeout(r, ms));
const raw = async (action, payload, token) => { const t = Date.now(); try { const r = await (await fetch(U, { method: 'POST', signal: process.env.CLIENT ? AbortSignal.timeout(35000) : undefined, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, payload, token }) })).json(); r._ms = Date.now() - t; return r; } catch (e) { return { success: false, message: 'NET ' + e.message, _ms: Date.now() - t }; } };
// CLIENT=1: نفس سلوك التطبيق — إعادة المحاولة عند الزحمة حتى 6 مرات بانتظار متزايد (3، 6، 12، 24، 30 ث)
const busy = r => !r.success && /compute resources|idle timeout|NET |Function failed|abort|timeout/i.test(r.message || '');
const call = async (action, payload, token) => { const t = Date.now(); let r; for (let i = 0; i < (process.env.CLIENT ? 6 : 1); i++) { if (i) await new Promise(x => setTimeout(x, Math.min(30000, 3000 * 2 ** (i - 1)) * (0.5 + Math.random()))); r = await raw(action, payload, token); if (!busy(r)) break; } r._ms = Date.now() - t; return r; };
const pool = async (items, k, fn) => { const out = []; let i = 0; await Promise.all(Array.from({ length: k }, async () => { while (i < items.length) { const j = i++; out[j] = await fn(items[j], j); } })); return out; };
const stats = (rs, label) => { const ms = rs.map(r => r._ms).sort((a, b) => a - b), ok = rs.filter(r => r.success).length, q = p => ms[Math.min(ms.length - 1, Math.floor(ms.length * p))];
  const errs = {}; rs.filter(r => !r.success).forEach(r => { errs[r.message] = (errs[r.message] || 0) + 1; });
  console.log(`${label}: ${ok}/${rs.length} نجح · متوسط ${Math.round(ms.reduce((s, x) => s + x, 0) / ms.length)}ms · p50 ${q(.5)} · p90 ${q(.9)} · p99 ${q(.99)} · أقصى ${ms[ms.length - 1]}ms`);
  Object.entries(errs).forEach(([m, c]) => console.log('   ✗', c, '×', m)); return { ok, n: rs.length, p50: q(.5), p90: q(.9), max: ms[ms.length - 1] }; };
const ids = Array.from({ length: N }, (_, i) => String(9900001 + i));
const BOOKS = ['P4-003', 'P4-011', 'P4-019', 'P4-027', 'M1-001', 'M1-005', 'M1-011'];
console.log(`اختبار ضغط: ${N} موظف على ${PH}`);
const logins = await pool(ids, 50, id => call('LOGIN_EMPLOYEE', { empId: id, natIdLast4: '1234', mobile: '0109' + String(9000000 + (+id - 9900000)).padStart(7, '0') }));
stats(logins, '1) الدخول (50 متوازي)');
const tok = logins.map(r => r.sessionToken);
const portal = await Promise.all(tok.map(t => call('GET_EMPLOYEE_PORTAL_DATA', { phaseId: PH }, t)));
stats(portal, `2) فتح البوابة (${N} في نفس اللحظة)`);
const t0 = Date.now();
const res = await Promise.all(tok.map(async (t, i) => { if (RATE) await sleep(i * 1000 / RATE); return call('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: PH, items: [{ bookId: BOOKS[i % BOOKS.length], qty: 1 }, { bookId: BOOKS[(i + 3) % BOOKS.length], qty: 1 }], paymentMethod: 'CASH' }, t); }));
const s = stats(res, `3) الحجز (${N}${RATE ? ` بمعدل ${RATE}/ثانية` : ' في نفس اللحظة'})`);
console.log(`   كل الحجوزات خلصت في ${((Date.now() - t0) / 1000).toFixed(1)} ثانية`);
const edit = await Promise.all(tok.slice(0, Math.ceil(N / 3)).map((t, i) => call('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: PH, items: [{ bookId: BOOKS[i % BOOKS.length], qty: 2 }], paymentMethod: 'CASH' }, t)));
stats(edit, `4) تعديل الحجز (${edit.length} في نفس اللحظة)`);
console.log(s.ok === N ? 'LOAD TEST PASSED' : 'LOAD TEST HAD FAILURES');
