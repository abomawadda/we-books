// لقطات بوابة الموظف على الموبايل: node browse-emp.js <outDir> [prefix]
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const { makeContext } = require('./sb-mock');
const clock = { now: new Date(2026, 10, 5, 9).getTime() };
const { ctx } = makeContext(clock); ctx.__init(true);
const WEB = path.join(__dirname, '..', 'web'), OUT = process.argv[2] || '.', PFX = process.argv[3] || 'e';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname === 'api.test') {
      if (r.request().method() !== 'POST') return r.fulfill({ status: 200, json: {}, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      return r.fulfill({ body: ctx.__doPost({ postData: { contents: r.request().postData() } }), headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    }
    if (u.hostname === 'app.test') {
      let f = u.pathname === '/' ? '/index.html' : u.pathname;
      if (f === '/config.js') return r.fulfill({ body: 'window.APP_CONFIG={API_URL:"https://api.test/x"}', contentType: 'text/javascript' });
      if (f === '/sw.js') return r.fulfill({ status: 404, body: '' });
      const fp = path.join(WEB, f); if (!fs.existsSync(fp)) return r.fulfill({ status: 404, body: '' });
      const ct = f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : f.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream';
      return r.fulfill({ body: fs.readFileSync(fp), contentType: ct });
    }
    return r.abort();
  });
  const shot = n => p.screenshot({ path: path.join(OUT, PFX + '-' + n + '.png') });
  const go = async h => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(500); };
  await p.goto('https://app.test/'); await p.waitForTimeout(700); await shot('login');
  await p.fill('#lgEmp', '1001'); await p.fill('#lgNat', '4512'); await p.fill('#lgMob', '01012345678'); await p.click('#fEmp button.btn-gold'); await p.waitForTimeout(900);
  await shot('home0');
  await go('#/e/books'); await shot('books0');
  for (const id of ['BK-101', 'BK-201']) { const el = await p.$(`[data-act="cartInc"][data-id="${id}"]`); if (el) { await el.click(); await p.waitForTimeout(150); } }
  await shot('books1');
  const oc = await p.$('[data-act="openCart"]'); if (oc) { await oc.click(); await p.waitForTimeout(500); await shot('cart'); const sb = await p.$('[data-act="submitRes"]'); if (sb) { await sb.click(); await p.waitForTimeout(900); await shot('saved'); } }
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelectorAll('[role=dialog]').forEach(d => d.closest('.fixed') && d.closest('.fixed').remove()));
  await go('#/e/home'); await shot('home1');
  await go('#/e/orders'); await shot('orders');
  await p.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(200); await shot('orders2');
  await go('#/e/pay'); await shot('pay');
  await go('#/e/me'); await shot('me');
  await b.close();
})();
