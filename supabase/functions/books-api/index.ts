// خادم مبادرة الكتب على Supabase Edge Functions:
// POST {action, payload, token} ← JSON. منطق العمل في logic.js ويشغّله engine.js.
import postgres from 'npm:postgres@3.4.5';
import { createHash, createHmac, createSign, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createRuntime } from './engine.js';

// الاتصال بقاعدة البيانات عبر مجمّع الاتصالات (Supavisor، وضع transaction، المنفذ 6543): يوم الحجز تعمل نسخ
// كثيرة من الخادم معاً، والاتصال المباشر محدود بـ 60 فلا يُستخدم إلا إن تعذّر بناء عنوان المجمّع.
const DIRECT = Deno.env.get('SUPABASE_DB_URL')!;
const POOLER_HOST = 'aws-0-eu-central-1.pooler.supabase.com';
let sql: any, dbMode = 'direct';
try {
  const u = new URL(DIRECT);
  const ref = (u.hostname.match(/^db\.([a-z0-9]+)\./) || [])[1] || (u.username.split('.')[1] || '');
  if (!ref) throw new Error('no ref');
  sql = postgres(`postgres://postgres.${ref}:${encodeURIComponent(decodeURIComponent(u.password))}@${POOLER_HOST}:6543/postgres`,
    { max: 3, prepare: false, idle_timeout: 10, connect_timeout: 15 });
  dbMode = 'pooler';
} catch (_) { sql = postgres(DIRECT, { max: 2, prepare: false, idle_timeout: 10, connect_timeout: 10 }); }
const ready = Promise.resolve();
const sha256 = (s: string) => Array.from(createHash('sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b);
// منطق العمل = supabase/functions/books-api/logic.js من GitHub مثبَّتاً على commit محدد (لا يتغير محتواه أبداً).
// لتحديث المنطق: غيّر CODE_COMMIT إلى commit أحدث ثم أعد نشر الدالة.
const CODE_COMMIT = 'a0ddaa00904903797ea38c60e1f6f22af21275da';
const CODE_URL = `https://raw.githubusercontent.com/abomawadda/we-books/${CODE_COMMIT}/supabase/functions/books-api/logic.js`;
let rtP: Promise<any> | null = null;
// يُقرأ أولاً من books.logic؛ وإن لم يوجد يُجلب من GitHub مرة واحدة ويُحفظ هناك (لا اعتماد على GitHub بعدها)
async function loadLogic() {
  const [row] = await sql`select code from books.logic where commit_sha = ${CODE_COMMIT}`;
  if (row) return row.code;
  const r = await fetch(CODE_URL); if (!r.ok) throw new Error('logic.js ' + r.status);
  const code = await r.text();
  await sql`insert into books.logic (commit_sha, code) values (${CODE_COMMIT}, ${code}) on conflict do nothing`;
  return code;
}
const runtime = () => (rtP ||= loadLogic().then(code => createRuntime({ code, sha256 })).catch(e => { rtP = null; throw e; }));

// ---------------- المخزن: Postgres مع أقفال استشارية بدل إعادة المحاولة ----------------
// عمليات الموظف المحدودة (الحجز): قفل مشترك عام + قفل حصري للموظف ← حجوزات الموظفين تتوازى.
// باقي عمليات الكتابة: قفل حصري عام ← تسلسل كامل. القراءة: لقطة ثابتة بلا أقفال.
const GLOBAL = 7001;
const store = {
  transact(fn: any, { readOnly = false, scope = null }: any = {}) {
    return sql.begin(readOnly ? 'isolation level repeatable read read only' : 'read write', async (tx: any) => {
      if (!readOnly) {
        if (scope) {
          await tx`select pg_advisory_xact_lock_shared(${GLOBAL})`;
          await tx`select pg_advisory_xact_lock(hashtext(${'emp:' + scope.empId}))`;
        } else await tx`select pg_advisory_xact_lock(${GLOBAL})`;
      }
      return fn({
        // كل الجداول المطلوبة في استعلامين فقط (العامة + صفوف الموظف) بدل استعلام لكل جدول
        loadMany: async (reqs: { tbl: string, emp: string | null }[]) => {
          const all = reqs.filter(r => !r.emp).map(r => r.tbl);
          const mine = reqs.filter(r => r.emp).map(r => r.tbl);
          const emp = reqs.find(r => r.emp)?.emp;
          const [a, b] = await Promise.all([
            all.length ? tx`select tbl, id, ord, data from books.records where tbl = any(${all}) order by ord` : [],
            mine.length ? tx`select tbl, id, ord, data from books.records where tbl = any(${mine}) and emp_id = ${emp} order by ord` : []
          ]);
          const by: Record<string, any[]> = {};
          reqs.forEach(r => { by[r.tbl] = []; });
          for (const r of [...a, ...b]) by[r.tbl].push({ id: r.id, ord: Number(r.ord), data: r.data });
          return reqs.map(r => by[r.tbl]);
        },
        load: async (tbl: string, emp: string | null) => (emp
          ? await tx`select id, ord, data from books.records where tbl = ${tbl} and emp_id = ${emp} order by ord`
          : await tx`select id, ord, data from books.records where tbl = ${tbl} order by ord`
        ).map((r: any) => ({ id: r.id, ord: Number(r.ord), data: r.data })),
        commit: async (writes: any[]) => {
          const ups = writes.filter(w => !w.del).map(w => ({ tbl: w.table, id: w.id, ord: w.ord, emp_id: w.data.Emp_ID ? String(w.data.Emp_ID) : null, data: w.data }));
          const dels = writes.filter(w => w.del).map(w => ({ tbl: w.table, id: w.id }));
          if (dels.length) await tx`delete from books.records r using jsonb_to_recordset(${tx.json(dels)}) as x(tbl text, id text) where r.tbl = x.tbl and r.id = x.id`;
          for (let i = 0; i < ups.length; i += 500) {
            await tx`insert into books.records (tbl, id, ord, emp_id, data)
              select tbl, id, ord, emp_id, data from jsonb_to_recordset(${tx.json(ups.slice(i, i + 500))}) as x(tbl text, id text, ord bigint, emp_id text, data jsonb)
              on conflict (tbl, id) do update set ord = excluded.ord, emp_id = excluded.emp_id, data = excluded.data`;
          }
        }
      });
    });
  }
};

// ---------------- الجلسات: رمز موقّع HMAC (المفتاح في books.config) ----------------
let secretP: Promise<string> | null = null;
const secret = () => (secretP ||= sql`select value from books.config where key = 'session_secret'`.then((r: any) => r[0].value));
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
const unb64 = (s: string) => Buffer.from(s, 'base64url').toString('utf8');
const sign = async (body: string) => createHmac('sha256', await secret()).update(body).digest('base64url');
async function issue(user: any) {
  const ttl = user.userType === 'ADMIN' ? 12 * 3600 : 180 * 24 * 3600; // الموظف تبقى جلسته على الجهاز
  const body = b64(JSON.stringify({ s: user, exp: Math.floor(Date.now() / 1000) + ttl }));
  return body + '.' + await sign(body);
}
async function verify(token: string) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const good = Buffer.from(await sign(body)), got = Buffer.from(sig);
  if (good.length !== got.length || !timingSafeEqual(good, got)) return null;
  const t = JSON.parse(unb64(body));
  if (!(t.exp > Date.now() / 1000)) return null;
  // حساب الإدارة الموقوف تسقط جلسته فوراً (لا ينتظر انتهاء الـ 12 ساعة)
  if (t.s && t.s.userType === 'ADMIN') {
    const [u] = await sql`select data->>'Is_Active' as a, data->>'Role' as r from books.records where tbl = '02_Users_Roles' and data->>'User_ID' = ${String(t.s.userId)} limit 1`;
    if (!u || String(u.a).toLowerCase() !== 'true' || u.r !== t.s.role) return null;
  }
  return t.s;
}

// ---------------- حدّ محاولات الدخول الخاطئة (في قاعدة البيانات) ----------------
const MAX_FAILS = 5, LOCK_MIN = 15;
const LOCKED = { success: false, message: 'تم إيقاف الدخول مؤقتاً بسبب تكرار المحاولات الخاطئة. حاول بعد 15 دقيقة.' };
const failKey = (action: string, p: any) => action === 'LOGIN_ADMIN'
  ? 'ADM:' + String(p?.username || '').trim().toLowerCase() : 'EMP:' + String(p?.empId || '').trim();
async function isLocked(k: string) {
  const [r] = await sql`select locked_until from books.auth_fails where k = ${k}`;
  return !!(r && r.locked_until && new Date(r.locked_until) > new Date());
}
async function registerFail(k: string) {
  await sql`insert into books.auth_fails as f (k, fails, updated_at) values (${k}, 1, now())
    on conflict (k) do update set
      fails = case when f.updated_at < now() - interval '15 minutes' then 1 else f.fails + 1 end,
      locked_until = case when (case when f.updated_at < now() - interval '15 minutes' then 1 else f.fails + 1 end) >= ${MAX_FAILS}
                          then now() + make_interval(mins => ${LOCK_MIN}) else f.locked_until end,
      updated_at = now()`;
}
const clearFails = (k: string) => sql`update books.auth_fails set fails = 0, locked_until = null, updated_at = now() where k = ${k}`;

// ---------------- أعضاء MyNekaba (Firestore: nekaba2026/employees) — قراءة فقط ----------------
// يحتاج سر NEKABA_SA_JSON = مفتاح حساب خدمة بصلاحية قراءة Firestore فقط (Cloud Datastore Viewer).
async function googleToken(sa: any) {
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: any) => b64(JSON.stringify(o));
  const unsigned = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig }) });
  const j = await r.json(); if (!j.access_token) throw new Error('Google token: ' + (j.error_description || j.error));
  return j.access_token;
}
const FIELDS = ['jobId', 'nationalId', 'name', 'phone', 'workplace', 'jobTitle', 'memberState'];
const fval = (v: any) => v == null ? '' : (v.stringValue ?? v.integerValue ?? v.doubleValue ?? (v.booleanValue != null ? String(v.booleanValue) : ''));
async function fetchMembers() {
  const raw = Deno.env.get('NEKABA_SA_JSON');
  if (!raw) throw new Error('لم يُضبط مفتاح قراءة MyNekaba (NEKABA_SA_JSON).');
  const sa = JSON.parse(raw);
  const tok = await googleToken(sa);
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/employees`;
  const mask = FIELDS.map(f => 'mask.fieldPaths=' + f).join('&');
  const out: any[] = [];
  let page = '';
  do {
    const r = await fetch(`${base}?pageSize=300&${mask}${page ? '&pageToken=' + encodeURIComponent(page) : ''}`, { headers: { Authorization: 'Bearer ' + tok } });
    const j = await r.json(); if (!r.ok) throw new Error('Firestore: ' + (j.error?.message || r.status));
    for (const d of j.documents || []) { const o: any = {}; FIELDS.forEach(f => { o[f] = String(fval(d.fields?.[f])); }); out.push(o); }
    page = j.nextPageToken || '';
  } while (page);
  return out;
}
async function syncMembers() {
  const members = await fetchMembers();
  const [r] = await sql`select * from books.sync_employees_from_json(${sql.json(members)})`;
  const [d] = await sql`select books.remove_demo_employees() as removed`;
  return { success: true, message: `مزامنة MyNekaba: ${members.length} عضو — أُضيف ${r.added}، حُدِّث ${r.updated}، تُجوِّز ${r.skipped} (بيانات ناقصة)، أُزيل ${d.removed} تجريبي.`,
    total: members.length, added: r.added, updated: r.updated, skipped: r.skipped, demoRemoved: d.removed };
}

const READ_ONLY = new Set(['GET_PUBLIC_INIT_DATA', 'GET_EMPLOYEE_PORTAL_DATA', 'GET_ADMIN_DASHBOARD_DATA', 'GET_SETTLEMENT_REPORT', 'LOGIN_EMPLOYEE']);
const EXPIRED = { success: false, message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى.' };
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info' };
const reply = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

async function handle(action: string, payload: any, token: string) {
  const rt = await runtime();
  if (action === 'LOGOUT') return { success: true };
  // المهمة اليومية (pg_cron): محمية بمفتاح في books.config لا يعرفه إلا قاعدة البيانات
  if (action === 'DAILY_JOB') {
    const k = await sql`select value from books.config where key = 'cron_key'`;
    if (!k.length || !payload || typeof payload.key !== 'string' || payload.key !== k[0].value) return { success: false, message: 'غير مصرح.' };
    await rt.run(store, 'DAILY_JOB', (g: any) => { g.dailyMaintenanceJob(); return { success: true }; });
    return { success: true, message: 'تم تنفيذ المهمة اليومية.' };
  }
  // مزامنة الأعضاء: من الجدولة الليلية (مفتاح cron) أو يدوياً من حساب Admin
  if (action === 'SYNC_MEMBERS') {
    const k = await sql`select value from books.config where key = 'cron_key'`;
    const byCron = k.length && payload && typeof payload.key === 'string' && payload.key === k[0].value;
    const s: any = byCron ? null : await verify(token);
    if (!byCron && !(s && s.userType === 'ADMIN' && s.role === 'Admin')) return { success: false, message: 'هذه العملية لمدير المنظومة فقط.' };
    return await syncMembers();
  }
  if (action === 'LOGIN_EMPLOYEE' || action === 'LOGIN_ADMIN') {
    const fk = failKey(action, payload);
    if (await isLocked(fk)) return LOCKED;
    const res = await rt.run(store, action, rt.apiFn(action, payload, null), { readOnly: READ_ONLY.has(action) });
    if (res && res.success) { await clearFails(fk); res.sessionToken = await issue(res.user); }
    else if (res && /غير مطابقة|غير صحيحة/.test(res.message || '')) await registerFail(fk);
    return res;
  }
  let session = null;
  if (action !== 'GET_PUBLIC_INIT_DATA') { session = await verify(token); if (!session) return EXPIRED; }
  return await rt.run(store, action, rt.apiFn(action, payload, session), { readOnly: READ_ONLY.has(action), scope: rt.scopeFor(action, payload, session) });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  await ready;
  if (req.method !== 'POST') return reply({ success: true, service: 'we-books', version: (await runtime()).E.SYSTEM_CONFIG.VERSION, db: dbMode });
  let body: any;
  try { body = JSON.parse(await req.text()); } catch { return reply({ success: false, message: 'طلب غير صالح.' }, 400); }
  if (!body || typeof body.action !== 'string') return reply({ success: false, message: 'طلب غير صالح.' }, 400);
  // عند امتلاء اتصالات قاعدة البيانات لحظياً (53300) تُعاد المحاولة بانتظار متزايد — آمن لأنها أخطاء فتح اتصال، فلم يبدأ شيء ولم يُكتب شيء
  // 57014 = انتهت مهلة انتظار القفل (أُلغيت الـ transaction كاملة فلا شيء كُتب)
  const busy = (e: any) => e && (['53300', '57P03', '57014', '40001', '40P01'].includes(e.code) || /too many clients|connection slots|max client|CONNECT_TIMEOUT/i.test(String(e.message || e.code)));
  try {
    for (let i = 0; ; i++) {
      try { return reply(await handle(body.action, body.payload || {}, body.token)); }
      catch (e) { if (!busy(e) || i >= 8) throw e; await new Promise(r => setTimeout(r, Math.min(4000, 150 * 2 ** i) * (0.5 + Math.random()))); }
    }
  }
  catch (err) { console.error(body.action, err); return reply({ success: false, message: 'حدث خطأ في الخادم أثناء تنفيذ العملية. حاول مرة أخرى.' }); }
});
