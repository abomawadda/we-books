// اختبار المحمِّل: الكود من الشيت ← new Function ← doPost
const fs = require('fs'), vm = require('vm');
const { makeContext } = require('./gas-mock');
const { ctx, ss } = makeContext({ now: Date.now() });
ctx.__init(true);
const bundle = fs.readFileSync('/home/claude/books-erp/out/server.bundle.js', 'utf8');
const chunks = []; for (let i = 0; i < bundle.length; i += 40000) chunks.push([bundle.slice(i, i + 40000)]);
const mkFile = (txt, d, owner, trashed) => ({ isTrashed: () => !!trashed, getOwner: () => ({ getEmail: () => owner }), getDateCreated: () => new Date(d), getBlob: () => ({ getDataAsString: () => txt }) });
const files = [mkFile('throw new Error("old")', 1000, 'me@x'), mkFile(bundle, 5000, 'me@x'), mkFile('throw new Error("evil")', 9000, 'other@x'), mkFile('throw new Error("trash")', 9500, 'me@x', true)];
const lctx = Object.assign({}, ctx, { Session: Object.assign({}, ctx.Session, { getEffectiveUser: () => ({ getEmail: () => 'me@x' }) }),
  DriveApp: { getFilesByName: () => { let i = 0; return { hasNext: () => i < files.length, next: () => files[i++] }; } } });
vm.createContext(lctx);
vm.runInContext(fs.readFileSync('/home/claude/books-erp/loader/Code.gs', 'utf8') + ';globalThis.__lp=doPost;globalThis.__lg=doGet;', lctx);
const post = (a, p, t) => JSON.parse(lctx.__lp({ postData: { contents: JSON.stringify({ action: a, payload: p, token: t }) } }));
const r1 = post('GET_PUBLIC_INIT_DATA', {}); console.log('init:', r1.success, r1.settings && r1.settings.INITIATIVE_TITLE);
const r2 = post('LOGIN_ADMIN', { username: 'admin', password: 'Admin@2026' }); console.log('admin login:', r2.success);
const r3 = post('GET_ADMIN_DASHBOARD_DATA', {}, r2.sessionToken); console.log('dashboard books:', r3.books.length);
const r4 = post('LOGIN_EMPLOYEE', { empId: '1001', natIdLast4: '4512', mobile: '01012345678' }); console.log('emp login:', r4.success);
const d = JSON.parse(lctx.__lg({ parameter: { diag: '1' } })); console.log('diag version:', d.version);
console.log('chunks:', chunks.length, chunks.map(c => c[0].length));
if (!(r1.success && r2.success && r4.success)) process.exit(1);
console.log('LOADER OK');
