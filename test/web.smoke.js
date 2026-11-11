// اختبار دخاني للواجهة: تحميل Index.html في jsdom وربطه بالخادم المحاكى
const fs = require('fs');
const { JSDOM } = require('jsdom');
const { makeContext } = require('./gas-mock');

const clock = { now: new Date(2026, 10, 5, 9).getTime() };
const { ctx } = makeContext(clock);
ctx.__init(true);

// بيانات: حجز ثم إغلاق وتجميد وفاتورة وتوزيع
const api = (a, p, t) => ctx.__api(a, p || {}, t);
const e1 = api('LOGIN_EMPLOYEE', { empId: '1001', natIdLast4: '4512', mobile: '01012345678' }).sessionToken;
api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-101', qty: 2 }, { bookId: 'BK-301', qty: 1 }], paymentMethod: 'INSTALLMENT', downPaymentType: 'PERCENTAGE', downPaymentInput: 25, installmentCount: 2 }, e1);
const html = fs.readFileSync(__dirname + '/../web/index.html', 'utf8').replace(/<script src=[^>]+><\/script>/g, '').replace(/<link[^>]+>/g, '');
const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    w.bootstrap = { Modal: function () { return { show() {}, hide() {} }; } };
    w.bootstrap.Modal.getInstance = () => ({ hide() {} });
    w.confirm = () => true; w.prompt = (m, d) => d || 'سبب'; w.open = () => new JSDOM('<!doctype html><html><head></head><body></body></html>').window; w.open.prints = 0;
    w.URL.createObjectURL = () => 'blob:';
    w.APP_CONFIG = { API_URL: 'https://x/exec' };
    w.fetch = (url, opt) => new Promise(res => setTimeout(() => { const t = ctx.__doPost({ postData: { contents: opt.body } }); res({ text: () => Promise.resolve(t) }); }, 0));
    w.AbortController = class { constructor() { this.signal = {}; } abort() {} };
    w.__unused = { script: { run: new Proxy({}, { get(_, k) {
      const h = { ok: null, fail: null };
      const runner = {
        withSuccessHandler(f) { h.ok = f; return runner; },
        withFailureHandler(f) { h.fail = f; return runner; },
        callServerApi(a, p, t) { setTimeout(() => { try { h.ok(JSON.parse(JSON.stringify(ctx.__api(a, p, t)))); } catch (e) { errors.push(e); } }, 0); }
      };
      return runner[k];
    } }) } };
    w.addEventListener('error', ev => errors.push(ev.error || ev.message));
  }
});
const w = dom.window;
const tick = () => new Promise(r => setTimeout(r, 30));
(async () => {
  await tick();
  // دخول الموظف
  w.document.getElementById('lgEmp').value = '1001'; w.document.getElementById('lgNat').value = '4512'; w.document.getElementById('lgMob').value = '01012345678';
  await w.loginEmployee(); await tick();
  const cart = w.document.getElementById('cartBody').textContent;
  if (!cart.includes('سلاح التلميذ')) throw new Error('cart not loaded: ' + cart);
  console.log('employee cart OK, net =', w.document.getElementById('cNet').textContent);
  w.addCart('BK-201'); w.recalcPlan();
  await w.submitReservation(); await tick();
  await w.logout(); await tick();

  // دخول المدير (يُطلب تغيير كلمة المرور)
  clock.now = new Date(2027, 0, 2, 9).getTime();
  w.document.getElementById('lgUser').value = 'admin'; w.document.getElementById('lgPass').value = 'Admin@2026';
  await w.loginAdmin(); await tick();
  await w.act('GENERATE_PO_SNAPSHOT', { phaseId: 'PH-01' }); await tick();
  w.draftInvoice(); w.document.getElementById('siNo').value = 'INV-1';
  await w.submitInvoice(); await tick();
  await w.act('RUN_ALLOCATION_ENGINE', { phaseId: 'PH-01' }); await tick();
  // تحصيل المقدم ثم التسليم
  const inv = w.eval('APP').adm.empInvoices[0];
  w.document.getElementById('pm_' + inv.Emp_Inv_ID).value = 'CASH';
  await w.collect(inv.Emp_Inv_ID); await tick();
  await w.deliverAll('1001'); await tick();
  for (const r of ['R14', 'R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12', 'R13']) {
    w.document.getElementById('repSel').value = r; await w.renderReport(); await tick();
    if (!w.document.getElementById('repArea').innerHTML.length) throw new Error('empty report ' + r);
  }
  const toasts = [...w.document.querySelectorAll('#toastBox .alert')].map(a => a.className.includes('danger') ? 'ERR: ' + a.textContent : 'ok: ' + a.textContent.slice(0, 90));
  console.log(toasts.join('\n'));
  console.log('delivered:', w.eval('APP').adm.resItems.filter(i => Number(i.Delivered_Qty) > 0).length, 'items');
  if (errors.length) { console.error('JS ERRORS', errors); process.exit(1); }
  if (toasts.some(t => t.startsWith('ERR'))) process.exit(1);
  console.log('UI SMOKE PASSED');
})().catch(e => { console.error(e); process.exit(1); });
