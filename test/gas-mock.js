// محاكاة مبسطة لبيئة Google Apps Script لتشغيل ملفات .gs واختبارها
const crypto = require('crypto');
const fs = require('fs');
const vm = require('vm');

function pad(n, l = 2) { return String(n).padStart(l, '0'); }

class Range {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) {
        const v = (this.sheet.data[this.r - 1 + i] || [])[this.c - 1 + j];
        row.push(v === undefined ? "" : v);
      }
      out.push(row);
    }
    return out;
  }
  setValues(vals) {
    if (this.r + this.nr - 1 > this.sheet.maxRows) throw new Error("Range out of bounds: row " + (this.r + this.nr - 1) + " > " + this.sheet.maxRows);
    if (vals.length !== this.nr || vals[0].length !== this.nc) throw new Error("dimension mismatch");
    for (let i = 0; i < this.nr; i++) {
      this.sheet.data[this.r - 1 + i] = this.sheet.data[this.r - 1 + i] || [];
      for (let j = 0; j < this.nc; j++) {
        let v = vals[i][j];
        // محاكاة تحويل الشيت للنصوص التي تشبه الأرقام إذا لم يكن العمود نصياً
        const textCol = this.sheet.textCols.has(this.c + j);
        if (!textCol && typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && !/^0\d/.test(v)) v = Number(v);
        if (!textCol && typeof v === 'string' && /^0\d+$/.test(v)) v = Number(v); // يضيع الصفر
        this.sheet.data[this.r - 1 + i][this.c - 1 + j] = v;
      }
    }
    return this;
  }
  clearContent() {
    for (let i = 0; i < this.nr; i++) {
      const row = this.sheet.data[this.r - 1 + i];
      if (row) for (let j = 0; j < this.nc; j++) row[this.c - 1 + j] = "";
    }
    // قص الصفوف الفارغة في النهاية
    while (this.sheet.data.length && this.sheet.data[this.sheet.data.length - 1].every(v => v === "" || v === undefined)) this.sheet.data.pop();
    return this;
  }
  setNumberFormat(f) { if (f === "@") for (let j = 0; j < this.nc; j++) this.sheet.textCols.add(this.c + j); return this; }
  setBackground() { return this; } setFontColor() { return this; } setFontWeight() { return this; }
  setHorizontalAlignment() { return this; } setFontFamily() { return this; } setVerticalAlignment() { return this; }
}

class Sheet {
  constructor(name) { this.name = name; this.data = []; this.maxRows = 1000; this.textCols = new Set(); }
  getName() { return this.name; }
  getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  getLastRow() { let n = this.data.length; while (n > 0 && (this.data[n - 1] || []).every(v => v === "" || v === undefined)) n--; return n; }
  getLastColumn() { return (this.data[0] || []).length; }
  getMaxRows() { return this.maxRows; }
  insertRowsAfter(after, n) { this.maxRows += n; }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  setRightToLeft() {} setTabColor() {} setFrozenRows() {} setRowHeight() {}
}

class Spreadsheet {
  constructor() { this.sheets = []; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets; }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
}

function makeContext(clock) {
  const ss = new Spreadsheet();
  const cache = new Map(); const props = {};
  const ctx = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss, flush: () => {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    Session: { getScriptTimeZone: () => "Africa/Cairo" },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({ get: k => cache.has(k) ? cache.get(k) : null, put: (k, v) => cache.set(k, v), remove: k => cache.delete(k) }) },
    HtmlService: { createHtmlOutputFromFile: () => ({ getContent: () => fs.readFileSync(__dirname + '/../apps-script/Index.html', 'utf8') }) }, ScriptApp: {}, ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ setMimeType: () => t }) },
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
  // ساعة قابلة للتحكم
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(clock.now); else super(...a); }
    static now() { return clock.now; }
  }
  ctx.Date = FakeDate;
  vm.createContext(ctx);
  const dir = __dirname + '/../apps-script/';
  // const في السياق المشترك: نلف كل الملفات في نص واحد كما يفعل Apps Script
  const src = fs.readFileSync(dir + 'Code.gs', 'utf8') +
    '\n;globalThis.__api = callServerApi; globalThis.__init = initializeDatabaseSchema; globalThis.__job = dailyMaintenanceJob; globalThis.__DB = DB_Engine; globalThis.__S = SYSTEM_CONFIG.SHEETS; globalThis.__diag = runDiagnostics_; globalThis.__doGet = doGet; globalThis.__doPost = doPost;';
  vm.runInContext(src, ctx, { filename: 'gas.js' });
  return { ctx, ss };
}

module.exports = { makeContext };
