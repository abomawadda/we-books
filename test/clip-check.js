// يكتشف النصوص المقطوعة (…) أو الخارجة عن حدودها في صفحات الموظف على شاشة موبايل
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const { makeContext } = require('./sb-mock');
const { ctx } = makeContext({ now: new Date(2026, 10, 5, 9).getTime() }); ctx.__init(true);
const WEB = path.join(__dirname, '..', 'web');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: Number(process.argv[2] || 360), height: 780 } });
  await p.route('**/*', async r => { const u = new URL(r.request().url());
    if (u.hostname === 'api.test') return r.request().method() !== 'POST' ? r.fulfill({ json: {} }) : r.fulfill({ body: ctx.__doPost({ postData: { contents: r.request().postData() } }), headers: { 'content-type': 'application/json' } });
    if (u.hostname !== 'app.test') return r.abort();
    let f = u.pathname === '/' ? '/index.html' : u.pathname; if (f === '/config.js') return r.fulfill({ body: 'window.APP_CONFIG={API_URL:"https://api.test/x"}', contentType: 'text/javascript' }); if (f === '/sw.js') return r.fulfill({ status: 404, body: '' });
    const fp = path.join(WEB, f); if (!fs.existsSync(fp)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ body: fs.readFileSync(fp), contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : f.endsWith('.png') ? 'image/png' : 'font/woff2' }); });
  await p.goto('https://app.test/'); await p.waitForTimeout(600);
  await p.fill('#lgEmp', '1001'); await p.fill('#lgNat', '4512'); await p.fill('#lgMob', '01012345678'); await p.click('#fEmp button.btn-gold'); await p.waitForTimeout(900);
  let total = 0;
  for (const r of ['home', 'books', 'cart', 'orders', 'pay', 'me']) {
    await p.evaluate(h => location.hash = h, '#/e/' + r); await p.waitForTimeout(600);
    const bad = await p.evaluate(() => [...document.querySelectorAll('#app *')].filter(el => { const s = getComputedStyle(el); if (s.display === 'none' || !el.offsetParent || el.closest('svg')) return false;
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!own) return false;
      return el.scrollWidth > el.clientWidth + 2 && (s.overflow !== 'visible' || s.textOverflow === 'ellipsis' || s.whiteSpace === 'nowrap'); }).map(el => el.textContent.trim().slice(0, 50)));
    const pageOverflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (bad.length || pageOverflow) console.log(r + ':', pageOverflow ? '[الصفحة أعرض من الشاشة] ' : '', JSON.stringify(bad));
    total += bad.length + (pageOverflow ? 1 : 0);
  }
  console.log('CLIPPED:', total); await b.close();
})();
