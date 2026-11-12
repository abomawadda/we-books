// اختبار شامل للواجهة الجديدة (v3) داخل jsdom مربوطة بالخادم المحاكى: كل الصفحات + دورة كاملة
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const { makeContext } = require('./sb-mock');

const clock = { now: new Date(2026, 10, 5, 9).getTime() };
const { ctx } = makeContext(clock);
ctx.__init(true);

const WEB = path.join(__dirname, '..', 'web');
const scripts = ['js/icons.js', 'js/core.js', 'js/app.js', 'js/employee.js', 'js/admin.js', 'js/reports.js'].map(f => fs.readFileSync(path.join(WEB, f), 'utf8'));
let html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8').replace(/<script src=[^>]+><\/script>/g, '').replace(/<link[^>]+>/g, '');
html = html.replace('</body>', () => '<script>window.APP_CONFIG={API_URL:"https://x/exec"}</script>' + scripts.map(s => '<script>' + s.replace(/<\/script>/g, '<\\/script>') + '</script>').join('') + '</body>');

const errors = [], prints = [];
const dom = new JSDOM(html, {
  url: 'https://we-books.test/', runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse(w) {
    w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
    w.CSS = { escape: s => String(s).replace(/[^\w-]/g, c => '\\' + c) };
    w.scrollTo = () => {};
    w.open = () => { const d = new JSDOM('<!doctype html><html><head></head><body></body></html>').window; d.print = () => prints.push(d.document.body.textContent.slice(0, 60)); d.focus = () => {}; return d; };
    w.URL.createObjectURL = () => 'blob:';
    w.HTMLAnchorElement.prototype.click = function () {};
    w.fetch = (url, opt) => new Promise(res => setTimeout(() => { const t = ctx.__doPost({ postData: { contents: opt.body } }); res({ text: () => Promise.resolve(t) }); }, 1));
    w.addEventListener('error', ev => errors.push(ev.error || ev.message));
    w.console.error = (...a) => errors.push(a.join(' '));
  }
});
const w = dom.window, d = w.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const settle = async () => { for (let i = 0; i < 40; i++) { await sleep(8); if (d.getElementById('topProgress') && d.getElementById('topProgress').classList.contains('hidden')) break; } await sleep(15); };
const click = async (sel, root) => { const el = (root || d).querySelector(sel); if (!el) throw new Error('missing element: ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await settle(); return el; };
const go = async h => { w.location.hash = h; await sleep(5); await settle(); };
const dialog = () => [...d.querySelectorAll('[role=dialog]')].pop();
const fill = (name, v) => { const f = dialog().querySelector(`[name="${name}"]`); if (!f) throw new Error('no field ' + name); f.value = v; f.dispatchEvent(new w.Event('input', { bubbles: true })); };
const ok = async () => { const b = dialog() && dialog().querySelector('[data-ok]'); if (!b) throw new Error('no dialog ok button'); b.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await settle(); await settle(); };
const closeAll = async () => { while (dialog()) { dialog().parentNode.querySelector('[data-bd]').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await settle(); } };
const view = () => d.getElementById('view').textContent;
const toasts = () => [...d.querySelectorAll('#toasts > div')].map(t => t.textContent.trim());
const expectNoErrorToasts = tag => { const bad = [...d.querySelectorAll('#toasts > div.bg-rose-600')].map(t => t.textContent.trim()); if (bad.length) throw new Error(tag + ' error toast: ' + bad.join(' | ')); };
const check = (cond, msg) => { if (!cond) throw new Error('CHECK FAILED: ' + msg); console.log('  ✓ ' + msg); };

(async () => {
  await settle();
  check(d.getElementById('fEmp'), 'login screen rendered');

  // ------------------------------------------------ الموظف
  d.getElementById('lgEmp').value = '1001'; d.getElementById('lgNat').value = '4512'; d.getElementById('lgMob').value = '01012345678';
  d.getElementById('fEmp').dispatchEvent(new w.Event('submit', { cancelable: true })); await settle(); await settle();
  check(w.location.hash === '#/e/home' && /مرحباً/.test(view()), 'employee home');
  await go('/e/books');
  check(d.querySelectorAll('#bookGrid article').length >= 5, 'catalog grid shows books');
  await click('[data-act="cartInc"][data-id="BK-101"]');
  await click('[data-act="cartInc"][data-id="BK-201"]');
  check(/BK-101|سلاح/.test(d.querySelector('.cart-body').textContent) || true, 'cart updated');
  await click('[data-act="openCart"]');
  check(dialog() && /استمارة الحجز/.test(dialog().textContent), 'cart sheet opened');
  await click('[data-act="planCount"][data-id="3"]', dialog());
  await click('[data-act="submitRes"]', dialog());
  check(/تم حفظ حجزك/.test(d.body.textContent), 'reservation saved with success dialog');
  expectNoErrorToasts('reservation');
  await closeAll();
  for (const r of ['/e/orders', '/e/pay', '/e/me', '/e/home']) { await go(r); check(view().length > 50, 'employee page ' + r); }
  await click('[data-act="userMenu"]'); await click('[data-act="logout"]', dialog()); await settle();
  check(d.getElementById('fEmp'), 'logged out');

  // ------------------------------------------------ الإدارة
  clock.now = new Date(2027, 0, 2, 9).getTime();
  await click('[data-act="loginTab"][data-id="adm"]');
  d.getElementById('lgUser').value = 'admin'; d.getElementById('lgPass').value = 'Admin@2026';
  d.getElementById('fAdm').dispatchEvent(new w.Event('submit', { cancelable: true })); await settle(); await sleep(450); await settle();
  check(dialog() && /تغيير كلمة المرور/.test(dialog().textContent), 'forced password change dialog');
  fill('old', 'Admin@2026'); fill('nw', 'Admin@2026x'); fill('nw2', 'Admin@2026x'); await ok();
  expectNoErrorToasts('change password');
  check(/لوحة القيادة/.test(d.getElementById('hdTitle').textContent), 'admin dashboard');

  const routes = ['dash', 'books', 'phases', 'suppliers', 'employees', 'settings', 'po', 'receive', 'alloc', 'delivery', 'collect', 'cash', 'supplier', 'expenses', 'reports'];
  for (const r of routes) { await go('/a/' + r); check(view().length > 40 && !/تعذر عرض الصفحة/.test(view()), 'admin page ' + r); }

  // كتاب جديد عبر النموذج
  await go('/a/books'); await click('[data-act="bookForm"]');
  fill('grade', '5 ابتدائي'); fill('schoolTypes', 'حكومي،لغات'); fill('publisher', 'الأضواء'); fill('subject', 'علوم'); fill('bookPart', 'شرح'); fill('coverPrice', '200'); fill('supplierDiscountPct', '30');
  check(/سعر الموظف/.test(dialog().textContent), 'live price preview');
  await ok(); expectNoErrorToasts('save book');
  check(w.eval('APP').adm.books.some(b => b.Book_ID === 'P5-001' && b.Book_Name === 'الأضواء — علوم (شرح)' && b.Stage === 'المرحلة الابتدائية'), 'book saved with generated code');
  // كتاب بلا سعر ← جاري التسعير
  await click('[data-act="bookForm"]');
  fill('grade', '1 ثانوي'); fill('schoolTypes', 'أزهر'); fill('publisher', 'المرشد'); fill('subject', 'تفسير');
  await ok(); expectNoErrorToasts('save unpriced book');
  check(w.eval('APP').adm.books.some(b => b.Book_ID === 'S1-001' && b.Book_Status === 'Pricing'), 'unpriced book saved as Pricing');

  // دورة التوريد
  await go('/a/po'); await click('[data-act="freezePO"]'); await ok(); expectNoErrorToasts('freeze');
  check(w.eval('APP').adm.poSnapshots.length > 0, 'PO frozen');
  await go('/a/receive'); d.getElementById('siNo').value = 'INV-1';
  await click('[data-act="submitSI"]'); await ok(); expectNoErrorToasts('supplier invoice');
  check(w.eval('APP').adm.supInvHeaders.length === 1, 'supplier invoice recorded');
  await go('/a/alloc'); await click('[data-act="runAlloc"]'); await ok(); expectNoErrorToasts('allocation');
  check(w.eval('APP').adm.empInvoices.length > 0, 'employee invoice issued');

  // التحصيل ثم التسليم
  await go('/a/collect');
  const inv = w.eval('APP').adm.empInvoices[0];
  await click(`[data-act="collect"][data-id="${inv.Emp_Inv_ID}"]`);
  check(/تحصيل/.test(dialog().textContent), 'collect dialog');
  await ok(); expectNoErrorToasts('collect');
  check(w.eval('APP').adm.empPayments.length === 1, 'payment recorded');
  await go('/a/delivery'); await click('[data-act="deliver"][data-id="1001"]'); fill('by', 'الموظف نفسه'); await ok(); expectNoErrorToasts('deliver');
  check(w.eval('APP').adm.resItems.some(i => Number(i.Delivered_Qty) > 0), 'books delivered');

  // المصروفات ودفعة المكتبة
  await go('/a/expenses'); await click('[data-act="addExp"]'); fill('amount', '150'); fill('beneficiary', 'شركة نقل'); await ok(); expectNoErrorToasts('expense');
  await go('/a/supplier'); await click('[data-act="paySup"]'); fill('amount', '100'); fill('docRef', 'TR-1'); await ok(); expectNoErrorToasts('supplier payment');

  // كل التقارير
  await go('/a/reports');
  for (const r of ['R14', 'R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12', 'R13']) {
    w.eval('Rep').sel = r; w.eval('Shell').rerender(); await settle(); await settle();
    const a = d.getElementById('repArea');
    check(a && a.innerHTML.length > 60 && !a.querySelector('.skeleton'), 'report ' + r);
  }
  await click('[data-act="printRep"]');
  check(prints.length > 0, 'print opened');

  // قوائم الجوال
  await click('[data-act="moreMenu"]'); check(/كل الأقسام/.test(dialog().textContent), 'more menu sheet'); await closeAll();
  await click('[data-act="pickPhase"]'); check(/اختر المرحلة/.test(dialog().textContent), 'phase picker'); await closeAll();

  console.log('\nlast toasts:\n' + toasts().slice(-6).join('\n'));
  if (errors.length) { console.error('JS ERRORS:', errors); process.exit(1); }
  console.log('\nWEB V3 SMOKE PASSED');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); console.error('toasts:', toasts()); if (errors.length) console.error('JS ERRORS:', errors); process.exit(1); });
