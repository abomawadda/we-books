// خادم مبادرة الكتب على Supabase Edge Functions:
// POST {action, payload, token} ← JSON. منطق العمل في logic.js ويشغّله engine.js.
import postgres from 'npm:postgres@3.4.5';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createRuntime } from './engine.js';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 8, prepare: false, idle_timeout: 20 });
const sha256 = (s: string) => Array.from(createHash('sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b);
// منطق العمل = supabase/functions/books-api/logic.js من GitHub مثبَّتاً على commit محدد (لا يتغير محتواه أبداً).
// لتحديث المنطق: غيّر CODE_COMMIT إلى commit أحدث ثم أعد نشر الدالة.
const CODE_COMMIT = '512f1608e595910e28893e73eec90f252a7b7602';
const CODE_URL = `https://raw.githubusercontent.com/abomawadda/we-books/${CODE_COMMIT}/apps-script/Code.gs`;
let rtP: Promise<any> | null = null;
const runtime = () => (rtP ||= fetch(CODE_URL).then(r => { if (!r.ok) throw new Error('Code.gs ' + r.status); return r.text(); })
  .then(code => createRuntime({ code, sha256 })).catch(e => { rtP = null; throw e; }));

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
  return t.exp > Date.now() / 1000 ? t.s : null;
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
  if (action === 'LOGIN_EMPLOYEE' || action === 'LOGIN_ADMIN') {
    const res = await rt.run(store, action, rt.apiFn(action, payload, null), { readOnly: READ_ONLY.has(action) });
    if (res && res.success) res.sessionToken = await issue(res.user);
    return res;
  }
  let session = null;
  if (action !== 'GET_PUBLIC_INIT_DATA') { session = await verify(token); if (!session) return EXPIRED; }
  return await rt.run(store, action, rt.apiFn(action, payload, session), { readOnly: READ_ONLY.has(action), scope: rt.scopeFor(action, payload, session) });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ success: true, service: 'we-books', version: (await runtime()).E.SYSTEM_CONFIG.VERSION });
  let body: any;
  try { body = JSON.parse(await req.text()); } catch { return reply({ success: false, message: 'طلب غير صالح.' }, 400); }
  if (!body || typeof body.action !== 'string') return reply({ success: false, message: 'طلب غير صالح.' }, 400);
  try { return reply(await handle(body.action, body.payload || {}, body.token)); }
  catch (err) { console.error(body.action, err); return reply({ success: false, message: 'حدث خطأ في الخادم أثناء تنفيذ العملية. حاول مرة أخرى.' }); }
});
