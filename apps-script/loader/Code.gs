/**
 * محمِّل منظومة مبادرة الكتب — يُلصق مرة واحدة فقط ولا يحتاج تعديلاً بعد ذلك.
 * كود الخادم الكامل محفوظ في ملف we-books-server.js على Google Drive الخاص بك،
 * ويُحمَّل منه أحدث إصدار تلقائياً، فلا حاجة لنسخ ولصق أو نشر إصدار جديد عند التحديث.
 */
const SERVER_FILE_NAME = "we-books-server.js";
let SRV_ = null;

/** أحدث ملف بهذا الاسم يملكه صاحب السكربت نفسه (لا يُقبل ملف شاركه شخص آخر) */
function latestServerFile_() {
  const me = Session.getEffectiveUser().getEmail();
  const it = DriveApp.getFilesByName(SERVER_FILE_NAME);
  let best = null;
  while (it.hasNext()) {
    const f = it.next();
    if (f.isTrashed()) continue;
    const owner = f.getOwner();
    if (!owner || owner.getEmail() !== me) continue;
    if (!best || f.getDateCreated() > best.getDateCreated()) best = f;
  }
  if (!best) throw new Error("لم يُعثر على ملف " + SERVER_FILE_NAME + " في Drive الخاص بك");
  return best;
}

function srv_() {
  if (SRV_) return SRV_;
  const code = latestServerFile_().getBlob().getDataAsString("UTF-8");
  SRV_ = new Function(code)();
  return SRV_;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try { return srv_().doPost(e); }
  catch (err) { return json_({ success: false, message: "خطأ في تحميل الخادم: " + (err && err.message || err) }); }
}

function doGet(e) {
  try { return srv_().doGet(e); }
  catch (err) { return json_({ ok: false, loaderError: String(err && err.message || err) }); }
}

function dailyMaintenanceJob() { return srv_().dailyMaintenanceJob(); }
function runDiagnostics() { const r = srv_().runDiagnostics(); console.log(JSON.stringify(r, null, 2)); return r; }
function initializeDatabaseSchema() { return srv_().initializeDatabaseSchema(true); }
function setupDailyTriggers() { return srv_().setupDailyTriggers(); }
function callServerApi(action, payload, token) { return srv_().callServerApi(action, payload, token); }
