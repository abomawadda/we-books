// تشغيل الواجهة في Chromium حقيقي مع الخادم المحاكى (للفحص البصري ولقطات الشاشة)
// node browse.js <outDir>
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const { makeContext } = require('./sb-mock');
const clock = { now: new Date(2027, 0, 2, 9).getTime() };
const { ctx } = makeContext(clock); ctx.__init(true);
const WEB = path.join(__dirname, '..', 'web'), OUT = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const run = async (name, vp, steps) => {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: 1 });
    p.on('pageerror', e => console.log('PAGEERR', name, e.message));
    await p.route('**/*', async r => {
      const u = new URL(r.request().url());
      if (u.hostname === 'api.test') {
        if (r.request().method() === 'GET') return r.fulfill({ json: { success: true, jobs: { SYNC_MEMBERS: { ok: true, last: '2026-11-12T00:00:00Z' }, DAILY_JOB: { ok: true, last: '2026-11-12T00:00:00Z' }, SNAPSHOT: { ok: false, last: null } } }, headers: { 'access-control-allow-origin': '*' } });
        if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
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
    await p.goto('https://app.test/'); await p.waitForTimeout(600);
    await steps(p);
    await p.close();
  };
  const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + '.png') });
  const adminLogin = async p => {
    await p.click('[data-act="loginTab"][data-id="adm"]');
    await p.fill('#lgUser', 'admin'); await p.fill('#lgPass', global.pw || 'Admin@2026'); await p.click('#fAdm button.btn-gold'); await p.waitForTimeout(900); global.pw = 'Admin@2026x';
    if (await p.$('input[name="old"]')) { await p.fill('input[name="old"]', 'Admin@2026'); await p.fill('input[name="nw"]', 'Admin@2026x'); await p.fill('input[name="nw2"]', 'Admin@2026x'); await p.click('[data-ok]'); await p.waitForTimeout(700); }
  };
  await run('login-desktop', { width: 1366, height: 768 }, async p => { await shot(p, 'login-desktop'); });
  await run('login-mobile', { width: 390, height: 844 }, async p => { await shot(p, 'login-mobile'); });
  for (const vp of [{ width: 1366, height: 768, n: 'd' }, { width: 1280, height: 680, n: 's' }, { width: 390, height: 844, n: 'm' }]) {
    await run('admin-' + vp.n, vp, async p => {
      await adminLogin(p);
      for (const r of (process.argv[3] || 'dash,res,books,collect').split(',')) { await p.evaluate(h => location.hash = h, '#/a/' + r); await p.waitForTimeout(500); await shot(p, `a-${vp.n}-${r}`); }
      if (vp.n === 'd' || vp.n === 'm') {
        await p.evaluate(() => location.hash = '#/a/books'); await p.waitForTimeout(500); await p.click('[data-act="bulkPrice"]'); await p.waitForTimeout(400);
        const code = await p.evaluate(() => APP.adm.books[0].Book_ID);
        await p.fill('[data-input="bpTxt"]', code + '\t150\t25\nXX-1\t10'); await p.click('[data-act="bpPreview"]'); await p.waitForTimeout(700); await shot(p, 'a-' + vp.n + '-bulkprice');
        await p.evaluate(() => document.querySelectorAll('[role=dialog]').forEach(d => d.closest('.fixed') && d.closest('.fixed').remove()));
      }
      if (vp.n === 'd') {
        await p.evaluate(() => location.hash = '#/a/res'); await p.waitForTimeout(400);
        await p.click('[data-act="resNew"]'); await p.waitForTimeout(300); await p.fill('[data-input="qPickEmp"]', '100'); await p.waitForTimeout(300); await shot(p, 'a-d-pick');
        await p.click('[data-act="resPick"]'); await p.waitForTimeout(500);
        await p.fill('[data-input="edQ"]', 'المعاصر'); await p.waitForTimeout(300); await p.click('[data-act="edInc"]'); await p.waitForTimeout(200); await shot(p, 'a-d-editor');
        await p.click('[data-act="edSave"]'); await p.waitForTimeout(800); await shot(p, 'a-d-res-after');
        await p.click('#resList [data-act="empProfile"]'); await p.waitForTimeout(400); await shot(p, 'a-d-profile');
        await p.click('[data-act="epTab"][data-id="info"]'); await p.waitForTimeout(200); await shot(p, 'a-d-profile-info');
        await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelectorAll('[role=dialog]').forEach(d => d.closest('.fixed') && d.closest('.fixed').remove()));
        await p.evaluate(() => location.hash = '#/a/audit'); await p.waitForTimeout(700); await p.click('[data-act="audDays"][data-id="0"]'); await p.waitForTimeout(700);
        const it = await p.$('[data-act="audOpen"]'); if (it) { await it.click(); await p.waitForTimeout(200); } await shot(p, 'a-d-audit');
        const btn = null; if (btn) { await btn.click(); await p.waitForTimeout(400); await p.fill('[data-input="edQ"]', 'المعاصر'); await p.waitForTimeout(400); await shot(p, 'a-d-editor'); }
        const sn = await p.evaluate(() => { const n = document.querySelector('.side-nav'); return n ? [n.scrollHeight, n.clientHeight] : null; }); console.log('sidenav scroll/client', JSON.stringify(sn));
      }
      if (vp.n === 's') { const sn = await p.evaluate(() => { const n = document.querySelector('.side-nav'); return [n.scrollHeight, n.clientHeight]; }); console.log('short sidenav', JSON.stringify(sn)); }
    });
  }
  await b.close();
})();
