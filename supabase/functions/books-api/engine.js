// تشغيل منطق apps-script/Code.gs كما هو (عبر new Function، بلا node:vm) مع استبدال DB_Engine (Sheets)
// بوحدة عمل فوق مخزن: Postgres في Supabase، أو ذاكرة في الاختبارات. يعمل في Deno و Node.
//
// المحرك متزامن بينما قاعدة البيانات غير متزامنة: نحمّل الجداول اللازمة داخل transaction،
// ننفّذ العملية في الذاكرة مع تخزين الكتابات، ثم نكتبها في نفس الـ transaction. إذا احتاجت
// العملية جدولاً لم يُحمَّل نعيد تشغيلها بعد تحميله (لم يُكتب شيء بعد).

const pad = (n, l = 2) => String(n).padStart(l, '0');

/**
 * @param {object} o
 * @param {string} o.code       نص Code.gs
 * @param {(s:string)=>number[]} o.sha256  بايتات SHA-256 لنص UTF-8 (موقّعة كما في Apps Script)
 * @param {Function} [o.DateClass]
 */
export function createRuntime({ code, sha256, DateClass }) {
  const cache = new Map();
  let uow = null;
  let ordSeq = 0;
  const uuid = () => crypto.randomUUID();
  // كل التواريخ بتوقيت القاهرة مهما كانت منطقة الخادم (UTC في Supabase):
  // صنف Date يفسّر المكوّنات (السنة/الشهر/الساعة...) بتوقيت القاهرة، مع التوقيت الصيفي.
  const D = DateClass || cairoDateClass();
  const parts = d => ({ y: d.getFullYear(), M: d.getMonth() + 1, d: d.getDate(), H: d.getHours(), m: d.getMinutes(), s: d.getSeconds() });
  const G = {
    Session: { getScriptTimeZone: () => 'Africa/Cairo' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({
      get: k => { const e = cache.get(k); if (!e) return null; if (e.exp && e.exp < Date.now()) { cache.delete(k); return null; } return e.v; },
      put: (k, v, ttl) => cache.set(k, { v, exp: ttl ? Date.now() + ttl * 1000 : 0 }),
      remove: k => cache.delete(k)
    }) },
    SpreadsheetApp: { flush: () => {} }, ScriptApp: {}, HtmlService: {}, ContentService: {},
    Utilities: {
      formatDate: (dt, tz, fmt) => { const p = parts(dt); return fmt
        .replace('yyyy', p.y).replace('MM', pad(p.M)).replace('dd', pad(p.d))
        .replace('HH', pad(p.H)).replace('mm', pad(p.m)).replace('ss', pad(p.s))
        .replace('SSS', pad(dt.getMilliseconds(), 3)); },
      getUuid: uuid,
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => sha256(String(s))
    }
  };
  const names = Object.keys(G).concat(['Date']);
  const body = code + `
;ensureDatabaseInitialized_ = function () {};
return { callServerApi, DB_Engine, SYSTEM_CONFIG, Util, AuthEngine, TEXT_COLUMNS, getDatabaseSchemaDefinition_, seedInitialData_, dailyMaintenanceJob };`;
  const E = new Function(...names, body)(...names.map(n => n === 'Date' ? D : G[n]));
  const S = E.SYSTEM_CONFIG.SHEETS;
  const TEXT = new Set(E.TEXT_COLUMNS);
  const HEADERS = {};
  E.getDatabaseSchemaDefinition_().forEach(d => { HEADERS[d.name] = d.headers; });
  const TABLES = Object.values(S);

  // ---------------- طبقة البيانات البديلة ----------------
  const clean = (name, obj, base) => {
    const out = Object.assign({}, base || {});
    HEADERS[name].forEach(h => {
      if (!(h in obj)) { if (!base) out[h] = ''; return; }
      const v = obj[h];
      out[h] = (v === undefined || v === null) ? '' : (TEXT.has(h) ? String(v) : v);
    });
    return out;
  };
  const need = name => { if (!uow.tables[name]) { uow.missing.add(name); throw new Error('NEED ' + name); } return uow.tables[name]; };
  const newId = () => uuid().replace(/-/g, '').slice(0, 20);
  const nextOrd = () => Date.now() * 1000 + (ordSeq++ % 1000);
  const put = (name, rec) => uow.writes.set(name + '/' + rec.id, { table: name, id: rec.id, data: rec.data, ord: rec.ord });
  const del = (name, rec) => uow.writes.set(name + '/' + rec.id, { table: name, id: rec.id, del: true });

  Object.assign(E.DB_Engine, {
    clearCache() {},
    getAllRecords(name) { return need(name).map(r => Object.assign({ _rowIndex: r.ord }, r.data)); },
    insertRecordsBatch(name, arr) {
      if (!arr || !arr.length) return 0;
      if (!HEADERS[name]) throw new Error('الجدول غير موجود: ' + name);
      arr.forEach(o => {
        const rec = { id: newId(), ord: nextOrd(), data: clean(name, o) };
        if (uow.tables[name]) uow.tables[name].push(rec);
        put(name, rec);
      });
      return arr.length;
    },
    updateRecordByPK(name, pk, pkValue, upd) {
      const t = need(name);
      if (HEADERS[name].indexOf(pk) === -1) throw new Error('حقل المفتاح ' + pk + ' غير موجود في ' + name);
      const rec = t.find(r => String(r.data[pk]).trim() === String(pkValue).trim());
      if (!rec) return false;
      rec.data = clean(name, upd, rec.data);
      put(name, rec);
      return true;
    },
    // يمس المحمَّل فقط (في النطاق المحدود: صفوف الموظف وحده)، ويكتب الفروق فقط
    overwriteTableData(name, arr) {
      const t = need(name);
      const pk = HEADERS[name][0];
      const old = new Map();
      t.forEach(r => { const k = String(r.data[pk]); if (!old.has(k)) old.set(k, r); else del(name, r); });
      const next = [];
      (arr || []).forEach(o => {
        const k = String(o[pk]);
        const prev = old.get(k);
        const data = clean(name, o);
        if (prev) {
          old.delete(k);
          const rec = { id: prev.id, ord: prev.ord, data };
          if (JSON.stringify(data) !== JSON.stringify(prev.data)) put(name, rec);
          next.push(rec);
        } else { const rec = { id: newId(), ord: nextOrd(), data }; put(name, rec); next.push(rec); }
      });
      old.forEach(r => del(name, r));
      uow.tables[name] = next;
    },
    executeWithLock(fn) { return fn(); } // العزل يضمنه المخزن (أقفال Postgres)
  });

  // ---------------- النطاق المحدود ليوم الحجز ----------------
  const EMP_SCOPED = { SUBMIT_OR_UPDATE_RESERVATION: [S.EMPLOYEES, S.RES_HEADER, S.RES_ITEMS, S.EMP_INVOICES, S.INSTALLMENTS] };
  const hints = new Map();
  hints.set('SUBMIT_OR_UPDATE_RESERVATION', [S.SETTINGS, S.EMPLOYEES, S.PHASES, S.BOOKS, S.RES_HEADER, S.RES_ITEMS, S.EMP_INVOICES, S.INSTALLMENTS]);
  function scopeFor(action, payload, session) {
    const tables = EMP_SCOPED[action];
    if (!tables || !session) return null;
    const empId = String(session.userType === 'EMPLOYEE' ? session.empId : (payload && payload.empId) || '').trim();
    return empId ? { empId, tables } : null;
  }
  const filterOf = (scope, name) => (scope && scope.tables.indexOf(name) !== -1) ? scope.empId : null;

  function attempt(tables, fn) {
    uow = { tables, writes: new Map(), missing: new Set() };
    let result, error;
    try { result = fn(E); } catch (e) { error = e; }
    const u = uow; uow = null;
    if (u.missing.size) return { missing: [...u.missing] };
    if (error) throw error;
    return { result, writes: [...u.writes.values()] };
  }
  const learn = (key, want, missing) => { missing.forEach(n => want.add(n)); hints.set(key, [...new Set([...(hints.get(key) || []), ...want])]); };
  const shouldCommit = (r, commitOnFailure) => commitOnFailure || !(r && r.success === false);

  function runSync(store, key, fn, { commitOnFailure = false, scope = null } = {}) {
    const want = new Set(hints.get(key) || []);
    for (let i = 0; i < 30; i++) {
      const tables = {};
      want.forEach(n => { tables[n] = store.loadSync(n, filterOf(scope, n)); });
      const r = attempt(tables, fn);
      if (r.missing) { learn(key, want, r.missing); continue; }
      if (shouldCommit(r.result, commitOnFailure)) store.commitSync(r.writes);
      return r.result;
    }
    throw new Error('تعذر تحديد الجداول المطلوبة للعملية ' + key);
  }

  async function run(store, key, fn, { commitOnFailure = false, readOnly = false, scope = null } = {}) {
    // عملية جديدة بلا قائمة معروفة: نحمّل كل الجداول دفعة واحدة بدل اكتشافها واحداً واحداً
    const want = new Set(hints.get(key) || (scope ? [] : TABLES));
    for (let i = 0; i < 30; i++) {
      (hints.get(key) || []).forEach(n => want.add(n));
      const r = await store.transact(async tx => {
        const names = [...want];
        const loaded = tx.loadMany
          ? await tx.loadMany(names.map(n => ({ tbl: n, emp: filterOf(scope, n) })))
          : await Promise.all(names.map(n => tx.load(n, filterOf(scope, n))));
        const tables = {};
        names.forEach((n, j) => { tables[n] = loaded[j]; });
        const a = attempt(tables, fn);
        if (!a.missing && !readOnly && shouldCommit(a.result, commitOnFailure)) await tx.commit(a.writes);
        return a;
      }, { readOnly, scope });
      if (r.missing) { learn(key, want, r.missing); continue; }
      return r.result;
    }
    throw new Error('تعذر تحديد الجداول المطلوبة للعملية ' + key);
  }

  /** تنفيذ عملية API باسم جلسة موثّقة (أو بدون جلسة) */
  function apiFn(action, payload, session) {
    return g => {
      let token = null;
      if (session) { token = 'AUTH_' + uuid(); G.CacheService.getScriptCache().put(token, JSON.stringify(session), 60); }
      try { return g.callServerApi(action, payload || {}, token); }
      finally { if (token) cache.delete(token); }
    };
  }

  return { E, S, TABLES, HEADERS, run, runSync, apiFn, cache, scopeFor, hints };
}

/** Date بتوقيت Africa/Cairo (يدعم ما يستخدمه Code.gs: المكوّنات والقراءة) */
export function cairoDateClass() {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
  const comp = t => { const p = {}; fmt.formatToParts(new Date(t)).forEach(x => { p[x.type] = +x.value; }); return p; };
  const offset = t => { const p = comp(t); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000; };
  return class CairoDate extends Date {
    constructor(...a) {
      if (a.length >= 2) { const u = Date.UTC(...a); super(u - offset(u - offset(u))); } else super(...a);
    }
    _p() { return comp(this.getTime()); }
    getFullYear() { return this._p().year; }
    getMonth() { return this._p().month - 1; }
    getDate() { return this._p().day; }
    getHours() { return this._p().hour; }
    getMinutes() { return this._p().minute; }
    getSeconds() { return this._p().second; }
  };
}

/** مخزن في الذاكرة (للاختبارات) */
export function memoryStore() {
  const data = {};
  const tbl = n => (data[n] = data[n] || new Map());
  const loadSync = (n, emp) => [...tbl(n).entries()]
    .filter(([, v]) => !emp || String(v.data.Emp_ID) === String(emp))
    .map(([id, v]) => ({ id, ord: v.ord, data: Object.assign({}, v.data) })).sort((a, b) => a.ord - b.ord);
  const commitSync = ws => ws.forEach(w => { if (w.del) tbl(w.table).delete(w.id); else tbl(w.table).set(w.id, { ord: w.ord, data: Object.assign({}, w.data) }); });
  let chain = Promise.resolve();
  return {
    data, loadSync, commitSync,
    transact(fn) {
      const p = chain.then(() => { let pending = null; return fn({ load: async (n, e) => loadSync(n, e), commit: async w => { pending = w; } }).then(r => { if (pending) commitSync(pending); return r; }); });
      chain = p.catch(() => {});
      return p;
    }
  };
}
