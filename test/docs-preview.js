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
    po: `Doc.purchaseOrder(${JSON.stringify({ no: 'PO-PH-01-SUP-01', date: '2027-01-02', phase: 'المرحلة الأولى', by: 'مسؤول المبادرة', supplier: { name: 'مكتبة النور', contact: 'أ. محمود', phone: '01000000000', terms: '30 يوماً', returnDays: 14 },
      lines: Array.from({ length: 14 }, (_, i) => ({ code: 'P' + (1 + i % 6) + '-0' + (10 + i), name: ['سلاح التلميذ — عربي', 'الأضواء — رياضيات', 'المعاصر — إنجليزي', 'الامتحان — علوم'][i % 4], grade: (1 + i % 6) + ' ابتدائي', publisher: ['سلاح التلميذ', 'الأضواء', 'المعاصر', 'الامتحان'][i % 4], qty: 5 + i * 3, cover: 120 + i * 5, disc: 25, cost: 90 + i * 4 })) })}, {size:'A4'})`
  };
  for (const [k, expr] of Object.entries(docs)) {
    await p.evaluate(([e, k]) => { document.querySelectorAll('.fixed').forEach(x => x.remove()); Doc.show(k, eval(e), { size: k === 'po' ? 'A4' : 'A5' }); }, [expr.replace(", {size:'A4'})", ")"), k]);
    await p.waitForTimeout(900);
    const fr = await (await p.$('iframe')).contentFrame(); await fr.evaluate(() => document.body.style.zoom = 1);
    await (await fr.$('.page')).screenshot({ path: path.join(OUT, 'doc-' + k + '.png') });
  }
  await b.close();
})();
