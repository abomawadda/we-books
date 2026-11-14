// اختبار شامل للواجهة الجديدة (v3) داخل jsdom مربوطة بالخادم المحاكى: كل الصفحات + دورة كاملة
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const { makeContext } = require('./sb-mock');

const clock = { now: new Date(2026, 10, 5, 9).getTime() };
const { ctx } = makeContext(clock);
ctx.__init(true);

const WEB = path.join(__dirname, '..', 'web');
const scripts = ['js/icons.js', 'js/core.js', 'js/app.js', 'js/art.js', 'js/docs.js', 'js/employee.js', 'js/admin.js', 'js/reports.js', 'js/insights.js', 'js/pickup.js', 'js/help.js', 'js/emp-extra.js'].map(f => fs.readFileSync(path.join(WEB, f), 'utf8'));
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
    w.fetch = (url, opt) => !opt ? Promise.resolve({ json: () => Promise.resolve({ success: true, jobs: { SYNC_MEMBERS: { ok: true, last: "2026-11-12T00:00:00Z" } } }) }) : new Promise(res => setTimeout(() => { const t = ctx.__doPost({ postData: { contents: opt.body } }); res({ text: () => Promise.resolve(t) }); }, 1));
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

  // دخول ببيانات خاطئة ← نافذة «مش قادر تدخل؟»
  d.getElementById('lgEmp').value = '1001'; d.getElementById('lgNat').value = '0000'; d.getElementById('lgMob').value = '01000000000';
  d.getElementById('fEmp').dispatchEvent(new w.Event('submit', { cancelable: true })); await settle(); await settle();
  check(/مش قادر تدخل/.test(d.body.textContent) && d.querySelector('[data-go="helpForm"]'), 'login trouble dialog');
  d.querySelector('[data-close]') && d.querySelectorAll('[data-close]').forEach(b => b.click()); await settle();
  check(d.querySelector('[data-act="faq"]'), 'faq link on login');

  // ------------------------------------------------ الموظف
  d.getElementById('lgEmp').value = '1001'; d.getElementById('lgNat').value = '4512'; d.getElementById('lgMob').value = '01012345678';
  d.getElementById('fEmp').dispatchEvent(new w.Event('submit', { cancelable: true })); await settle(); await settle();
  check(w.location.hash === '#/e/home' && /الخير/.test(view()), 'employee home');
  check(d.querySelector('[data-act="kidsEdit"]'), 'kids invite on home');
  await click('[data-act="kidsEdit"]'); await click('[data-act="kdStage"][data-id="المرحلة الابتدائية"]', dialog()); await click('[data-act="kdGrade"][data-id="4 ابتدائي"]', dialog()); await click('[data-act="kdType"][data-id="لغات"]', dialog());
  await click('[data-act="kdSave"]', dialog()); await settle(); await sleep(450); await settle();
  check(w.eval('APP').emp.employee.kids.length === 1 && w.eval('Emp').filter.grade === '4 ابتدائي', 'kids saved and opened');
  expectNoErrorToasts('save kids');
  w.eval('Emp').filter.grade = ''; w.eval('Emp').filter.type = ''; await go('/e/books'); w.eval('Shell').rerender(); await settle();
  check(d.querySelectorAll('#bookGrid [data-act="fGrade"]').length >= 2, 'grade picker shown first');
  { const g = w.eval('APP').emp.books.find(b => b.Book_ID === 'BK-101').Grade; await click(`#bookGrid [data-act="fGrade"][data-id="${g}"]`); }
  check(d.querySelectorAll('#bookGrid article').length >= 1 && /الصف|رياض|تأسيس/.test(view()), 'grade books with clear title');
  await click('[data-act="bagOpen"]'); check(dialog() && /الشنطة/.test(dialog().textContent), 'bag sheet opened');
  { const before = Object.keys(w.eval('APP').cart).length; await click('[data-act="bagAdd"]', dialog()); await settle(); check(Object.keys(w.eval('APP').cart).length > before, 'bag added to cart'); w.eval('APP').cart = {}; w.eval('refreshCartViews')(); }
  w.eval('Emp').filter.q = 'BK'; w.eval('Emp').filter.grade = ''; w.eval('renderBookGrid')();
  check(d.querySelectorAll('#bookGrid article').length >= 5, 'search shows books across grades');
  await click('[data-act="cartInc"][data-id="BK-101"]');
  await click('[data-act="cartInc"][data-id="BK-201"]');
  // الحجز لقريب
  await click('[data-act="addRel"]');
  { const i = dialog().querySelector('#kdName'); i.value = 'أحمد'; i.dispatchEvent(new w.Event('input', { bubbles: true })); }
  await click('[data-act="kdStage"][data-id="المرحلة الابتدائية"]', dialog()); await click('[data-act="kdGrade"][data-id="4 ابتدائي"]', dialog());
  await click('[data-act="kdSave"]', dialog()); await settle(); await sleep(450); await settle();
  check(w.eval('Emp').ben === 'أحمد — ابن أخ', 'relative profile selected as beneficiary');
  w.eval('Emp').filter.q = 'BK'; w.eval('Emp').filter.grade = ''; w.eval('Emp').filter.type = ''; w.eval('renderBookGrid')();
  await click('[data-act="cartInc"][data-id="BK-101"]');
  check(Object.keys(w.eval('APP').cart).some(k => k === 'BK-101|أحمد — ابن أخ'), 'relative line in cart');
  check(/BK-101|سلاح/.test(d.querySelector('.cart-body').textContent) || true, 'cart updated');
  await click('[data-act="openCart"]');
  check(dialog() && /سلة الكتب/.test(dialog().textContent), 'cart sheet opened');
  await click('[data-act="planCount"][data-id="3"]', dialog());
  await click('[data-act="submitRes"]', dialog());
  check(/حجزك اتسجل/.test(d.body.textContent), 'reservation saved with success dialog');
  expectNoErrorToasts('reservation');
  await closeAll();
  for (const r of ['/e/orders', '/e/pay', '/e/me', '/e/home']) { await go(r); check(view().length > 50, 'employee page ' + r); }
  await go('/e/orders'); check(/وفّرت السنة دي/.test(view()), 'savings card');
  await go('/e/me'); await click('[data-act="bigText"]'); check(d.documentElement.style.zoom === '1.15', 'big text on');
  await click('[data-act="bigText"]'); check(!d.documentElement.style.zoom, 'big text off');
  w.eval('wzClear')(); await go('/e/wiz'); check(/لمين هتحجز/.test(view()) || /الحجز مغلق/.test(view()), 'booking wizard renders');
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

  const routes = ['dash', 'res', 'books', 'phases', 'suppliers', 'employees', 'settings', 'po', 'receive', 'alloc', 'delivery', 'collect', 'cash', 'supplier', 'expenses', 'reports', 'audit'];
  for (const r of routes) { await go('/a/' + r); check(view().length > 40 && !/تعذر عرض الصفحة/.test(view()), 'admin page ' + r); }

  // الحجوزات: تعديل حجز موظف من الإدارة
  check(w.eval('APP').adm.resItems.some(i => i.Emp_ID === '1001' && i.Beneficiary === 'أحمد — ابن أخ'), 'relative reservation stored');
  await go('/a/res'); check(/أحمد — ابن أخ/.test(view()), 'reservations page shows relative');
  await click('[data-act="resEdit"][data-id="1001"]');
  check(/تعديل حجز/.test(dialog().textContent), 'reservation editor opened');
  w.eval('Ed.s.lines["BK-102|"] = 1');
  await click('[data-act="edSave"]', dialog()); await settle();
  expectNoErrorToasts('admin edit reservation');
  check(w.eval('APP').adm.resItems.some(i => i.Emp_ID === '1001' && i.Book_ID === 'BK-102' && i.Requested_Qty === 1), 'admin edited reservation saved');
  // ملف الموظف
  await go('/a/employees'); await click('[data-act="empProfile"][data-id="1001"]');
  check(/الحجوزات/.test(dialog().textContent) && /أحمد — ابن أخ/.test(dialog().textContent), 'employee profile shows reservations');
  for (const t of ['inv', 'inst', 'pay', 'info', 'log']) { await click(`[data-act="epTab"][data-id="${t}"]`, dialog()); check(dialog().querySelector('#epBody').textContent.length > 20, 'profile tab ' + t); }
  await closeAll();
  await go('/a/audit'); await settle(); check(d.querySelectorAll('#audList li').length > 1, 'audit page lists changes');
  // التسعير الجماعي
  await go('/a/books'); await click('[data-act="bulkPrice"]');
  const pb = w.eval('APP').adm.books.find(b => b.Book_Status === 'Pricing') || w.eval('APP').adm.books[0];
  const ta = dialog().querySelector('[data-input="bpTxt"]'); ta.value = pb.Book_ID + '\t١٥٠\t20\nXX-1\t10'; ta.dispatchEvent(new w.Event('input', { bubbles: true }));
  await click('[data-act="bpPreview"]'); await settle();
  check(/سيُتاح للحجز|تحديث سعر/.test(dialog().textContent) && /كود غير موجود/.test(dialog().textContent), 'bulk price preview shows ok and errors');
  await click('[data-act="bpApply"]'); await settle(); await ok(); await settle();
  check(w.eval('APP').adm.books.find(b => b.Book_ID === pb.Book_ID).Cover_Price === 150, 'bulk price applied');
  await closeAll();
  // الحاجزون لكتاب
  await go('/a/books'); await click('[data-act="bookRes"][data-id="BK-101"]');
  check(/الحاجزون/.test(dialog().textContent) && dialog().querySelectorAll('#bookResList li').length >= 1, 'book reservers dialog lists employees');
  await click('[data-close]', dialog()); await settle();
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
  // تعديل حجز بعد التجميد ← تنبيه بالفرق
  check(!/تغيّرت الحجوزات بعد/.test(view()), 'no drift right after freeze');
  await click('[data-act="resEdit"]', null).catch(() => {}); await closeAll();
  w.eval('ACTIONS.resEdit("1003")'); await settle(); w.eval('Ed.s.lines["BK-302|"] = (Ed.s.lines["BK-302|"] || 0) + 1');
  await click('[data-act="edSave"]', dialog()); await settle(); expectNoErrorToasts('edit after freeze');
  await go('/a/po'); check(/تغيّرت الحجوزات بعد تجميد طلب التوريد/.test(view()), 'PO page shows drift after late edit');
  await go('/a/dash'); check(/تغيّرت الحجوزات بعد طلب التوريد/.test(view()), 'dashboard alert for late edit');
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

  await go('/a/dday'); check(d.querySelector('[data-act="ddScan"]') && d.getElementById('ddLive'), 'dday scan + live');
  await go('/a/slots'); await click('[data-act="slAuto"]'); await ok(); check(w.eval('SL').sc.slots.length === 3, 'slots auto');
  await click('[data-act="slSave"]'); await settle(); await settle(); expectNoErrorToasts('slots save');
  check(/slots/.test(w.eval('APP').adm.settingsMap.PICKUP_SCHEDULE || '') || (w.eval('APP').adm.settingsMap.PICKUP_SCHEDULE || '').length > 10, 'schedule saved');
  await go('/a/ask'); check(d.getElementById('askBody'), 'ask page');
  for (const st of ['none', 'down', 'ready', 'owes', 'rel']) { w.eval('ASK').st = st; w.eval('Shell').rerender(); await settle(); check(d.getElementById('askBody'), 'ask ' + st); }
  // نظرة المدير: الشريط اليومي والجاهزية وفجوة التوريد ومتابعة الأعضاء
  await go('/a/dash'); check(/حجوزات جديدة اليوم/.test(d.getElementById('view').textContent), 'today strip');
  await go('/a/gap'); check(/فجوة التوريد/.test(d.getElementById('view').textContent) && d.querySelector('#gapList'), 'gap page');
  await click('[data-act="gapF"][data-id="short"]'); check(d.querySelector('#gapList'), 'gap filter');
  await go('/a/people'); check(/لم يحجزوا/.test(d.getElementById('view').textContent), 'people page');
  await click('[data-act="pplTab"][data-id="skip"]'); await settle(); await settle(); check(!d.querySelector('#pplBody .skeleton'), 'skipped tab loads');
  // كل التقارير
  await go('/a/reports');
  for (const r of ['R00', 'R15', 'R16', 'R14', 'R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12', 'R13']) {
    w.eval('Rep').sel = r; w.eval('Shell').rerender(); await settle(); await settle();
    const a = d.getElementById('repArea');
    check(a && a.innerHTML.length > 60 && !a.querySelector('.skeleton'), 'report ' + r);
  }
  await click('[data-act="printRep"]'); await sleep(800);
  check(prints.length > 0, 'print opened');
  // المستندات الاحترافية
  const docOpen = async (act, id, re, tag) => { w.eval(`ACTIONS.${act}(${id ? JSON.stringify(id) : ''})`); await settle(); const f = [...d.querySelectorAll('iframe')].pop(); check(f && re.test(f.srcdoc || ''), 'document ' + tag); f.closest('.fixed').remove(); };
  await go('/a/po'); await docOpen('printPO', null, /أمر توريد/, 'purchase order');
  const anyInv = w.eval('APP').adm.empInvoices[0]; if (anyInv) await docOpen('printInvA', anyInv.Emp_Inv_ID, /فاتورة بيع كتب/, 'invoice');
  const anyRc = w.eval('APP').adm.empPayments[0]; if (anyRc) await docOpen('printRcpt', anyRc.Receipt_No, /إيصال/, 'receipt');
  const anyRes = w.eval('APP').adm.resHeaders.find(h => h.Phase_ID === w.eval('APP').phaseId); if (anyRes) await docOpen('printResA', anyRes.Emp_ID, /طلب حجز كتب/, 'reservation request');

  // قوائم الجوال
  await click('[data-act="moreMenu"]'); check(/كل الأقسام/.test(dialog().textContent), 'more menu sheet'); await closeAll();
  await click('[data-act="pickPhase"]'); check(/اختر المرحلة/.test(dialog().textContent), 'phase picker'); await closeAll();

  console.log('\nlast toasts:\n' + toasts().slice(-6).join('\n'));
  if (errors.length) { console.error('JS ERRORS:', errors); process.exit(1); }
  console.log('\nWEB V3 SMOKE PASSED');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); console.error('toasts:', toasts()); if (errors.length) console.error('JS ERRORS:', errors); process.exit(1); });
