// لقطات شاشة الدخول ونافذة «مش قادر تدخل؟» والأسئلة الشائعة: node login-help.shot.js <dir>
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const { makeContext } = require('./sb-mock');
const { ctx } = makeContext({ now: Date.now() }); ctx.__init(true);
const WEB = path.join(__dirname, '..', 'web'), OUT = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname === 'api.test') return r.fulfill({ body: r.request().method() === 'POST' ? ctx.__doPost({ postData: { contents: r.request().postData() } }) : '{}', headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    if (u.hostname !== 'app.test') return r.abort();
    let f = u.pathname === '/' ? '/index.html' : u.pathname;
    if (f === '/config.js') return r.fulfill({ body: 'window.APP_CONFIG={API_URL:"https://api.test/x"}', contentType: 'text/javascript' });
    const fp = path.join(WEB, f); if (f === '/sw.js' || !fs.existsSync(fp)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ body: fs.readFileSync(fp), contentType: f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
  });
  await p.goto('https://app.test/'); await p.waitForTimeout(700);
  const sg = await p.$('#spGo'); if (sg) { await sg.click({ force: true }); await p.waitForTimeout(500); }
  await p.screenshot({ path: path.join(OUT, 'login.png') });
  await p.fill('#lgEmp', '1001'); await p.fill('#lgNat', '0000'); await p.fill('#lgMob', '01000000000'); await p.click('#fEmp button.btn-gold'); await p.waitForTimeout(900);
  await p.screenshot({ path: path.join(OUT, 'login-trouble.png') });
  await p.click('[data-go="faq"]', { force: true }); await p.waitForTimeout(1000); await p.screenshot({ path: path.join(OUT, 'faq.png') });
  await b.close();
})();
