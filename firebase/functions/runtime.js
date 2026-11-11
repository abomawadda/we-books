// تشغيل منطق apps-script/Code.gs كما هو داخل Node، مع استبدال طبقة DB_Engine (Sheets)
// بوحدة عمل (Unit of Work) فوق مخزن: Firestore في التشغيل، أو ذاكرة في الاختبارات.
//
// الفكرة: المحرك متزامن (getAllRecords يعيد مصفوفة فوراً)، أما Firestore فغير متزامن.
// لذلك نحمّل الجداول المطلوبة أولاً داخل transaction، ونشغّل العملية على نسخة في الذاكرة
// مع تخزين الكتابات مؤقتاً، ثم نطبّق الكتابات داخل نفس الـ transaction.
// إذا طلبت العملية جدولاً لم يُحمَّل نُعيد تشغيلها من البداية بعد تحميله (الكتابات لم تُطبَّق بعد).
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pad = (n, l = 2) => String(n).padStart(l, '0');
const NEED = Symbol('need-table');

function locateCodeGs() {
  const c = [path.join(__dirname, 'Code.gs'), path.join(__dirname, '../../apps-script/Code.gs')];
  const f = c.find(p => fs.existsSync(p));
  if (!f) throw new Error('Code.gs غير موجود (شغّل npm run sync-code)');
  return f;
}

/**
 * @param {object} opts
 * @param {Function} [opts.DateClass] صنف Date بديل (ساعة قابلة للتحكم في الاختبارات)
 */
function createRuntime(opts = {}) {
  const cache = new Map(); // جلسات مؤقتة لكل طلب + حدّ محاولات الدخول (لكل نسخة خادم)
  let uow = null;          // وحدة العمل الحالية
  let ordSeq = 0;

  const ctx = {
    console, JSON, Math,
    Session: { getScriptTimeZone: () => 'Africa/Cairo' },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({
      get: k => { const e = cache.get(k); if (!e) return null; if (e.exp && e.exp < Date.now()) { cache.delete(k); return null; } return e.v; },
      put: (k, v, ttl) => cache.set(k, { v, exp: ttl ? Date.now() + ttl * 1000 : 0 }),
      remove: k => cache.delete(k)
    }) },
    SpreadsheetApp: { flush: () => {} },
    ScriptApp: {}, HtmlService: {}, ContentService: {},
    // يفترض أن TZ=Africa/Cairo مضبوط للعملية (انظر index.js)
    Utilities: {
      formatDate: (d, tz, fmt) => fmt
        .replace('yyyy', d.getFullYear()).replace('MM', pad(d.getMonth() + 1)).replace('dd', pad(d.getDate()))
        .replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes())).replace('ss', pad(d.getSeconds()))
        .replace('SSS', pad(d.getMilliseconds(), 3)),
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b)
    }
  };
  if (opts.DateClass) ctx.Date = opts.DateClass;
  vm.createContext(ctx);
  const src = fs.readFileSync(locateCodeGs(), 'utf8') +
    '\n;globalThis.__G = { callServerApi, DB_Engine, SYSTEM_CONFIG, Util, AuthEngine, getDatabaseSchemaDefinition_, seedInitialData_, dailyMaintenanceJob };';
  vm.runInContext(src, ctx, { filename: 'Code.gs' });
  const G = ctx.__G;
  const S = G.SYSTEM_CONFIG.SHEETS;
  const TEXT = new Set(vm.runInContext('TEXT_COLUMNS', ctx));
  const HEADERS = {};
  G.getDatabaseSchemaDefinition_().forEach(d => { HEADERS[d.name] = d.headers; });
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
  const need = name => { if (!uow.tables[name]) { uow.missing.add(name); const e = new Error('NEED ' + name); e[NEED] = true; throw e; } return uow.tables[name]; };
  const newDocId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const nextOrd = () => Date.now() * 1000 + (ordSeq++ % 1000);

  Object.assign(G.DB_Engine, {
    clearCache() {},
    getAllRecords(name) {
      return need(name).map(r => Object.assign({ _rowIndex: r.ord }, r.data));
    },
    insertRecordsBatch(name, arr) {
      if (!arr || !arr.length) return 0;
      if (!HEADERS[name]) throw new Error('الجدول غير موجود: ' + name);
      arr.forEach(o => {
        const rec = { id: newDocId(), ord: nextOrd(), data: clean(name, o) };
        if (uow.tables[name]) uow.tables[name].push(rec);
        uow.writes.set(name + '/' + rec.id, { table: name, id: rec.id, data: rec.data, ord: rec.ord });
      });
      return arr.length;
    },
    updateRecordByPK(name, pk, pkValue, upd) {
      const t = need(name);
      if (HEADERS[name].indexOf(pk) === -1) throw new Error('حقل المفتاح ' + pk + ' غير موجود في ' + name);
      const rec = t.find(r => String(r.data[pk]).trim() === String(pkValue).trim());
      if (!rec) return false;
      rec.data = clean(name, upd, rec.data);
      uow.writes.set(name + '/' + rec.id, { table: name, id: rec.id, data: rec.data, ord: rec.ord });
      return true;
    },
    // يمس فقط المستندات المحمَّلة (في النطاق المحدود: صفوف الموظف وحده). يعيد استخدام المستند
    // نفسه لنفس المفتاح ويتجاهل غير المتغيّر، فلا تُكتب إلا الفروق.
    overwriteTableData(name, arr) {
      const t = need(name);
      const pk = HEADERS[name][0];
      const old = new Map();
      t.forEach(r => { const k = String(r.data[pk]); if (!old.has(k)) old.set(k, r); else uow.writes.set(name + '/' + r.id, { table: name, id: r.id, del: true, prev: r.data }); });
      const next = [];
      (arr || []).forEach(o => {
        const k = String(o[pk]);
        const prev = old.get(k);
        if (prev) {
          old.delete(k);
          const data = clean(name, o);
          if (JSON.stringify(data) !== JSON.stringify(prev.data)) uow.writes.set(name + '/' + prev.id, { table: name, id: prev.id, data, ord: prev.ord });
          next.push({ id: prev.id, ord: prev.ord, data });
        } else {
          const rec = { id: newDocId(), ord: nextOrd(), data: clean(name, o) };
          uow.writes.set(name + '/' + rec.id, { table: name, id: rec.id, data: rec.data, ord: rec.ord });
          next.push(rec);
        }
      });
      old.forEach(r => uow.writes.set(name + '/' + r.id, { table: name, id: r.id, del: true, prev: r.data }));
      uow.tables[name] = next;
    },
    // العزل والتسلسل تضمنهما transaction في Firestore (أو التسلسل في مخزن الذاكرة)
    executeWithLock(fn) { return fn(); }
  });
  // لا يوجد "تأسيس جداول" في Firestore: المجموعات تُنشأ عند أول كتابة
  ctx.ensureDatabaseInitialized_ = () => {};

  // ---------------- تشغيل وحدة عمل ----------------
  const hints = new Map(); // اسم العملية ← الجداول التي احتاجتها سابقاً (لتقليل إعادة التشغيل)

  // ---------------- النطاق المحدود (ضغط يوم الحجز) ----------------
  // عمليات لا تحتاج إلا صفوف موظف واحد من هذه الجداول: نحمّل صفوفه فقط (استعلام Emp_ID ==)
  // فلا تتعارض transactions الموظفين المختلفين ولا تُقرأ آلاف المستندات في كل حجز.
  const EMP_SCOPED = {
    SUBMIT_OR_UPDATE_RESERVATION: [S.EMPLOYEES, S.RES_HEADER, S.RES_ITEMS, S.EMP_INVOICES, S.INSTALLMENTS]
  };
  function scopeFor(action, payload, session) {
    const tables = EMP_SCOPED[action];
    if (!tables || !session) return null;
    const empId = String(session.userType === 'EMPLOYEE' ? session.empId : (payload && payload.empId) || '').trim();
    if (!empId) return null;
    return { field: 'Emp_ID', value: empId, tables };
  }
  // تحميل مسبق معروف لعمليات يوم الحجز (حتى لا يكتشف كل طلب متزامن جداوله بإعادة التشغيل)
  hints.set('SUBMIT_OR_UPDATE_RESERVATION', [S.SETTINGS, S.EMPLOYEES, S.PHASES, S.BOOKS, S.RES_HEADER, S.RES_ITEMS, S.EMP_INVOICES, S.INSTALLMENTS]);
  const filterOf = (scope, name) => (scope && scope.tables.indexOf(name) !== -1) ? { field: scope.field, value: scope.value } : null;

  function attempt(key, tables, fn) {
    uow = { tables, writes: new Map(), missing: new Set() };
    let result, error;
    try { result = fn(G); } catch (e) { error = e; }
    const u = uow; uow = null;
    if (u.missing.size) return { missing: [...u.missing] };
    if (error) throw error;
    return { result, writes: [...u.writes.values()] };
  }

  /** نسخة متزامنة لمخزن متزامن (الاختبارات) */
  function runSync(store, key, fn, { commitOnFailure = false, scope = null } = {}) {
    const want = new Set(hints.get(key) || []);
    for (let i = 0; i < 30; i++) {
      const tables = {};
      want.forEach(n => { tables[n] = store.loadSync(n, filterOf(scope, n)); });
      const r = attempt(key, tables, fn);
      if (r.missing) { r.missing.forEach(n => want.add(n)); hints.set(key, [...new Set([...(hints.get(key) || []), ...want])]); continue; }
      hints.set(key, [...want]);
      if (commitOnFailure || !(r.result && r.result.success === false)) store.commitSync(r.writes);
      return r.result;
    }
    throw new Error('تعذر تحديد الجداول المطلوبة للعملية ' + key);
  }

  /** نسخة غير متزامنة: store.transact(async tx => …) حيث tx.load(name) و tx.commit(writes) */
  async function run(store, key, fn, { commitOnFailure = false, readOnly = false, scope = null } = {}) {
    const want = new Set(hints.get(key) || []);
    for (let i = 0; i < 30; i++) {
      (hints.get(key) || []).forEach(n => want.add(n));
      const r = await store.transact(async tx => {
        const tables = {};
        const names = [...want];
        const loaded = await Promise.all(names.map(n => tx.load(n, filterOf(scope, n))));
        names.forEach((n, j) => { tables[n] = loaded[j]; });
        const a = attempt(key, tables, fn);
        if (a.missing) return a;
        if (!readOnly && (commitOnFailure || !(a.result && a.result.success === false))) tx.commit(a.writes);
        return a;
      }, { readOnly });
      if (r.missing) { r.missing.forEach(n => want.add(n)); hints.set(key, [...new Set([...(hints.get(key) || []), ...want])]); continue; }
      hints.set(key, [...want]);
      return r.result;
    }
    throw new Error('تعذر تحديد الجداول المطلوبة للعملية ' + key);
  }

  /** تنفيذ عملية API باسم جلسة موثّقة (session = claims من Firebase Auth) أو بدون جلسة */
  function apiFn(action, payload, session) {
    return g => {
      let token = null;
      if (session) { token = 'AUTH_' + crypto.randomUUID(); ctx.CacheService.getScriptCache().put(token, JSON.stringify(session), 60); }
      try { return g.callServerApi(action, payload || {}, token); }
      finally { if (token) cache.delete(token); }
    };
  }

  const EMP_INDEXED = [...new Set([].concat(...Object.values(EMP_SCOPED)))];
  return { ctx, G, S, TABLES, HEADERS, run, runSync, apiFn, cache, scopeFor, EMP_INDEXED, hints };
}

/** مخزن في الذاكرة (للاختبارات) بنفس واجهة مخزن Firestore */
function memoryStore() {
  const data = {}; // table -> Map(id -> {ord, data})
  const tbl = n => (data[n] = data[n] || new Map());
  const loadSync = (n, f) => [...tbl(n).entries()].filter(([, v]) => !f || String(v.data[f.field]) === String(f.value)).map(([id, v]) => ({ id, ord: v.ord, data: Object.assign({}, v.data) })).sort((a, b) => a.ord - b.ord);
  const commitSync = writes => writes.forEach(w => { if (w.del) tbl(w.table).delete(w.id); else tbl(w.table).set(w.id, { ord: w.ord, data: Object.assign({}, w.data) }); });
  let chain = Promise.resolve();
  return {
    data, loadSync, commitSync,
    transact(fn) { // تسلسل كامل
      const p = chain.then(() => { let pending = null; return fn({ load: async (n, f) => loadSync(n, f), commit: w => { pending = w; } }).then(r => { if (pending) commitSync(pending); return r; }); });
      chain = p.catch(() => {});
      return p;
    }
  };
}

module.exports = { createRuntime, memoryStore };
