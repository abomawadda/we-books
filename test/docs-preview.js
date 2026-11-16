// معاينة قوالب المستندات ببيانات تجريبية: node docs-preview.js <outDir>
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const WEB = path.join(__dirname, '..', 'web'), OUT = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 900, height: 1200 } });
  await p.route('**/*', r => { const u = new URL(r.request().url()); if (u.hostname !== 'app.test') return r.abort();
    let f = u.pathname === '/' ? '/index.html' : u.pathname; if (f === '/config.js') return r.fulfill({ body: 'window.APP_CONFIG={API_URL:""}', contentType: 'text/javascript' });
    const fp = path.join(WEB, f); if (!fs.existsSync(fp)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ body: fs.readFileSync(fp), contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : 'font/woff2' }); });
  await p.goto('https://app.test/'); await p.waitForTimeout(500); await p.evaluate(() => { const s = document.getElementById('splash'); if (s) s.remove(); });
  const emp = { name: 'أحمد محمد عبد الرحمن', id: '1001', dept: 'تكنولوجيا المعلومات', mobile: '01012345678' };
  const docs = {
    invoice: `Doc.invoice(${JSON.stringify({ no: 'EINV-PH-01-1001', date: '2027-01-10', phase: 'المرحلة الأولى', status: 'Partially_Paid', method: 'INSTALLMENT', emp,
      lines: [{ code: 'P4-012', name: 'سلاح التلميذ — عربي', publisher: 'سلاح التلميذ', subject: 'لغة عربية', grade: 'الصف الرابع الابتدائي', ben: 'مريم', alloc: 2, deliv: 2, ret: 0, price: 111, cover: 135 }, { code: 'P4-020', name: 'الأضواء — رياضيات', publisher: 'الأضواء', subject: 'رياضيات', grade: 'الصف الرابع الابتدائي', ben: 'يوسف — ابن أخ', alloc: 1, deliv: 0, ret: 0, price: 123, cover: 150 }, { code: 'P4-031', name: 'المعاصر Grammar', publisher: 'المعاصر', subject: 'English', grade: 'الصف الرابع الابتدائي', ben: 'مريم', alloc: 1, deliv: 1, ret: 0, price: 140, cover: 170 }, { code: 'J2-004', name: 'الامتحان علوم', publisher: 'الامتحان', subject: 'علوم', grade: 'الصف الثاني الإعدادي', ben: 'عمر', alloc: 1, deliv: 1, ret: 0, price: 150, cover: 180 }, { code: 'J2-009', name: 'المعاصر عربي', publisher: 'المعاصر', subject: 'لغة عربية', grade: 'الصف الثاني الإعدادي', ben: 'عمر', alloc: 1, deliv: 1, ret: 0, price: 130, cover: 160 }],
      adj: -10, adjReason: 'خصم تأخير توريد', paid: 120, remaining: 225, credit: 0, down: 87,
      schedule: [{ label: 'مقدم', due: '2027-01-10', amount: 87, paid: 87, status: 'Paid' }, { label: 'قسط 1', due: '2027-02-10', amount: 129, paid: 33, status: 'Partial' }, { label: 'قسط 2', due: '2027-03-10', amount: 129, paid: 0, status: 'Scheduled' }] })})`,
    invoicelong: `Doc.invoice(${JSON.stringify({ no: 'EINV-PH-01-1002', date: '2027-01-10', phase: 'المرحلة الأولى', status: 'Unpaid', method: 'CASH', emp, paid: 0, remaining: 2400, credit: 0, down: 2400,
      lines: Array.from({ length: 20 }, (_, i) => ({ code: 'P' + (1 + i % 6) + '-0' + (10 + i), name: 'x', publisher: ['الأضواء', 'المعاصر', 'سلاح التلميذ', 'الامتحان'][i % 4], subject: ['رياضيات', 'لغة عربية', 'علوم', 'English', 'دراسات'][i % 5], grade: 'الصف ' + ['الأول', 'الرابع', 'السادس'][i % 3] + ' الابتدائي', ben: ['مريم', 'عمر', 'يوسف'][i % 3], alloc: 1, deliv: 0, ret: 0, price: 120, cover: 150 })) })})`,
    receipt: `Doc.receipt(${JSON.stringify({ no: 'RCP-2027-00012', date: '2027-01-10 11:32', emp, amount: 120, method: 'INSTAPAY', ref: 'TX99821', inv: 'EINV-PH-01-1001', net: 345, remaining: 225, collector: 'أمين الصندوق' })})`,
    po: `Doc.purchaseOrder(${JSON.stringify({ no: 'PO-PH-02-SUP-02', date: '2026-11-16', phase: 'تكملة الترم الثاني 2027', requester: { org: 'النقابة العامة بالدقهلية', platform: 'منصة حجز الكتب المخفضة', name: 'محمود العراقي', phone: '01550100025' }, supplier: { name: 'مكتبة الفتح بالفجالة', contact: 'ياسر', phone: '01001621417' },
      lines: Array.from({ length: 58 }, (_, i) => ({ code: ['P4', 'P5', 'P6', 'M1', 'M2'][i % 5] + '-0' + (10 + i), publisher: ['سلاح التلميذ', 'الأضواء', 'المعاصر', 'الامتحان', 'بيت باي بيت'][i % 5], subject: ['عربي', 'إنجليزي', 'رياضيات', 'علوم', 'دراسات', 'دين', 'ماث', 'ساينس'][i % 8], part: i % 9 === 0 ? 'بلاس' : '', grade: ['4 ابتدائي', '5 ابتدائي', '6 ابتدائي', '1 إعدادي', '2 إعدادي'][i % 5], gradeRank: i % 5, qty: 1 + (i % 3 === 0 ? 1 : 0), pop: 10 - (i % 5) * 2 })) })})`,
  };
  for (const [k, expr] of Object.entries(docs)) {
    await p.evaluate(([e, k]) => { document.querySelectorAll('.fixed').forEach(x => x.remove()); Doc.show(k, eval(e), { size: k === 'po' ? 'A4' : 'A5' }); }, [expr.replace(", {size:'A4'})", ")"), k]);
    await p.waitForTimeout(900);
    const fr = await (await p.$('iframe')).contentFrame(); await fr.evaluate(() => document.body.style.zoom = 1);
    const pgs = await fr.$$('.page'); for (let pi = 0; pi < pgs.length; pi++) await pgs[pi].screenshot({ path: path.join(OUT, 'doc-' + k + (pi ? '-' + (pi + 1) : '') + '.png') });
  }
  await b.close();
})();
