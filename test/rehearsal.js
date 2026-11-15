// بروفة: 5 موظفين يمرّون بالدورة كاملة (حجز ← إغلاق ← توريد ← توزيع ← سداد ← تسليم ← مرتجع ← تقييم ← أقساط ← خزينة)
// node rehearsal.js — يطبع سرداً لكل خطوة ويتوقف عند أول فشل غير متوقع
const { makeContext } = require('./sb-mock');
const clock = { now: new Date(2026, 10, 5, 9).getTime() };
const at = (y, m, d, h = 9, mi = 0) => { clock.now = new Date(y, m - 1, d, h, mi).getTime(); };
const { ctx } = makeContext(clock);
const api = (a, p, t) => ctx.__api(a, p || {}, t);
const rows = n => ctx.__DB.getAllRecords(n), S = ctx.__S;
let steps = 0; const issues = [];
const ok = (r, l) => { if (!r.success) { console.error('✗', l, '→', r.message); process.exit(1); } steps++; console.log('✓', l, r.message ? '— ' + r.message : ''); return r; };
const expectFail = (r, l) => { if (r.success) { issues.push(l); console.log('⚠', l, '(نجحت وكان المفروض تُرفض)'); } else { steps++; console.log('✓', l, '← رُفضت:', r.message); } return r; };

ok(ctx.__init(true), 'تأسيس المنظومة');
const A = ok(api('LOGIN_ADMIN', { username: 'admin', password: 'Admin@2026' }), 'دخول المدير').sessionToken;
const coord = ok(api('LOGIN_ADMIN', { username: 'coord', password: 'Coord@2026' }), 'دخول المنسق').sessionToken;
const fin = ok(api('LOGIN_ADMIN', { username: 'finance', password: 'Finance@2026' }), 'دخول المالية').sessionToken;
const store = ok(api('LOGIN_ADMIN', { username: 'store', password: 'Store@2026' }), 'دخول المخزن').sessionToken;
ok(api('BULK_IMPORT_EMPLOYEES', { employeesArray: [
  { Emp_ID: '1004', Full_Name: 'منى عبد الله', National_ID_Last4: '7788', Mobile: '01011112222', Department: 'الشبكات' },
  { Emp_ID: '1005', Full_Name: 'كريم حسن', National_ID_Last4: '9900', Mobile: '01033334444', Department: 'خدمة العملاء' }] }, A), 'استيراد موظفين 1004 و1005');
expectFail(api('RESET_OPERATIONAL_DATA', { confirm: 'تصفير' }, coord), 'المنسق يحاول التصفير');

const E = {};
[['1001', '4512', '01012345678'], ['1002', '8834', '01122334455'], ['1003', '0921', '01233445566'], ['1004', '7788', '01011112222'], ['1005', '9900', '01033334444']]
  .forEach(([id, l4, m]) => { E[id] = ok(api('LOGIN_EMPLOYEE', { empId: id, natIdLast4: l4, mobile: m }), 'دخول الموظف ' + id).sessionToken; });

console.log('\n— الحجز —');
ok(api('SAVE_MY_KIDS', { kids: [{ name: 'محمد', gender: 'b', grade: '4 ابتدائي' }, { name: 'يوسف', grade: '3 ثانوي', rel: 'ابن أخت' }] }, E['1001']), '1001 يسجّل ابنه وابن أخته');
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-101', qty: 1 }, { bookId: 'BK-102', qty: 1 }, { bookId: 'BK-301', qty: 1, beneficiary: 'يوسف — ابن أخت' }], paymentMethod: 'INSTALLMENT', downPaymentType: 'PERCENTAGE', downPaymentInput: 25, installmentCount: 3 }, E['1001']), '1001 يحجز لابنه وابن أخته (تقسيط 3)');
at(2026, 11, 5, 10);
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-101', qty: 2 }], paymentMethod: 'CASH' }, E['1002']), '1002 يحجز نسختين كاش');
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-202', qty: 1 }], paymentMethod: 'CASH' }, E['1003']), '1003 يحجز');
ok(api('EMP_CANCEL_REQUEST', { phaseId: 'PH-01', reason: 'غيّرت رأيي' }, E['1003']), '1003 يلغي والحجز مفتوح (فوري)');
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-301', qty: 1 }, { bookId: 'BK-302', qty: 1 }], paymentMethod: 'INSTALLMENT', downPaymentType: 'PERCENTAGE', downPaymentInput: 30, installmentCount: 2 }, E['1004']), '1004 تحجز ثانوي (تقسيط)');
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-201', qty: 1 }, { bookId: 'BK-202', qty: 1 }], paymentMethod: 'CASH' }, E['1005']), '1005 يحجز إعدادي');
at(2026, 11, 6, 9);
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-101', qty: 2 }, { bookId: 'BK-102', qty: 1 }, { bookId: 'BK-301', qty: 1, beneficiary: 'يوسف — ابن أخت' }], paymentMethod: 'INSTALLMENT', downPaymentType: 'PERCENTAGE', downPaymentInput: 25, installmentCount: 3 }, E['1001']), '1001 يزوّد نسخة (توأم)');
expectFail(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-101', qty: 9 }], paymentMethod: 'CASH' }, E['1002']), '1002 يحجز 9 نسخ');
expectFail(api('GET_ADMIN_DASHBOARD_DATA', {}, E['1002']), 'موظف يفتح لوحة الإدارة');

const pp = ok(api('ADMIN_EMP_PORTAL', { empId: '1002', phaseId: 'PH-01' }, coord), 'المنسق يفتح بوابة 1002 للحجز نيابة عنه');
if (!pp.myReservationItems.length || pp.myReservationItems.some(i => i.Emp_ID !== '1002')) issues.push('بوابة النيابة أعادت بيانات غير الموظف');
ok(api('SAVE_MY_KIDS', { empId: '1002', kids: [{ name: 'ليلى', gender: 'g', grade: '4 ابتدائي' }] }, coord), 'المنسق يسجّل بنت 1002');
expectFail(api('ADMIN_EMP_PORTAL', { empId: '1002' }, E['1001']), 'موظف يفتح بوابة زميله');
expectFail(api('SAVE_MY_KIDS', { kids: [] }, A), 'حفظ أبناء من الإدارة بلا موظف');
// الشُّعب: كتاب أدبي فقط، وابن 3 ثانوي علمي رياضة
ok(api('SET_BOOK_TRACKS', { rows: [{ bookId: 'BK-302', tracks: ['علمي علوم', 'علمي رياضة'] }] }, coord), 'المنسق يحدد شعبة كتاب الفيزياء (علمي فقط)');
ok(api('SAVE_MY_KIDS', { kids: [{ name: 'سلمى', gender: 'g', grade: '3 ثانوي', type: 'لغات', track: 'أدبي' }] }, E['1005']), '1005 يسجّل بنته أدبي');
{ const pt = ok(api('GET_EMPLOYEE_PORTAL_DATA', {}, E['1005']), 'بوابة 1005 بالشعب');
  if (!pt.settings.GRADE_TRACKS || !pt.settings.GRADE_TRACKS['3 ثانوي']) issues.push('الشعب غير ظاهرة للموظف');
  if (pt.employee.kids[0].track !== 'أدبي') issues.push('شعبة الابن لم تُحفظ');
  if ((pt.books.find(b => b.Book_ID === 'BK-302') || {}).Tracks !== 'علمي علوم،علمي رياضة') issues.push('شعبة الكتاب لم تُحفظ'); }
console.log('\n— الإغلاق والتوريد —');
at(2027, 1, 2, 9);
expectFail(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-101', qty: 1 }], paymentMethod: 'CASH' }, E['1005']), 'حجز بعد انتهاء الموعد');
const po = ok(api('GENERATE_PO_SNAPSHOT', { phaseId: 'PH-01' }, coord), 'تجميد طلب التوريد');
console.log('   المطلوب من المكتبة:', po.snapshot.map(p => p.Book_ID + '×' + p.Net_Order_To_Supplier_Qty).join('، '));
ok(api('SUBMIT_SUPPLIER_INVOICE', { supplierId: 'SUP-01', phaseId: 'PH-01', supplierInvoiceNo: 'NOOR-1', invoiceDate: '2027-01-05', volumeDiscountPct: 5,
  items: po.snapshot.map(p => p.Book_ID === 'BK-201' ? { bookId: p.Book_ID, orderedQty: p.Net_Order_To_Supplier_Qty, receivedQty: 0, coverPrice: 150, itemDiscPct: 20, notPrinted: true }
    : { bookId: p.Book_ID, orderedQty: p.Net_Order_To_Supplier_Qty, receivedQty: p.Net_Order_To_Supplier_Qty, coverPrice: 0, itemDiscPct: 20 }) }, store), 'استلام فاتورة المكتبة (BK-201 لم يُطبع)');
ok(api('RUN_ALLOCATION_ENGINE', { phaseId: 'PH-01' }, coord), 'التوزيع بالأسبقية');
const inv = id => rows(S.EMP_INVOICES).find(i => i.Emp_ID === id);
['1001', '1002', '1003', '1004', '1005'].forEach(id => { const i = inv(id); console.log(`   ${id}: ${i ? `فاتورة ${i.Emp_Inv_ID} صافي ${i.Net_Final_Invoice_Amount} · مقدم ${i.Down_Payment_Required}` : 'لا فاتورة'}`); });
if (inv('1003')) issues.push('1003 ألغى ومع ذلك صدرت له فاتورة');

console.log('\n— السداد والتسليم —');
at(2027, 1, 7, 10);
expectFail(api('EXECUTE_BOOK_DELIVERY', { empId: '1001', phaseId: 'PH-01' }, store), 'تسليم 1001 قبل المقدم');
ok(api('RECORD_EMPLOYEE_PAYMENT', { empInvId: inv('1001').Emp_Inv_ID, amount: inv('1001').Down_Payment_Required, paymentMethod: 'INSTAPAY', transactionRef: 'IP-50001' }, fin), '1001 يدفع المقدم إنستاباي');
ok(api('RECORD_EMPLOYEE_PAYMENT', { empInvId: inv('1002').Emp_Inv_ID, amount: inv('1002').Net_Final_Invoice_Amount, paymentMethod: 'CASH' }, fin), '1002 يدفع كاش كامل');
ok(api('RECORD_EMPLOYEE_PAYMENT', { empInvId: inv('1004').Emp_Inv_ID, amount: inv('1004').Down_Payment_Required, paymentMethod: 'WALLET', transactionRef: 'W-7001' }, fin), '1004 تدفع المقدم محفظة');
ok(api('RECORD_EMPLOYEE_PAYMENT', { empInvId: inv('1005').Emp_Inv_ID, amount: inv('1005').Net_Final_Invoice_Amount, paymentMethod: 'CASH' }, fin), '1005 يدفع كاش');
['1001', '1002', '1004', '1005'].forEach(id => ok(api('EXECUTE_BOOK_DELIVERY', { empId: id, phaseId: 'PH-01', receivedBy: 'الموظف' }, store), 'تسليم ' + id));

console.log('\n— بعد الاستلام —');
at(2027, 1, 9, 10);
const ret = rows(S.RES_ITEMS).find(i => i.Emp_ID === '1004' && i.Book_ID === 'BK-302');
ok(api('EMP_RETURN_REQUEST', { resItemId: ret.Res_Item_ID, qty: 1, reason: 'اتجاب من المدرسة', condition: 'GOOD' }, E['1004']), '1004 تطلب مرتجع');
const before = inv('1004').Net_Final_Invoice_Amount;
ok(api('RESOLVE_RETURN_REQUEST', { resItemId: ret.Res_Item_ID, approve: true, condition: 'GOOD' }, coord), 'المنسق يعتمد المرتجع');
console.log(`   فاتورة 1004: ${before} ← ${inv('1004').Net_Final_Invoice_Amount} · رصيد مستحق ${inv('1004').Credit_Balance} · متبقٍ ${inv('1004').Remaining_Balance}`);
const res = id => rows(S.RES_HEADER).find(h => h.Emp_ID === id && h.Phase_ID === 'PH-01');
ok(api('EMP_FEEDBACK', { resId: res('1001').Res_ID, stars: 5, note: 'تجربة ممتازة' }, E['1001']), '1001 يقيّم 5 نجوم');
ok(api('EMP_FEEDBACK', { resId: res('1002').Res_ID, stars: 3, note: 'الطابور كان طويل' }, E['1002']), '1002 يقيّم 3 نجوم');
expectFail(api('EMP_FEEDBACK', { resId: res('1001').Res_ID, stars: 5 }, E['1002']), '1002 يقيّم حجز غيره');
expectFail(api('EMP_FEEDBACK', { resId: res('1002').Res_ID, stars: 9 }, E['1002']), 'تقييم 9 نجوم');
const w = rows(S.RES_ITEMS).find(i => i.Emp_ID === '1005' && i.Book_ID === 'BK-201');
console.log(`   1005: BK-201 مخصص ${w.Allocated_Qty} — ${w.Unallocated_Reason}`);
ok(api('WAITLIST_DECISION', { phaseId: 'PH-01', choice: 'carry' }, E['1005']), '1005 يختار «رحّلها للمرحلة الجاية»');

console.log('\n— الأقساط والخزينة —');
const its = rows(S.INSTALLMENTS).filter(i => i.Emp_Inv_ID === inv('1001').Emp_Inv_ID && Number(i.Remaining_Inst_Amount) > 0).sort((a, b) => String(a.Due_Date).localeCompare(b.Due_Date));
console.log('   أقساط 1001:', its.map(i => i.Due_Date.slice(0, 10) + ' = ' + i.Remaining_Inst_Amount).join(' · '));
at(2027, 3, 20, 10);
const late = rows(S.INSTALLMENTS).filter(i => Number(i.Remaining_Inst_Amount) > 0 && String(i.Due_Date).slice(0, 10) < '2027-03-20');
console.log(`   متأخرات يوم 20 مارس: ${late.length} قسط بإجمالي ${late.reduce((s, i) => s + Number(i.Remaining_Inst_Amount), 0)}`);
ok(api('RECORD_EMPLOYEE_PAYMENT', { empInvId: inv('1001').Emp_Inv_ID, amount: inv('1001').Remaining_Balance, paymentMethod: 'WALLET', transactionRef: 'W-7002' }, fin), '1001 يسدد الباقي كله');
console.log(`   1001: متبقٍ ${inv('1001').Remaining_Balance} · حالة ${inv('1001').Invoice_Status}`);
if (Number(inv('1004').Remaining_Balance) > 0) ok(api('RECORD_EMPLOYEE_PAYMENT', { empInvId: inv('1004').Emp_Inv_ID, amount: inv('1004').Remaining_Balance, paymentMethod: 'INSTAPAY', transactionRef: 'IP-50002' }, fin), '1004 تسدد الباقي');
const day = rows(S.EMP_PAYMENTS).filter(p => String(p.Payment_Date).startsWith('2027-03-20'));
const sys = {}; day.forEach(p => sys[p.Payment_Method] = (sys[p.Payment_Method] || 0) + Number(p.Amount));
ok(api('CLOSE_CASH_DAY', { date: '2027-03-20', counted: sys }, fin), 'إقفال خزينة 20 مارس بلا فروق');
expectFail(api('VOID_EMPLOYEE_PAYMENT', { receiptNo: day[0].Receipt_No, reason: 'تجربة' }, A), 'إلغاء إيصال بعد إقفال اليوم');

console.log('\n— الحساب الختامي —');
const pays = rows(S.EMP_PAYMENTS);
console.log(`   إيصالات: ${pays.map(p => p.Receipt_No).join('، ')}`);
const nums = pays.map(p => +String(p.Receipt_No).split('-').pop()).sort((a, b) => a - b);
if (nums.some((x, i) => x !== i + 1)) issues.push('فجوة في ترقيم الإيصالات: ' + nums.join(','));
ok(api('GET_SETTLEMENT_REPORT', {}, A), 'تقرير التصفية');
const portal = ok(api('GET_EMPLOYEE_PORTAL_DATA', {}, E['1001']), 'بوابة 1001 بعد كل ده');
console.log(`   1001 يشوف: ${portal.myInvoices.length} فاتورة · ${portal.myPayments.length} إيصال · تقييمه ${JSON.parse(portal.myReservations[0].Feedback || '{}').stars} نجوم`);
console.log(`\n${issues.length ? '⚠ ملاحظات: ' + issues.join(' | ') : 'بلا ملاحظات'}\nREHEARSAL DONE: ${steps} خطوة`);
