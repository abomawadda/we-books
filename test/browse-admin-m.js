// لقطات الإدارة على الموبايل ببيانات واقعية (حجوزات وفواتير ومدفوعات وتسليم)
// node browse-admin-m.js <outDir> [routes] [width]
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const { makeContext } = require('./sb-mock');
const clock = { now: new Date(2026, 10, 5, 9).getTime() };
const at = (y, m, d, h = 9) => { clock.now = new Date(y, m - 1, d, h).getTime(); };
const { ctx } = makeContext(clock); ctx.__init(true);
const api = (a, p, t) => { const r = ctx.__api(a, p || {}, t); if (!r.success) console.log('SEED FAIL', a, r.message); return r; };
const rows = n => ctx.__DB.getAllRecords(n), S = ctx.__S;
// ---- بيانات: 5 موظفين، حجز، توريد، توزيع، سداد، تسليم
const A = api('LOGIN_ADMIN', { username: 'admin', password: 'Admin@2026' }).sessionToken;
const coord = api('LOGIN_ADMIN', { username: 'coord', password: 'Coord@2026' }).sessionToken;
const fin = api('LOGIN_ADMIN', { username: 'finance', password: 'Finance@2026' }).sessionToken;
const store = api('LOGIN_ADMIN', { username: 'store', password: 'Store@2026' }).sessionToken;
api('BULK_IMPORT_EMPLOYEES', { employeesArray: [{ Emp_ID: '1004', Full_Name: 'منى عبد الله السيد', National_ID_Last4: '7788', Mobile: '01011112222', Department: 'الشبكات' }, { Emp_ID: '1005', Full_Name: 'كريم حسن محمود', National_ID_Last4: '9900', Mobile: '01033334444', Department: 'خدمة العملاء' }] }, A);
const E = {};
[['1001', '4512', '01012345678'], ['1002', '8834', '01122334455'], ['1003', '0921', '01233445566'], ['1004', '7788', '01011112222'], ['1005', '9900', '01033334444']].forEach(([id, l4, m]) => { E[id] = api('LOGIN_EMPLOYEE', { empId: id, natIdLast4: l4, mobile: m }).sessionToken; });
api('SAVE_MY_KIDS', { kids: [{ name: 'محمد', gender: 'b', grade: '4 ابتدائي' }, { name: 'يوسف', grade: '3 ثانوي', rel: 'ابن أخت' }] }, E['1001']);
const sub = (e, items, m) => api('SUBMIT_OR_UPDATE_RESERVATION', Object.assign({ phaseId: 'PH-01', items }, m === 'I' ? { paymentMethod: 'INSTALLMENT', downPaymentType: 'PERCENTAGE', downPaymentInput: 25, installmentCount: 3 } : { paymentMethod: 'CASH' }), E[e]);
sub('1001', [{ bookId: 'BK-101', qty: 2 }, { bookId: 'BK-102', qty: 1 }, { bookId: 'BK-301', qty: 1, beneficiary: 'يوسف — ابن أخت' }], 'I');
at(2026, 11, 5, 10); sub('1002', [{ bookId: 'BK-101', qty: 2 }, { bookId: 'BK-202', qty: 1 }]);
sub('1003', [{ bookId: 'BK-202', qty: 1 }, { bookId: 'BK-201', qty: 1 }], 'I');
sub('1004', [{ bookId: 'BK-301', qty: 1 }, { bookId: 'BK-302', qty: 1 }], 'I');
sub('1005', [{ bookId: 'BK-201', qty: 1 }, { bookId: 'BK-202', qty: 1 }]);
if (!process.env.OPEN) {
at(2027, 1, 2, 9);
const po = api('GENERATE_PO_SNAPSHOT', { phaseId: 'PH-01' }, coord);
api('SUBMIT_SUPPLIER_INVOICE', { supplierId: 'SUP-01', phaseId: 'PH-01', supplierInvoiceNo: 'NOOR-1', invoiceDate: '2027-01-02', volumeDiscountPct: 5,
  items: po.snapshot.map(p => p.Book_ID === 'BK-201' ? { bookId: p.Book_ID, orderedQty: p.Net_Order_To_Supplier_Qty, receivedQty: 0, coverPrice: 150, itemDiscPct: 20, notPrinted: true } : { bookId: p.Book_ID, orderedQty: p.Net_Order_To_Supplier_Qty, receivedQty: p.Net_Order_To_Supplier_Qty, coverPrice: 0, itemDiscPct: 20 }) }, store);
api('RUN_ALLOCATION_ENGINE', { phaseId: 'PH-01' }, coord);
at(2027, 1, 7, 10);
var inv = id => rows(S.EMP_INVOICES).find(i => i.Emp_ID === id);
api('RECORD_EMPLOYEE_PAYMENT', { empInvId: inv('1001').Emp_Inv_ID, amount: inv('1001').Down_Payment_Required, paymentMethod: 'INSTAPAY', transactionRef: 'IP-50001' }, fin);
api('RECORD_EMPLOYEE_PAYMENT', { empInvId: inv('1002').Emp_Inv_ID, amount: inv('1002').Net_Final_Invoice_Amount, paymentMethod: 'CASH' }, fin);
api('RECORD_EMPLOYEE_PAYMENT', { empInvId: inv('1004').Emp_Inv_ID, amount: inv('1004').Down_Payment_Required, paymentMethod: 'WALLET', transactionRef: 'W-7001' }, fin);
['1001', '1002'].forEach(id => api('EXECUTE_BOOK_DELIVERY', { empId: id, phaseId: 'PH-01', receivedBy: 'الموظف' }, store));
}
clock.now = process.env.OPEN ? new Date(2026, 10, 6, 10).getTime() : new Date(2027, 0, 8, 10).getTime();

const WEB = path.join(__dirname, '..', 'web'), OUT = process.argv[2] || '.', W = +(process.argv[4] || 390);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: 844 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname === 'api.test') {
      if (r.request().method() !== 'POST') return r.fulfill({ status: 200, json: { success: true, jobs: {} }, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      return r.fulfill({ body: ctx.__doPost({ postData: { contents: r.request().postData() } }), headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    }
    if (u.hostname === 'app.test') {
      let f = u.pathname === '/' ? '/index.html' : u.pathname;
      if (f === '/config.js') return r.fulfill({ body: 'window.APP_CONFIG={API_URL:"https://api.test/x"}', contentType: 'text/javascript' });
      if (f === '/sw.js') return r.fulfill({ status: 404, body: '' });
      const fp = path.join(WEB, decodeURIComponent(f)); if (!fs.existsSync(fp)) return r.fulfill({ status: 404, body: '' });
      const ext = path.extname(f), ct = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' }[ext] || 'application/octet-stream';
      return r.fulfill({ body: fs.readFileSync(fp), contentType: ct });
    }
    return r.abort();
  });
  await p.goto('https://app.test/'); await p.waitForTimeout(800);
  const sg = await p.$('#spGo'); if (sg) { await sg.click({ force: true }); await p.waitForTimeout(400); }
  const adm = await p.$('[data-act="entryPick"][data-id="admin"], [data-act="loginTab"][data-id="adm"]'); if (adm) { await adm.click(); await p.waitForTimeout(400); }
  await p.fill('#lgUser', 'admin'); await p.fill('#lgPass', 'Admin@2026'); await p.click('#fAdm button.btn-gold'); await p.waitForTimeout(1000);
  if (await p.$('input[name="old"]')) { await p.fill('input[name="old"]', 'Admin@2026'); await p.fill('input[name="nw"]', 'Admin@2026x'); await p.fill('input[name="nw2"]', 'Admin@2026x'); await p.click('[data-ok]'); await p.waitForTimeout(900); }
  await p.waitForTimeout(800);
  for (const r of (process.argv[3] || 'res,collect,delivery,cash,alloc').split(process.argv[3] && process.argv[3].includes('js:') ? '|' : ',')) {
    if (r.startsWith('act:')) { const [, act, id] = r.split(':'); await p.evaluate(([a, i]) => ACTIONS[a](i), [act, id]); await p.waitForTimeout(900); await p.screenshot({ path: path.join(OUT, `am-${act}-${id}.png`), fullPage: true }); await p.evaluate(() => { while (UI._stack.length) UI.close(UI._stack[UI._stack.length - 1], true); }); continue; }
    if (r.startsWith('js:')) { const [, name, code] = r.split('~'); await p.evaluate(c => eval(c), code); await p.waitForTimeout(1800); await p.screenshot({ path: path.join(OUT, 'am-js-' + name + '.png') }); continue; }
    if (r.startsWith('rep:')) { await p.evaluate(x => { Rep.sel = x; location.hash = '#/a/dash'; setTimeout(() => location.hash = '#/a/reports', 50); }, r.slice(4)); await p.waitForTimeout(900); await p.screenshot({ path: path.join(OUT, `am-${r.replace(':', '-')}.png`), fullPage: true }); continue; }
    await p.evaluate(h => location.hash = h, '#/a/' + r); await p.waitForTimeout(700);
    await p.screenshot({ path: path.join(OUT, `am-${r.replace(/\//g, '_')}.png`), fullPage: true });
  }
  await b.close();
})();
