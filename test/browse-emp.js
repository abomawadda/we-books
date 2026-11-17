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
    if (u.hostname === 'cdnjs.cloudflare.com') return r.continue();
    return r.abort();
  });
  const shot = n => p.screenshot({ path: path.join(OUT, PFX + '-' + n + '.png') });
  const go = async h => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(500); };
  await p.goto('https://app.test/'); await p.waitForTimeout(700);
  const sg = await p.$('#spGo'); if (sg) { await sg.click({ force: true }); await p.waitForTimeout(500); }
  await shot('login');
  await p.evaluate(() => { Shell.loginTab = 'emp'; Shell.renderLogin(); }); await p.waitForTimeout(300);
  await p.evaluate(() => { const d = document; d.getElementById('lgEmp').value = '1001'; d.getElementById('lgNat').value = '4512'; d.getElementById('lgMob').value = '01012345678'; d.getElementById('fEmp').dispatchEvent(new Event('submit', { cancelable: true })); }); await p.waitForTimeout(1500);
  await shot('home0');
  await p.evaluate(() => { try { wzMarkGuideOff(); } catch (_) {} });
  await go('#/e/books'); await shot('books0');
  if (process.env.FAMILY) {
    await p.evaluate(() => { const gs = [...new Set(APP.emp.books.map(b => b.Grade))]; APP.emp.employee.kids = [{ name: 'محمد', gender: 'b', grade: gs[0], type: '' }, { name: 'مريم', gender: 'g', grade: gs[1] || gs[0], type: '' }, { name: 'يوسف', gender: 'b', grade: gs[0], type: '', rel: 'ابن أخ' }]; Shell.rerender(); });
    await p.waitForTimeout(500); await shot('fam-books');
    await p.evaluate(() => openKid(0)); await p.waitForTimeout(500); await shot('fam-kid');
    await p.click('[data-act="bookMode"][data-id="manual"]'); await p.waitForTimeout(400); await shot('fam-manual');
    for (const el of (await p.$$('[data-act="cartInc"]')).slice(0, 4)) { await el.click(); await p.waitForTimeout(150); }
    await p.evaluate(() => scrollTo(0, 1100)); await p.waitForTimeout(400); await shot('fam-scroll');
    await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(400); await shot('fam-end');
    await p.evaluate(() => ACTIONS.famTop()); await p.waitForTimeout(500); await shot('fam-switch');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await p.evaluate(() => { scrollTo(0, 0); ACTIONS.fType(''); }); await p.waitForTimeout(500); await shot('fam-lock');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await p.evaluate(() => ACTIONS.bagOpen()); await p.waitForTimeout(500); const bp = await p.$('[data-act="bagPick"]'); if (bp) await bp.click(); await p.waitForTimeout(400); await shot('fam-bag');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await p.evaluate(() => kidsEditor(false, { kid: myKids()[0] })); await p.waitForTimeout(500); await shot('fam-kidedit');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await p.evaluate(() => ACTIONS.kidsAddNew()); await p.waitForTimeout(500); await shot('fam-kidnew');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await p.evaluate(() => Router.go('/e/wiz')); await p.waitForTimeout(600); await shot('fam-wiz');
    await p.evaluate(() => { Emp.cartStep = 'list'; Router.go('/e/cart'); }); await p.waitForTimeout(600); await shot('cart-1');
    await p.evaluate(() => ACTIONS.cartStep('pay')); await p.waitForTimeout(500); await p.evaluate(() => scrollTo(0, 0)); await shot('cart-2');
    await p.evaluate(() => ACTIONS.cartStep('confirm')); await p.waitForTimeout(500); await p.evaluate(() => scrollTo(0, 0)); await shot('cart-3');
    await p.evaluate(() => { APP.emp.employee.kids = []; Emp.filter.grade = ''; Emp.ben = ''; Emp.gsel = []; Router.go('/e/books'); }); await p.waitForTimeout(600);
    await shot('grades-page');
    await p.evaluate(() => ACTIONS.gbOpen()); await p.waitForTimeout(500); await shot('gb-1');
    await p.evaluate(() => { const b = document.querySelector('[data-act="gbStage"]'); b && b.click(); }); await p.waitForTimeout(300);
    await p.evaluate(() => { const b = document.querySelector('[data-act="gbGrade"]'); b && b.click(); }); await p.waitForTimeout(300); await shot('gb-2');
    await p.evaluate(() => { const b = document.querySelector('[data-act="gbType"]'); b && b.click(); }); await p.waitForTimeout(400); await shot('gb-3');
    await p.evaluate(() => ACTIONS.gbDone()); await p.waitForTimeout(900); await shot('gb-start');
    await b.close(); return;
  }
  for (const id of ['BK-101', 'BK-201']) { const el = await p.$(`[data-act="cartInc"][data-id="${id}"]`); if (el) { await el.click(); await p.waitForTimeout(150); } }
  await shot('books1');
  const oc = await p.$('[data-act="openCart"]'); if (oc) { await oc.click(); await p.waitForTimeout(500); await shot('cart'); const sb = await p.$('[data-act="submitRes"]'); if (sb) { await sb.click(); await p.waitForTimeout(900); await shot('saved'); } }
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelectorAll('[role=dialog]').forEach(d => d.closest('.fixed') && d.closest('.fixed').remove()));
  await go('#/e/home'); await shot('home1');
  await go('#/e/orders'); await shot('orders');
  await p.click('[data-act="printRes"]'); await p.waitForTimeout(1200); await shot('doc-res');
  const fr = await (await p.$('iframe')).contentFrame(); await fr.evaluate(() => document.body.style.zoom = 1);
  const pg = await fr.$('.page'); await pg.screenshot({ path: path.join(OUT, PFX + '-doc-res-page.png') });
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }).catch(e => null), p.click('[data-png]')]);
  console.log('PNG download:', dl ? await dl.suggestedFilename() : 'none'); if (dl) await dl.saveAs(path.join(OUT, PFX + '-doc-res-export.png'));
  await p.click('[data-x]');
  await p.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(200); await shot('orders2');
  await go('#/e/pay'); await shot('pay');
  await go('#/e/me'); await shot('me');
  await b.close();
})();
