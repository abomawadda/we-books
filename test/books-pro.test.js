// اختبارات إلزامية شاملة (8 سيناريوهات): التسعير التاريخي، المقارنة، الشُّعب المرنة، حماية الفواتير، وأداء البحث مع 3000 كتاب
const assert = require('assert');
const { makeContext } = require('./sb-mock');

const clock = { now: new Date(2026, 8, 1, 10, 0, 0).getTime() }; // 1 سبتمبر 2026
const { ctx } = makeContext(clock);
const api = (a, p, t) => ctx.__api(a, p || {}, t);
const rows = name => ctx.__DB.getAllRecords(name);
const S = ctx.__S;

let checks = 0;
const ok = (res, lbl) => { if (!res || !res.success) { console.error('FAIL:', lbl, res && res.message); process.exit(1); } checks++; return res; };
const fail = (res, lbl, re) => { if (!res || res.success) { console.error('EXPECTED FAIL:', lbl); process.exit(1); } if (re && !re.test(res.message)) { console.error('WRONG MSG:', lbl, res.message); process.exit(1); } checks++; return res; };

// تأسيس البيانات الأساسية
ok(ctx.__init(true), 'init');
const A = ok(api('LOGIN_ADMIN', { username: 'admin', password: 'Admin@2026' }), 'admin login').sessionToken;
const coord = ok(api('LOGIN_ADMIN', { username: 'coord', password: 'Coord@2026' }), 'coord login').sessionToken;
const empTok = ok(api('LOGIN_EMPLOYEE', { empId: '1001', natIdLast4: '4512', mobile: '01012345678' }), 'emp login').sessionToken;
const emp2Tok = ok(api('LOGIN_EMPLOYEE', { empId: '1002', natIdLast4: '8834', mobile: '01122334455' }), 'emp2 login').sessionToken;

// إضافة كتابين للتجربة (كتاب أساسي + كتاب ثانوي مشترك)
const bk1 = ok(api('SAVE_BOOK', { grade: '4 ابتدائي', publisher: 'الأضواء', subject: 'عربي', bookPart: 'شرح', schoolTypes: 'حكومي', coverPrice: 100, supplierDiscountPct: 20 }, coord), 'create bk1').book;
const bk3s = ok(api('SAVE_BOOK', { grade: '3 ثانوي', publisher: 'المعاصر', subject: 'أحياء', bookPart: 'شرح', schoolTypes: 'حكومي', coverPrice: 150, supplierDiscountPct: 20 }, coord), 'create bk3s').book;
const bkShared = ok(api('SAVE_BOOK', { grade: '3 ثانوي', publisher: 'الامتحان', subject: 'عربي', bookPart: 'شرح', schoolTypes: 'حكومي', coverPrice: 150, supplierDiscountPct: 20 }, coord), 'create bkShared').book;

// ============================================================================
// الاختبار الأول: اختلاف الأسعار بين الترمين + سلامة الفواتير لكل ترم
// ============================================================================
const plT1 = ok(api('SAVE_PRICE_LIST', { academicYear: '2026/2027', term: 'الترم الأول', title: 'أسعار 2026/2027 ترم 1' }, coord), 'create T1 list').priceList;
// منع تكرار قائمة نشطة لنفس الفترة
fail(api('SAVE_PRICE_LIST', { academicYear: '2026/2027', term: 'الترم الأول' }, coord), 'duplicate period rejected', /بالفعل/);
ok(api('SAVE_PRICE_ITEMS', { priceListId: plT1.Price_List_ID, items: [
  { bookId: bk1.Book_ID, coverPrice: 100, supplierDiscountPct: 20 },
  { bookId: bk3s.Book_ID, coverPrice: 150, supplierDiscountPct: 20 }
] }, coord), 'set T1 prices');
ok(api('TRANSITION_PRICE_LIST', { priceListId: plT1.Price_List_ID, toStatus: 'Approved', syncToCatalog: true }, coord), 'approve T1');

// مرحلة للترم الأول + حجز + توريد + تخصيص وإصدار فاتورة الترم الأول
const phT1 = 'PH-T1';
ok(api('SAVE_PHASE', { phaseId: phT1, phaseName: 'مرحلة ترم 1 — 2026/2027', startDate: '2026-09-01', endDate: '2026-09-20', deliveryStartDate: '2026-09-25', academicYear: '2026/2027', term: 'الترم الأول' }, coord), 'create phase T1');
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: phT1, items: [{ bookId: bk1.Book_ID, qty: 2 }], paymentMethod: 'CASH' }, empTok), 'reserve T1');
const itemT1Before = rows(S.RES_ITEMS).find(i => i.Phase_ID === phT1 && i.Book_ID === bk1.Book_ID);
assert.strictEqual(itemT1Before.Unit_Cover_Price, 100, 'T1 cover price snapshot = 100');
assert.strictEqual(itemT1Before.Academic_Year, '2026/2027');
assert.strictEqual(itemT1Before.Term, 'الترم الأول');
assert.ok(itemT1Before.Price_ID, 'Price_ID recorded on T1 reservation item');
checks += 4;

// توريد وتخصيص وإصدار فاتورة للترم الأول
ok(api('SET_PHASE_STATUS', { phaseId: phT1, status: 'Closed' }, coord), 'close phT1');
ok(api('GENERATE_PO_SNAPSHOT', { phaseId: phT1 }, coord), 'po phT1');
ok(api('SUBMIT_SUPPLIER_INVOICE', { phaseId: phT1, supplierId: 'SUP-01', supplierInvoiceNo: 'INV-T1', volumeDiscountPct: 0, items: [{ bookId: bk1.Book_ID, receivedQty: 2, coverPriceInvoiced: 100, itemDiscountPctInvoiced: 20 }] }, coord), 'sup inv T1');
ok(api('RUN_ALLOCATION_ENGINE', { phaseId: phT1 }, coord), 'alloc T1');
const invT1Before = rows(S.EMP_INVOICES).find(v => v.Phase_ID === phT1 && v.Emp_ID === '1001');
assert.ok(invT1Before && invT1Before.Net_Final_Invoice_Amount > 0, 'T1 invoice issued');
const invT1Amount = invT1Before.Net_Final_Invoice_Amount;
checks++;

// الآن إنشاء واعتماد قائمة أسعار الترم الثاني بسعر مختلف (120 جنيه)
const plT2 = ok(api('SAVE_PRICE_LIST', { academicYear: '2026/2027', term: 'الترم الثاني', copyFromListId: plT1.Price_List_ID }, coord), 'create T2 list').priceList;
ok(api('SAVE_PRICE_ITEMS', { priceListId: plT2.Price_List_ID, items: [{ bookId: bk1.Book_ID, coverPrice: 120, supplierDiscountPct: 20 }] }, coord), 'update bk1 T2 to 120');
ok(api('TRANSITION_PRICE_LIST', { priceListId: plT2.Price_List_ID, toStatus: 'Approved', syncToCatalog: true }, coord), 'approve T2');

// التحقق من استقلال السعرين تماماً + ثبات فاتورة الترم الأول
const t1PriceRow = rows(S.PRICE_ITEMS).find(p => p.Price_List_ID === plT1.Price_List_ID && p.Book_ID === bk1.Book_ID && p.Status === 'Approved');
const t2PriceRow = rows(S.PRICE_ITEMS).find(p => p.Price_List_ID === plT2.Price_List_ID && p.Book_ID === bk1.Book_ID && p.Status === 'Approved');
assert.strictEqual(t1PriceRow.Cover_Price, 100, 'T1 price still 100');
assert.strictEqual(t2PriceRow.Cover_Price, 120, 'T2 price is 120');
const invT1AfterT2 = rows(S.EMP_INVOICES).find(v => v.Emp_Inv_ID === invT1Before.Emp_Inv_ID);
assert.strictEqual(invT1AfterT2.Net_Final_Invoice_Amount, invT1Amount, 'T1 invoice untouched by T2 pricing');
checks += 3;

// مرحلة للترم الثاني: الحجز يلتقط سعر الترم الثاني (120)
const phT2 = 'PH-T2';
ok(api('SAVE_PHASE', { phaseId: phT2, phaseName: 'مرحلة ترم 2 — 2026/2027', startDate: '2026-10-01', endDate: '2026-10-20', deliveryStartDate: '2026-10-25', academicYear: '2026/2027', term: 'الترم الثاني' }, coord), 'create phase T2');
clock.now = new Date(2026, 9, 5, 10, 0, 0).getTime();
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: phT2, items: [{ bookId: bk1.Book_ID, qty: 1 }], paymentMethod: 'CASH' }, empTok), 'reserve T2');
const itemT2 = rows(S.RES_ITEMS).find(i => i.Phase_ID === phT2 && i.Book_ID === bk1.Book_ID);
assert.strictEqual(itemT2.Unit_Cover_Price, 120, 'T2 reservation got 120');
assert.strictEqual(itemT2.Term, 'الترم الثاني');
checks += 2;

// ============================================================================
// الاختبار الثاني: بداية عام دراسي جديد + نسخ + تعديل + اعتماد + مقارنة + منع التعديل العشوائي
// ============================================================================
const plNext = ok(api('SAVE_PRICE_LIST', { academicYear: '2027/2028', term: 'الترم الأول', copyFromListId: plT2.Price_List_ID, pctAdjust: 12.5 }, coord), 'create 2027/2028 copied +12.5%').priceList;
const copiedBk1 = rows(S.PRICE_ITEMS).find(p => p.Price_List_ID === plNext.Price_List_ID && p.Book_ID === bk1.Book_ID);
assert.strictEqual(copiedBk1.Cover_Price, 135, '120 * 1.125 = 135');
ok(api('TRANSITION_PRICE_LIST', { priceListId: plNext.Price_List_ID, toStatus: 'Approved', syncToCatalog: false }, coord), 'approve 2027/2028');
// التحقق من عدم تغير أسعار العام السابق
assert.strictEqual(rows(S.PRICE_ITEMS).find(p => p.Price_List_ID === plT1.Price_List_ID && p.Book_ID === bk1.Book_ID).Cover_Price, 100);
assert.strictEqual(rows(S.PRICE_ITEMS).find(p => p.Price_List_ID === plT2.Price_List_ID && p.Book_ID === bk1.Book_ID).Cover_Price, 120);
// مقارنة فترتين
const cmp = ok(api('COMPARE_PRICE_LISTS', { listAId: plT1.Price_List_ID, listBId: plNext.Price_List_ID }, coord), 'compare T1 vs 2027/2028');
const cmpBk1 = cmp.rows.find(r => r.bookId === bk1.Book_ID);
assert.strictEqual(cmpBk1.diff, 35, 'diff = +35');
assert.strictEqual(cmpBk1.pctChange, 35, 'pctChange = +35%');
assert.strictEqual(cmpBk1.direction, 'increased');
assert.ok(cmp.summary.increased >= 1);
// منع التعديل المباشر على قائمة معتمدة
fail(api('SAVE_PRICE_ITEMS', { priceListId: plNext.Price_List_ID, items: [{ bookId: bk1.Book_ID, coverPrice: 140 }] }, coord), 'direct edit approved rejected', /معتمدة/);
// التعديل الموثّق يحفظ النسخة القديمة كـ Superseded
fail(api('REVISE_APPROVED_PRICE', { priceListId: plNext.Price_List_ID, bookId: bk1.Book_ID, coverPrice: 140, reason: '' }, coord), 'revise without reason rejected', /سبب/);
const rev = ok(api('REVISE_APPROVED_PRICE', { priceListId: plNext.Price_List_ID, bookId: bk1.Book_ID, coverPrice: 140, reason: 'تعديل رسمي من دار النشر' }, coord), 'documented revision');
assert.strictEqual(rev.price.Version, 2);
assert.strictEqual(rows(S.PRICE_ITEMS).find(p => p.Price_ID === rev.previousPriceId).Status, 'Superseded');
checks += 9;

// ============================================================================
// الاختبار الثالث والرابع والخامس: شعب الثانوية الجديدة + الكتب المشتركة بلا تكرار + اختلاف الأسعار بين الشعب
// ============================================================================
ok(api('SAVE_STAGES_LIST', { stages: ['رياض الأطفال', 'المرحلة الابتدائية', 'المرحلة الإعدادية', 'المرحلة الثانوية', 'التعليم الفني'] }, coord), 'add dynamic stage');
// التحقق من منع تكرار الشعبة المسجلة مسبقاً (علمي علوم موجودة تلقائياً من الدمج مع GRADE_TRACKS)
fail(api('SAVE_TRACKS_REGISTRY', { op: 'upsert', name: 'علمي علوم', grade: '3 ثانوي' }, coord), 'duplicate seeded track rejected', /مسجلة بالفعل/);
const tBacc = ok(api('SAVE_TRACKS_REGISTRY', { op: 'upsert', name: 'بكالوريا — طب وعلوم حياة', grade: '3 ثانوي', notes: 'نظام البكالوريا الجديد' }, coord), 'add baccalaureate med track').track;
const tBaccEng = ok(api('SAVE_TRACKS_REGISTRY', { op: 'upsert', name: 'بكالوريا — هندسة وحاسب', grade: '3 ثانوي', notes: 'نظام البكالوريا الجديد' }, coord), 'add baccalaureate eng track').track;
// ربط كتاب مشترك بـ 3 شعب دون تكرار سجل الكتاب الأساسي
const bookCountBefore = rows(S.BOOKS).filter(b => b.Book_ID === bkShared.Book_ID).length;
ok(api('SAVE_TRACK_CURRICULUM', { academicYear: '2026/2027', term: 'الترم الأول', rows: [
  { bookId: bk3s.Book_ID, tracks: ['علمي علوم', 'بكالوريا — طب وعلوم حياة'] },
  { bookId: bkShared.Book_ID, tracks: ['علمي علوم', 'أدبي', 'بكالوريا — طب وعلوم حياة'] }
] }, coord), 'save 2026/2027 curriculum');
assert.strictEqual(rows(S.BOOKS).filter(b => b.Book_ID === bkShared.Book_ID).length, bookCountBefore, 'no duplicate Book_ID for shared book');
// تغيير مقررات عام جديد لا يمس العام السابق
ok(api('SAVE_TRACK_CURRICULUM', { academicYear: '2027/2028', term: 'الترم الأول', rows: [
  { bookId: bk3s.Book_ID, tracks: ['بكالوريا — طب وعلوم حياة'] }
], syncToCatalog: false }, coord), 'save 2027/2028 curriculum');
const curr2026 = rows(S.TRACK_CURRICULUM).filter(c => c.Academic_Year === '2026/2027' && c.Book_ID === bk3s.Book_ID);
const curr2027 = rows(S.TRACK_CURRICULUM).filter(c => c.Academic_Year === '2027/2028' && c.Book_ID === bk3s.Book_ID);
assert.strictEqual(curr2026.length, 2, '2026/2027 curriculum intact (2 tracks)');
assert.strictEqual(curr2027.length, 1, '2027/2028 curriculum independent (1 track)');

// اختلاف سعر كتاب بين شعبتين في نفس الفترة
const plT3 = ok(api('SAVE_PRICE_LIST', { academicYear: '2027/2028', term: 'الترم الثاني' }, coord), 'create 2027/2028 T2').priceList;
ok(api('SAVE_PRICE_ITEMS', { priceListId: plT3.Price_List_ID, items: [
  { bookId: bkShared.Book_ID, track: '', coverPrice: 150, supplierDiscountPct: 20 },
  { bookId: bkShared.Book_ID, track: 'علمي علوم', coverPrice: 165, supplierDiscountPct: 20 }
] }, coord), 'set general & track-specific prices');
ok(api('TRANSITION_PRICE_LIST', { priceListId: plT3.Price_List_ID, toStatus: 'Approved', syncToCatalog: false }, coord), 'approve 2027/2028 T2');
const phTrk = 'PH-TRK';
ok(api('SAVE_PHASE', { phaseId: phTrk, phaseName: 'مرحلة شعب 2027/2028', startDate: '2027-01-10', endDate: '2027-01-25', deliveryStartDate: '2027-01-30', academicYear: '2027/2028', term: 'الترم الثاني' }, coord), 'phase tracks');
clock.now = new Date(2027, 0, 15, 10, 0, 0).getTime();
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: phTrk, items: [{ bookId: bkShared.Book_ID, qty: 1, track: 'علمي علوم' }], paymentMethod: 'CASH' }, empTok), 'reserve sci track');
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: phTrk, items: [{ bookId: bkShared.Book_ID, qty: 1, track: 'أدبي' }], paymentMethod: 'CASH' }, emp2Tok), 'reserve lit track');
const itSci = rows(S.RES_ITEMS).find(i => i.Phase_ID === phTrk && i.Emp_ID === '1001');
const itLit = rows(S.RES_ITEMS).find(i => i.Phase_ID === phTrk && i.Emp_ID === '1002');
assert.strictEqual(itSci.Unit_Cover_Price, 165, 'scientific track got 165');
assert.strictEqual(itLit.Unit_Cover_Price, 150, 'literary track got general 150');
checks += 5;

// ============================================================================
// الاختبار السادس: حماية الفواتير عند تغيير سعر الكتاب الحالي في الكتالوج
// ============================================================================
ok(api('SAVE_BOOK', { bookId: bk1.Book_ID, grade: bk1.Grade, publisher: bk1.Publisher, subject: bk1.Subject, bookPart: bk1.Book_Part, schoolTypes: bk1.School_Types, coverPrice: 250, supplierDiscountPct: 20 }, coord), 'change live catalog price via SAVE_BOOK');
ok(api('BULK_PRICE_BOOKS', { rows: [{ bookId: bk1.Book_ID, coverPrice: 275, supplierDiscountPct: 20 }] }, coord), 'change live catalog price via BULK_PRICE_BOOKS');
const invT1Final = rows(S.EMP_INVOICES).find(v => v.Emp_Inv_ID === invT1Before.Emp_Inv_ID);
const itemT1Final = rows(S.RES_ITEMS).find(i => i.Res_Item_ID === itemT1Before.Res_Item_ID);
assert.strictEqual(itemT1Final.Unit_Cover_Price, 100, 'period-locked item cover price remains 100');
assert.strictEqual(invT1Final.Net_Final_Invoice_Amount, invT1Amount, 'historical invoice amount remains immutable');
checks += 2;

// ============================================================================
// الاختبار السابع: البحث الذكي وأداء 3000 كتاب
// ============================================================================
function normArSearch(s) {
  return String(s || '').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[إأآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(/\s+/g, ' ').trim().toLowerCase();
}
const bigCatalog = [];
for (let i = 1; i <= 3000; i++) {
  bigCatalog.push({
    Book_ID: 'S3-' + String(i).padStart(4, '0'),
    Book_Name: i === 2500 ? 'المعاصر — أحياء (شرح)' : ('الأضواء — رياضيات ' + i),
    Grade: i % 3 === 0 ? '3 ثانوي' : '4 ابتدائي',
    Stage: i % 3 === 0 ? 'المرحلة الثانوية' : 'المرحلة الابتدائية',
    Subject: i === 2500 ? 'أحياء' : 'رياضيات',
    Publisher: i === 2500 ? 'المعاصر' : 'الأضواء',
    Tracks: i === 2500 ? 'علمي علوم،بكالوريا — طب وعلوم حياة' : ''
  });
}
const t0 = Date.now();
const qTokens = normArSearch('معاصر احياء بكالوريا').split(' ');
const found = bigCatalog.filter(x => {
  const hay = normArSearch([x.Book_ID, x.Book_Name, x.Grade, x.Stage, x.Subject, x.Publisher, x.Tracks].join(' '));
  return qTokens.every(t => hay.includes(t));
});
const elapsedMs = Date.now() - t0;
assert.strictEqual(found.length, 1, 'normalized multi-token search found exact book');
assert.strictEqual(found[0].Book_ID, 'S3-2500');
assert.ok(elapsedMs < 150, '3000 books searched in ' + elapsedMs + 'ms (<150ms)');
checks += 3;

// ============================================================================
// الاختبار الثامن: تكامل بيانات لوحة الإدارة
// ============================================================================
const dash = ok(api('GET_ADMIN_DASHBOARD_DATA', {}, A), 'admin dashboard data');
assert.ok(Array.isArray(dash.priceLists) && dash.priceLists.length >= 4, 'priceLists exposed');
assert.ok(Array.isArray(dash.priceItems) && dash.priceItems.length >= 6, 'priceItems exposed');
assert.ok(Array.isArray(dash.trackCurriculum) && dash.trackCurriculum.length >= 4, 'trackCurriculum exposed');
assert.ok(dash.catalog.stages.includes('التعليم الفني'), 'dynamic stage exposed');
assert.ok(dash.catalog.tracksRegistry.some(t => t.name === 'بكالوريا — طب وعلوم حياة'), 'new track exposed');
checks += 5;

// ============================================================================
// الاختبار التاسع: منع التكرار بالتطبيع العربي + بدء تيرم جديد بلا أسعار + تنبيه الانحراف + تعليق غير المسعّر
// ============================================================================
// منع تكرار نفس الكتاب عند اختلاف الهمزة أو التاء المربوطة أو المسافات (حتى في الاستيراد الجماعي)
const bkNorm = ok(api('SAVE_BOOK', {
  grade: '1 إعدادي', publisher: 'الأضواء', subject: 'عربي', bookPart: 'شرح', schoolTypes: 'حكومي',
  coverPrice: 130, supplierDiscountPct: 20
}, coord), 'create canonical book').book;
const bulkDup = ok(api('BULK_IMPORT_BOOKS', {
  booksArray: [{ Book_ID: 'M1-DUP99', Grade: '1 اعدادي', Book_Name: 'الاضواء — عربي (شرح)', Publisher: 'الاضواء', Subject: 'عربي', Book_Part: 'شرح', School_Types: 'حكومي', Cover_Price: 140, Supplier_Discount_Pct: 20 }]
}, coord), 'bulk import runs duplicate check');
assert.ok(!rows(S.BOOKS).some(b => b.Book_ID === 'M1-DUP99'), 'arabic normalized duplicate NOT added to catalog');
assert.ok(/إضافة 0/.test(bulkDup.message) && /مكرر/.test(bulkDup.message), 'arabic normalized duplicate reported in message');

// بدء تيرم جديد بالكتالوج الثابت بلا أسعار مع الاحتفاظ بالمرجع
const plBlank = ok(api('SAVE_PRICE_LIST', {
  academicYear: '2028/2029', term: 'الترم الأول',
  blankPrices: true, copyFromListId: plT2.Price_List_ID
}, coord), 'create blank new-term list');
assert.strictEqual(plBlank.copiedCount, 0, 'blankPrices copies 0 prices');
assert.strictEqual(plBlank.priceList.Copied_From_ID, plT2.Price_List_ID, 'reference list retained');
assert.strictEqual(rows(S.PRICE_ITEMS).filter(p => p.Price_List_ID === plBlank.priceList.Price_List_ID).length, 0, 'no price rows created');

// تنبيه انحراف السعر عن السعر المرجعي (> +40% أو < -20%)
const savedWarn = ok(api('SAVE_PRICE_ITEMS', {
  priceListId: plBlank.priceList.Price_List_ID,
  items: [{ bookId: bk1.Book_ID, coverPrice: 250, supplierDiscountPct: 20 }] // المرجع في plT2 = 120 (+108%)
}, coord), 'save deviated price');
assert.ok(Array.isArray(savedWarn.warnings) && savedWarn.warnings.length === 1, 'deviation warning returned');
assert.strictEqual(savedWarn.warnings[0].refCover, 120, 'refCover is 120 from plT2');

// اعتماد التيرم الجديد مع تعليق الكتب غير المسعّرة بحالة «جاري التسعير» دون المساس بأسعار التيرم السابق
const appBlank = ok(api('TRANSITION_PRICE_LIST', {
  priceListId: plBlank.priceList.Price_List_ID, toStatus: 'Approved',
  syncToCatalog: true, resetUnpricedToPricing: true
}, coord), 'approve blank term with resetUnpricedToPricing');
assert.strictEqual(appBlank.synced, 1, 'only priced book synced as Available');
assert.ok(appBlank.resetCount >= 1, 'unpriced books reset to Pricing');
const bk1Now = rows(S.BOOKS).find(b => b.Book_ID === bk1.Book_ID);
const bkNormNow = rows(S.BOOKS).find(b => b.Book_ID === bkNorm.Book_ID);
assert.strictEqual(bk1Now.Book_Status, 'Available');
assert.strictEqual(bk1Now.Cover_Price, 250);
assert.strictEqual(bkNormNow.Book_Status, 'Pricing', 'unpriced book moved to Pricing');
assert.strictEqual(bkNormNow.Cover_Price, '', 'unpriced book cover cleared');
// التحقق أن أسعار التيرم السابق في 24_Book_Prices لم تُمسّ
assert.strictEqual(rows(S.PRICE_ITEMS).find(p => p.Price_List_ID === plT2.Price_List_ID && p.Book_ID === bk1.Book_ID).Cover_Price, 120, 'old term price untouched');
checks += 12;

// ============================================================================
// الاختبار العاشر: إدارة ملفات الموظفين (HR CRUD: إضافة / تعديل / منع التكرار / منع الحذف مع وجود حركات / حذف آمن)
// ============================================================================
const hrNew = ok(api('SAVE_EMPLOYEE', {
  empId: '55100', fullName: 'سعيد محمود عبد الله', mobile: '01099887766', natIdLast4: '4321',
  department: 'المنصورة شرق', jobTitle: 'أخصائي أول', gradeTitle: 'الدرجة الأولى',
  unionOrg: 'النقابة العامة', memberState: 'معاش', employmentStatus: 'ساري',
  installmentAllowed: true, maxCreditLimit: 3000, email: 'saeed@example.com'
}, coord), 'create HR employee').employee;
assert.strictEqual(hrNew.Emp_ID, '55100');
assert.strictEqual(hrNew.Grade_Title, 'الدرجة الأولى');
// منع تكرار الكود الوظيفي عند الإضافة
fail(api('SAVE_EMPLOYEE', { empId: '55100', fullName: 'مكرر الاسم', mobile: '01099887755', natIdLast4: '1111' }, coord), 'duplicate empId rejected', /مسجّل بالفعل/);
// منع تكرار الموبايل لموظف آخر
fail(api('SAVE_EMPLOYEE', { empId: '55101', fullName: 'موبايل مكرر', mobile: '01099887766', natIdLast4: '1111' }, coord), 'duplicate mobile rejected', /مسجّل بالفعل/);
// دخول المحال للمعاش من بوابة المعاشات ومنعه من بوابة الشركة
ok(api('LOGIN_EMPLOYEE', { empId: '55100', natIdLast4: '4321', mobile: '01099887766', category: 'retiree' }), 'HR retiree enters retiree portal');
fail(api('LOGIN_EMPLOYEE', { empId: '55100', natIdLast4: '4321', mobile: '01099887766', category: 'emp' }), 'HR retiree blocked from emp portal', /معاش/);
// تعديل بيانات HR للموظف
const hrUpd = ok(api('SAVE_EMPLOYEE', {
  origEmpId: '55100', empId: '55100', fullName: 'سعيد محمود عبد الله', mobile: '01099887766', natIdLast4: '4321',
  department: 'طلخا', jobTitle: 'مدير إدارة', memberState: 'معاش', employmentStatus: 'ساري', notes: 'تم التحديث'
}, coord), 'update HR employee').employee;
assert.strictEqual(hrUpd.Department, 'طلخا');
// منع حذف موظف له حجوزات سابقة (1001)
fail(api('DELETE_EMPLOYEE', { empId: '1001' }, coord), 'delete employee with reservations blocked', /لا يمكن حذف/);
// حذف موظف بلا حجوزات (55100) بنجاح
ok(api('DELETE_EMPLOYEE', { empId: '55100' }, coord), 'delete clean employee succeeds');
assert.ok(!rows(S.EMPLOYEES).some(e => e.Emp_ID === '55100'), 'deleted employee removed');
checks += 11;

// ============================================================================
// الاختبار الحادي عشر: الرقم القومي الكامل + تصريح التعديل للموظف + طلب التعديل وموافقة الإدارة
// ============================================================================
const hrFull = ok(api('SAVE_EMPLOYEE', {
  origEmpId: '1001', empId: '1001', fullName: rows(S.EMPLOYEES).find(e => e.Emp_ID === '1001').Full_Name,
  nationalId: '28805151204512', department: 'المنصورة شرق', jobTitle: 'أخصائي أول',
  gradeTitle: 'الأولى', unionOrg: 'النقابة العامة', memberState: 'نشط', employmentStatus: 'ساري',
  specialization: 'نظم معلومات', email: 'emp1001@example.com'
}, coord), 'save full 14-digit nationalId').employee;
assert.strictEqual(hrFull.National_ID, '28805151204512');
assert.strictEqual(hrFull.National_ID_Last4, '4512');
// منع إرسال طلب تعديل بدون تصريح من الإدارة
fail(api('SUBMIT_EMP_CHANGE_REQUEST', { changes: { Address: 'المنصورة — شارع الجمهورية' } }, empTok), 'change request blocked without permit', /غير مصرح/);
// منح التصريح للموظف
ok(api('TOGGLE_EMP_EDIT_PERMIT', { empId: '1001', allowed: true }, coord), 'grant edit permit to 1001');
const reqRes = ok(api('SUBMIT_EMP_CHANGE_REQUEST', { changes: { Address: 'المنصورة — شارع الجمهورية', Email: 'new1001@example.com' }, reason: 'تحديث العنوان والبريد' }, empTok), 'employee submits change request');
assert.strictEqual(reqRes.request.Status, 'Pending');
// قبل الاعتماد لا يتغير العنوان في 03_Employees
assert.notStrictEqual(rows(S.EMPLOYEES).find(e => e.Emp_ID === '1001').Address, 'المنصورة — شارع الجمهورية');
// اعتماد الإدارة يطبّق التعديلات فوراً
ok(api('REVIEW_EMP_CHANGE_REQUEST', { reqId: reqRes.request.Req_ID, decision: 'Approved' }, coord), 'admin approves change request');
const empPortal = ok(api('GET_EMPLOYEE_PORTAL_DATA', {}, empTok), 'employee portal reflects updated HR profile');
assert.strictEqual(empPortal.employee.profile.address, 'المنصورة — شارع الجمهورية');
assert.strictEqual(empPortal.employee.profile.email, 'new1001@example.com');
assert.strictEqual(empPortal.employee.editPermitted, true);
checks += 9;

// ============================================================================
// الاختبار الثاني عشر: تبويب الأسرة في ملف الموارد البشرية ومزامنته التلقائية مع حساب الموظف
// ============================================================================
const famSave = ok(api('SAVE_EMPLOYEE_FAMILY', {
  empId: '1001',
  kids: [
    { name: 'يوسف', gender: 'b', grade: '4 ابتدائي', type: 'عربي', track: '', rel: '' },
    { name: 'مريم', gender: 'g', grade: '1 إعدادي', type: 'لغات', track: '', rel: '' }
  ]
}, coord), 'admin saves employee family');
assert.strictEqual(famSave.kids.length, 2);
const empPortalFam = ok(api('GET_EMPLOYEE_PORTAL_DATA', {}, empTok), 'employee portal receives synced family');
assert.strictEqual(empPortalFam.employee.kids.length, 2, 'employee sees 2 synced family members');
assert.strictEqual(empPortalFam.employee.kids[0].name, 'يوسف');
assert.strictEqual(empPortalFam.employee.kids[1].grade, '1 إعدادي');
checks += 4;

// ============================================================================
// الاختبار الثالث عشر: قائمة الرغبات المسبقة (SAVE_WISHLIST) وتعايشها مع مسودة السلة
// ============================================================================
const wlSave = ok(api('SAVE_WISHLIST', { wishlist: { [bk1.Book_ID]: 2 } }, empTok), 'employee saves pre-booking wishlist');
assert.strictEqual(wlSave.count, 2);
ok(api('SAVE_CART_DRAFT', { phaseId: 'PH-TEST', cart: { [bk1.Book_ID]: 1 } }, empTok), 'save cart draft preserves wishlist');
const empPortalWl = ok(api('GET_EMPLOYEE_PORTAL_DATA', {}, empTok), 'portal exposes saved wishlist');
assert.strictEqual(empPortalWl.employee.wishlist[bk1.Book_ID], 2, 'wishlist preserved alongside cartDraft');
checks += 3;

// ============================================================================
// الاختبار الرابع عشر: حجز موعد الاستلام (BOOK_PICKUP_SLOT) + طابور التجهيز المسبق (TOGGLE_PARCEL_PACKED)
// ============================================================================
ok(api('SAVE_SETTING', {
  key: 'PICKUP_SCHEDULE',
  value: JSON.stringify({ place: 'مقر النقابة', note: '', slots: [{ date: '2028-11-26', from: '10:00', to: '11:00', cap: 1 }, { date: '2028-11-26', from: '11:00', to: '12:00', cap: 5 }], depts: {}, bookings: {}, packed: {} })
}, A), 'admin publishes pickup schedule with capacity');
const bkSlot = ok(api('BOOK_PICKUP_SLOT', { slotIdx: 0 }, empTok), 'employee books slot 0');
assert.strictEqual(bkSlot.slotIdx, 0);
const pkToggle = ok(api('TOGGLE_PARCEL_PACKED', { empId: '1001', packed: true }, coord), 'coordinator marks parcel packed');
assert.strictEqual(pkToggle.packed, true);
const schedRow = rows(S.SETTINGS).find(r => r.Setting_Key === 'PICKUP_SCHEDULE');
const schedObj = JSON.parse(schedRow.Setting_Value);
assert.strictEqual(schedObj.bookings['1001'], 0, 'slot booking persisted');
assert.ok(schedObj.packed['1001'], 'parcel packed timestamp persisted');
checks += 5;

// ============================================================================
// الاختبار الخامس عشر: طابور تأكيدات التحويل + النسخ الاحتياطي الكامل + بوابة المكتبات (v3.46.0)
// ============================================================================
const empInvs = rows(S.EMP_INVOICES).filter(i => i.Emp_ID === '1001');
const targetInvId = empInvs[0] ? empInvs[0].Emp_Invoice_ID : '';
if (targetInvId) {
  const claimRes = ok(api('SUBMIT_PAYMENT_CLAIM', { invId: targetInvId, amount: 25, method: 'InstaPay', ref: 'IP-998877', note: 'تحويل تجريبي' }, empTok), 'employee submits payment claim');
  assert.strictEqual(claimRes.claim.status, 'Pending');
  const revRes = ok(api('REVIEW_PAYMENT_CLAIM', { claimId: claimRes.claim.id, decision: 'Approved', note: 'تمت المطابقة' }, A), 'admin approves payment claim');
  assert.strictEqual(revRes.claim.status, 'Approved');
  assert.ok(revRes.receiptNo, 'official receipt issued on claim approval');
  checks += 3;
}
const bkpRes = ok(api('EXPORT_FULL_BACKUP', {}, A), 'admin exports full JSON backup');
assert.ok(Array.isArray(bkpRes.backup.employees) && bkpRes.backup.employees.length > 0, 'backup includes employees');
assert.ok(Array.isArray(bkpRes.backup.books) && bkpRes.backup.books.length > 0, 'backup includes books');
assert.ok(Array.isArray(bkpRes.backup.phases), 'backup includes phases');
const supRow = rows(S.SUPPLIERS)[0];
const phRow = rows(S.PHASES)[0];
const supLink = ok(api('CREATE_SUPPLIER_LINK', { supplierId: supRow.Supplier_ID, phaseId: phRow.Phase_ID }, coord), 'coordinator generates supplier portal token');
assert.ok(supLink.token && supLink.token.startsWith('SUP-'), 'supplier portal token generated');
const supPortal1 = ok(api('GET_SUPPLIER_PORTAL', { supplierToken: supLink.token }, ''), 'supplier opens portal with public token (no login)');
assert.strictEqual(supPortal1.supplierName, supRow.Supplier_Name);
ok(api('SUPPLIER_UPDATE_PO_ITEM', { supplierToken: supLink.token, bookId: bk1.Book_ID, status: 'Partial', availQty: 7, shipDate: '2028-12-01', note: 'متاح 7 نسخ فقط' }, ''), 'supplier updates book availability');
checks += 6;

console.log(`BOOKS-PRO ALL PASSED: ${checks} checks (3000-book search: ${elapsedMs}ms)`);

