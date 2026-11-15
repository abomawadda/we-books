// فيديو إطلاق «طريقة الحجز» من بوابة الموظف على الموبايل (خادم محاكى + عيّنة من الكتالوج الحقيقي)
// node make.js <outDir> [shots]  — بـ shots يلتقط صوراً فقط للاستكشاف، وبدونها يسجّل فيديو ثم يحوّله mp4
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const { makeContext } = require('../test/sb-mock');
const clock = { now: new Date(2026, 10, 15, 10).getTime() };
const { ctx, rt, store } = makeContext(clock); ctx.__init(true);
const WEB = path.join(__dirname, '..', 'web'), OUT = path.resolve(process.argv[2] || '.'), SHOTS = process.argv[3] === 'shots';
fs.mkdirSync(OUT, { recursive: true });

// ---- بيانات العرض: عيّنة من الكتالوج الحقيقي (الصف الرابع الابتدائي والأول الإعدادي)
const BOOKS = [
  ['P4-003', 'الأضواء', 'عربي', 195, 160, 'حكومي،لغات،أزهر'], ['P4-006', 'سلاح التلميذ', 'عربي', 215, 177, 'حكومي،لغات،أزهر'], ['P4-005', 'الشاطر', 'عربي', 180, 148, 'حكومي،لغات،أزهر'],
  ['P4-011', 'المعاصر', 'إنجليزي', 189, 155, 'حكومي،لغات،أزهر'], ['P4-013', 'جيم', 'إنجليزي', 169, 139, 'حكومي،لغات،أزهر'],
  ['P4-019', 'الأضواء', 'رياضيات', 165, 136, 'حكومي،أزهر'], ['P4-022', 'سلاح التلميذ', 'رياضيات', 190, 156, 'حكومي،أزهر'],
  ['P4-027', 'الأضواء', 'علوم', 190, 156, 'حكومي،أزهر'], ['P4-035', 'الأضواء', 'دراسات', 159, 131, 'حكومي،لغات،أزهر'], ['P4-038', 'سلاح التلميذ', 'دراسات', 185, 152, 'حكومي،لغات،أزهر'],
  ['P4-051', 'الأضواء', 'دين', 139, 114, 'حكومي،لغات'], ['P4-057', 'سلاح التلميذ', 'تكنولوجيا', 140, 115, 'حكومي،أزهر'],
  ['M1-001', 'الأضواء', 'عربي', 199, 164, 'حكومي،لغات،أزهر'], ['M1-043', 'سلاح التلميذ', 'عربي', 210, 173, 'حكومي،لغات،أزهر'], ['M1-002', 'الامتحان', 'عربي', 220, 181, 'حكومي،لغات،أزهر'],
  ['M1-005', 'المعاصر', 'إنجليزي', 199, 164, 'حكومي،لغات،أزهر'], ['M1-007', 'جيم', 'إنجليزي', 199, 164, 'حكومي،لغات،أزهر'],
  ['M1-011', 'الأضواء', 'رياضيات', 169, 139, 'حكومي،أزهر'], ['M1-013', 'المعاصر', 'رياضيات', 185, 152, 'حكومي،أزهر'],
  ['M1-015', 'الأضواء', 'علوم', 185, 152, 'حكومي،أزهر'], ['M1-016', 'الامتحان', 'علوم', 199, 164, 'حكومي،أزهر'], ['M1-019', 'الأضواء', 'دراسات', 175, 144, 'حكومي،لغات،أزهر'], ['M1-020', 'الامتحان', 'دراسات', 187, 154, 'حكومي،لغات،أزهر']
];
{
  const S = ctx.__S, DB = ctx.__DB;
  const rows = BOOKS.map(([id, pub, sub, cover, emp, types]) => {
    const p4 = id.startsWith('P4');
    return { Book_ID: id, Book_Name: pub + ' — ' + sub, Stage: p4 ? 'المرحلة الابتدائية' : 'المرحلة الإعدادية', Grade: p4 ? '4 ابتدائي' : '1 إعدادي', Subject: sub, Publisher: pub, Supplier_ID: 'SUP-01',
      Cover_Price: cover, Supplier_Discount_Pct: 18, Initial_Purchase_Price: cover * 0.82, Volume_Discount_Share_Pct: 0, Standard_Net_Cost: cover * 0.82, Emp_Discount_Pct: 18, Emp_Selling_Price: emp,
      Book_Status: 'Available', School_Types: types, Book_Part: '', Cover_URL: '' };
  });
  rt.runSync(store, 'VID:books', g => { g.DB_Engine.overwriteTableData(S.BOOKS, rows); return { success: true }; }, { commitOnFailure: true });
  const ph = DB.getAllRecords(S.PHASES)[0];
  DB.updateRecordByPK(S.PHASES, 'Phase_ID', ph.Phase_ID, { Phase_Name: 'الترم الثاني 2026 – 2027' });
  const t = ctx.__api('LOGIN_EMPLOYEE', { empId: '1001', natIdLast4: '4512', mobile: '01012345678' }).sessionToken;
  const r = ctx.__api('SAVE_MY_KIDS', { kids: [{ name: 'مريم', gender: 'g', grade: '4 ابتدائي', type: 'حكومي' }, { name: 'يوسف', gender: 'b', grade: '1 إعدادي', type: 'حكومي' }] }, t);
  if (!r.success) throw new Error(r.message);
}

const CAP_CSS = `#vcap{position:fixed;left:8px;right:8px;top:6px;z-index:99999;pointer-events:none;font-family:Cairo,sans-serif;direction:rtl;transition:opacity .35s, transform .35s}
#vcap .b{background:rgba(30,12,60,.92);color:#fff;border-radius:18px;padding:12px 16px;box-shadow:0 10px 30px rgba(0,0,0,.35);border:1px solid rgba(250,204,21,.5)}
#vcap .n{display:inline-flex;width:26px;height:26px;border-radius:50%;background:#facc15;color:#2e1065;font-weight:800;align-items:center;justify-content:center;margin-left:8px;font-size:14px}
#vcap .t{font-weight:800;font-size:17px}#vcap .s{font-size:13.5px;opacity:.88;margin-top:3px;line-height:1.5}
#vtitle{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px;font-family:Cairo,sans-serif;direction:rtl;color:#fff;
background:radial-gradient(circle at 30% 20%,#7c3aed,#3b0764 60%,#1e0b3a);transition:opacity .5s}
#vtitle img{width:84px;height:84px;border-radius:22px;background:#fff;padding:8px;margin:0 6px}
#vtitle h1{font-size:30px;font-weight:800;margin:22px 0 8px;line-height:1.35}#vtitle p{font-size:17px;opacity:.9;line-height:1.7;margin:0}
#vtitle .g{color:#facc15}#vtitle .pill{margin-top:22px;background:#facc15;color:#2e1065;font-weight:800;border-radius:999px;padding:10px 22px;font-size:17px}
#vtap{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(250,204,21,.55);border:3px solid #facc15;z-index:99998;pointer-events:none;transform:scale(.3);opacity:0;transition:transform .25s,opacity .25s}`;

(async () => {
  const b = await chromium.launch();
  const vid = SHOTS ? {} : { recordVideo: { dir: OUT, size: { width: 390, height: 844 } } };
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SHOTS ? 1 : 2, hasTouch: true, isMobile: true, ...vid });
  const p = await c.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname === 'api.test') {
      if (r.request().method() !== 'POST') return r.fulfill({ status: 200, json: {}, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      await new Promise(res => setTimeout(res, 250));
      return r.fulfill({ body: ctx.__doPost({ postData: { contents: r.request().postData() } }), headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    }
    if (u.hostname === 'app.test') {
      let f = u.pathname === '/' ? '/index.html' : u.pathname;
      if (f === '/config.js') return r.fulfill({ body: 'window.APP_CONFIG={API_URL:"https://api.test/x"}', contentType: 'text/javascript' });
      if (f === '/sw.js') return r.fulfill({ status: 404, body: '' });
      const fp = path.join(WEB, decodeURIComponent(f)); if (!fs.existsSync(fp)) return r.fulfill({ status: 404, body: '' });
      const ext = path.extname(f), ct = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' }[ext] || 'application/octet-stream';
      return r.fulfill({ body: fs.readFileSync(fp), contentType: ct });
    }
    return r.abort();
  });
  let shotN = 0;
  const wait = ms => p.waitForTimeout(SHOTS ? Math.min(ms, 1500) : ms);
  const shot = async n => { if (SHOTS) await p.screenshot({ path: path.join(OUT, String(++shotN).padStart(2, '0') + '-' + n + '.png') }); };
  const inject = () => p.evaluate(css => { if (!document.getElementById('vcss')) { const s = document.createElement('style'); s.id = 'vcss'; s.textContent = css; document.head.appendChild(s); } }, CAP_CSS);
  const cap = async (n, t, s) => { await inject(); await p.evaluate(([n, t, s]) => { let e = document.getElementById('vcap'); if (!e) { e = document.createElement('div'); e.id = 'vcap'; document.body.appendChild(e); }
    e.style.opacity = 0; e.style.transform = 'translateY(10px)'; setTimeout(() => { e.innerHTML = `<div class="b"><div class="t">${n ? `<span class="n">${n}</span>` : ''}${t}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`; e.style.opacity = 1; e.style.transform = 'none'; }, 180); }, [n, t, s || '']); await wait(400); };
  const capOff = () => p.evaluate(() => { const e = document.getElementById('vcap'); if (e) e.style.opacity = 0; });
  const title = async (html, ms) => { await inject(); await p.evaluate(h => { let e = document.getElementById('vtitle'); if (!e) { e = document.createElement('div'); e.id = 'vtitle'; document.body.appendChild(e); } e.innerHTML = h; e.style.opacity = 1; }, html); await wait(ms); await p.evaluate(() => { const e = document.getElementById('vtitle'); if (e) { e.style.opacity = 0; setTimeout(() => e.remove(), 600); } }); await wait(500); };
  const tap = async sel => {
    const el = typeof sel === 'string' ? await p.$(sel) : sel; if (!el) { console.log('MISSING', sel); return false; }
    await el.scrollIntoViewIfNeeded(); await wait(250);
    const bb = await el.boundingBox();
    if (bb) await p.evaluate(([x, y]) => { let t = document.getElementById('vtap'); if (!t) { t = document.createElement('div'); t.id = 'vtap'; document.body.appendChild(t); } t.style.left = x + 'px'; t.style.top = y + 'px'; t.style.transition = 'none'; t.style.transform = 'scale(.3)'; t.style.opacity = 1; requestAnimationFrame(() => { t.style.transition = 'transform .35s, opacity .45s'; t.style.transform = 'scale(1.3)'; t.style.opacity = 0; }); }, [bb.x + bb.width / 2, bb.y + bb.height / 2]);
    await wait(220); await el.click({ force: true }); return true;
  };
  const type = async (sel, v) => { await tap(sel); for (const ch of v) { await p.type(sel, ch); await wait(70); } };
  const scroll = async (y, ms = 900) => { await p.evaluate(([y, ms]) => new Promise(res => { const s = scrollY, t0 = performance.now(); const f = t => { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, s + (y - s) * e); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); }), [y, ms]); await wait(200); };

  await p.goto('https://app.test/'); await wait(900);
  const sg = await p.$('#spGo'); if (sg) { await sg.click({ force: true }); await wait(500); }
  await title(`<div><img src="img/logo-we.png"><img src="img/logo-union.png"></div><h1>احجز كتب ولادك<br><span class="g">من موبايلك</span></h1><p>الكتب الخارجية بخصم العاملين<br>وبالتقسيط على أقساط مريحة</p><div class="pill">خطوات بسيطة 👇</div>`, 4200);
  await shot('entry');

  // 1) الدخول
  await cap(1, 'ادخل برقمك الوظيفي', 'اختار «موظف» واكتب رقمك وآخر 4 أرقام من القومي وموبايلك');
  await wait(1600);
  await tap('[data-act="entryPick"][data-id="emp"]'); await wait(700); await shot('login');
  await type('#lgEmp', '1001'); await type('#lgNat', '4512'); await type('#lgMob', '01012345678'); await wait(500);
  await tap('#fEmp button.btn-gold'); await wait(2600); await shot('home');
  await p.evaluate(() => document.querySelectorAll('.fixed [data-close]').forEach(x => x.click())); await wait(300);

  // 2) العائلة
  await cap(2, 'اختار مين هتحجزله', 'ولادك المسجلين بيظهروا جاهزين — وتقدر تضيف ابن أخ أو حفيد');
  await wait(2600); await tap('[data-act="wzStart"]'); await wait(1400);
  // 3) جهّز لي الأشهر
  await cap(3, 'جهّز لي الأشهر 🎒', 'المنصة بتختار لمريم أشهر كتاب في كل مادة لصفها');
  await wait(2200); await tap('[data-act="wzMode"][data-id="popular"]'); await wait(1600);
  await cap(3, 'غيّر أي كتاب بلمسة', 'السعر بعد خصم العاملين، وتحته السعر الأصلي');
  await scroll(260, 1500); await wait(800);
  await tap('[data-act="bagPick"][data-id="0|P4-006"]'); await wait(1300);
  await scroll(0, 700); await wait(500);
  await tap('[data-act="wzNext"]'); await wait(1500);
  // 4) سلسلة ناشر
  await cap(4, 'أو اختار سلسلة ناشر واحد 📚', 'ليوسف: كل كتب الأضواء للصف الأول الإعدادي مرة واحدة');
  await wait(2000); await tap('[data-act="wzMode"][data-id="series"]'); await wait(1400);
  await tap('[data-act="wzPub"][data-id="الأضواء"]'); await wait(2000);
  await tap('[data-act="wzNext"]'); await wait(1500);
  // 5) المراجعة
  await cap(5, 'راجع حجزك 👀', 'كل فرد لوحده بكتبه وسعره — واضغط «تعديل» لأي حد');
  await wait(1500); await scroll(500, 2500); await wait(1000);
  await tap('[data-act="wzPay"]'); await wait(1500);
  // 6) السداد
  await cap(6, 'اختار طريقة السداد 💳', 'شوف وفّرت كام — وقسّطها على شهور أو ادفع مرة واحدة');
  await wait(2800);
  await tap('[data-act="planCount"][data-id="3"]'); await wait(1600);
  await scroll(420, 1800); await wait(1600);
  // 7) التأكيد
  await cap(7, 'أكّد الحجز ✅', 'أسبقيتك بتتسجل بالثانية — وتقدر تعدّل لحد قفل الحجز');
  await wait(1600);
  await tap('[data-act="submitRes"]'); await wait(3600); await shot('done');
  await p.evaluate(() => document.querySelectorAll('.fixed [data-close]').forEach(x => x.click())); await wait(500);
  // 8) حجوزاتي ومدفوعاتي
  await p.evaluate(() => location.hash = '#/e/orders'); await wait(900);
  await cap(8, 'تابع حجزك من «حجوزاتي»', 'حالة كل كتاب، وموعد ومكان الاستلام، وكود الاستلام');
  await wait(1500); await scroll(600, 2600); await wait(1000); await scroll(0, 600);
  await p.evaluate(() => location.hash = '#/e/pay'); await wait(900);
  await cap(9, 'وادفع من «مدفوعاتي»', 'إنستاباي أو محفظة أو نقداً — والإيصال يوصلك هنا');
  await wait(2000); await scroll(500, 2400); await wait(1200);
  await capOff();
  await title(`<div><img src="img/logo-we.png"><img src="img/logo-union.png"></div><h1>الحجز مفتوح دلوقتي</h1><p>ادخل من موبايلك على<br><b class="g" dir="ltr" style="font-size:19px">we-books-rose.vercel.app</b></p><p style="margin-top:14px">أي استفسار؟ «مش قادر تدخل؟» في صفحة الدخول<br>أو كلّم مسؤول المبادرة</p><div class="pill">احجز بدري — الأسبقية بالدقيقة ⏱</div>`, 5500);
  await c.close(); await b.close();
})();
