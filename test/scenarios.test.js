// دورة كاملة للمبادرة على محرك Supabase (مخزن في الذاكرة)
const assert = require('assert');
const { makeContext } = require('./sb-mock');

const clock = { now: new Date(2026, 10, 5, 9, 0, 0).getTime() }; // 5 نوفمبر 2026
const at = (y, m, d, h = 9, mi = 0, s = 0, ms = 0) => { clock.now = new Date(y, m - 1, d, h, mi, s, ms).getTime(); };
const { ctx, ss } = makeContext(clock);
const api = (a, p, t) => ctx.__api(a, p || {}, t);
let passed = 0;
const ok = (res, label) => { if (!res.success) { console.error('FAIL', label, res.message); process.exit(1); } passed++; return res; };
const fail = (res, label, re) => { if (res.success) { console.error('EXPECTED FAIL', label); process.exit(1); } if (re && !re.test(res.message)) { console.error('WRONG MSG', label, res.message); process.exit(1); } passed++; return res; };
const rows = name => ctx.__DB.getAllRecords(name);
const S = ctx.__S;

// 0) التأسيس
ok(ctx.__init(true), 'init');
assert.strictEqual(ss.getSheets().length, 22);
// ترقية آمنة عند التشغيل مرة ثانية
ok(ctx.__init(true), 'init again'); assert.strictEqual(rows(S.USERS).length, 4);

// 1) الدخول
fail(api('LOGIN_ADMIN', { username: 'admin', password: 'wrong' }), 'bad pass');
const adm = ok(api('LOGIN_ADMIN', { username: 'admin', password: 'Admin@2026' }), 'admin login');
assert.ok(adm.user.mustChangePassword);
const A = adm.sessionToken;
const coord = ok(api('LOGIN_ADMIN', { username: 'coord', password: 'Coord@2026' }), 'coord').sessionToken;
const fin = ok(api('LOGIN_ADMIN', { username: 'finance', password: 'Finance@2026' }), 'fin').sessionToken;
const store = ok(api('LOGIN_ADMIN', { username: 'store', password: 'Store@2026' }), 'store').sessionToken;
ok(api('CHANGE_PASSWORD', { oldPassword: 'Store@2026', newPassword: 'NewStore#2026' }, store), 'change pw');
fail(api('LOGIN_ADMIN', { username: 'store', password: 'Store@2026' }), 'old pw rejected');
// فصل المهام: المخزن لا يحصّل
fail(api('RECORD_EMPLOYEE_PAYMENT', { empInvId: 'x', amount: 1 }, store), 'store cannot collect', /صلاحية/);

const e1 = ok(api('LOGIN_EMPLOYEE', { empId: '1001', natIdLast4: '4512', mobile: '+20 101 234 5678' }), 'emp1 login (normalized mobile)').sessionToken;
const e2 = ok(api('LOGIN_EMPLOYEE', { empId: '1002', natIdLast4: '8834', mobile: '01122334455' }), 'emp2').sessionToken;
const e3 = ok(api('LOGIN_EMPLOYEE', { empId: '1003', natIdLast4: '0921', mobile: '01233445566' }), 'emp3 leading zero').sessionToken;
fail(api('GET_ADMIN_DASHBOARD_DATA', {}, e1), 'employee blocked from admin');
// أبنائي: حفظ وتحقق وترقية تلقائية مع السنة الدراسية الجديدة
fail(api('SAVE_MY_KIDS', { kids: [{ name: 'x', grade: 'صف وهمي' }] }, e1), 'kid bad grade', /صف/);
ok(api('SAVE_MY_KIDS', { kids: [{ name: 'محمد', gender: 'b', grade: '4 ابتدائي', type: 'لغات' }, { name: 'سارة', gender: 'g', grade: '3 ثانوي', type: '' }] }, e1), 'save kids');
assert.deepStrictEqual(ok(api('GET_EMPLOYEE_PORTAL_DATA', {}, e1), 'portal kids').employee.kids.map(k => k.grade + k.promoted), ['4 ابتدائي0', '3 ثانوي0']);
{ const sv = clock.now; clock.now = new Date(2027, 8, 1).getTime();
  const ks = ok(api('GET_EMPLOYEE_PORTAL_DATA', {}, e1), 'portal next year').employee.kids;
  assert.deepStrictEqual(ks.map(k => [k.grade, k.promoted, !!k.graduated]), [['5 ابتدائي', 1, false], ['', 1, true]]); clock.now = sv; }
fail(api('SAVE_MY_KIDS', { kids: [] }, adm.sessionToken), 'admin cannot save kids');
fail(api('SAVE_MY_KIDS', { kids: [{ name: '', grade: '1 ثانوي', rel: 'ابن أخ' }] }, e1), 'relative needs name', /اسم/);
ok(api('SAVE_MY_KIDS', { kids: [{ name: 'محمد', grade: '4 ابتدائي' }, { name: 'أحمد', grade: '1 ثانوي', type: 'أزهر', rel: 'ابن أخ' }] }, e1), 'save kid + relative');
assert.strictEqual(ok(api('GET_EMPLOYEE_PORTAL_DATA', {}, e1), 'portal rel').employee.kids[1].rel, 'ابن أخ'); passed++;
// شعار الناشر: روابط المخزن فقط، ويظهر للموظف
fail(api('SET_PUBLISHER_LOGO', { publisher: 'ناشر وهمي', url: '' }, adm.sessionToken), 'logo unknown pub', /الناشر/);
{ const pub = rows(S.BOOKS)[0].Publisher;
  fail(api('SET_PUBLISHER_LOGO', { publisher: pub, url: 'https://evil.com/x.webp' }, adm.sessionToken), 'logo bad url', /رابط/);
  ok(api('SET_PUBLISHER_LOGO', { publisher: pub, url: 'https://abc.supabase.co/storage/v1/object/public/book-covers/pub-0123abcd.webp?v=1' }, adm.sessionToken), 'logo set');
  ok(api('SET_PUBLISHER_LOGO', { publisher: pub + '|lang', url: 'https://abc.supabase.co/storage/v1/object/public/book-covers/pub-4567abcd.webp?v=1' }, adm.sessionToken), 'lang logo set');
  assert.ok(ok(api('GET_EMPLOYEE_PORTAL_DATA', {}, e1), 'portal logos').pubLogos[pub]); passed++; }

// 2) الحجز بالشرائح
at(2026, 11, 5, 9, 0, 0, 100);
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-101', qty: 1 }, { bookId: 'BK-201', qty: 1 }], paymentMethod: 'INSTALLMENT', downPaymentType: 'PERCENTAGE', downPaymentInput: 25, installmentCount: 2 }, e1), 'e1 book');
at(2026, 11, 5, 10);
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-101', qty: 2 }], paymentMethod: 'CASH' }, e2), 'e2 book');
at(2026, 11, 6, 8);
// الموظف 1 يزيد BK-101 إلى 2: النسخة الأولى تحتفظ بوقت 5/11 9:00 والثانية بوقت 6/11
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-101', qty: 2 }, { bookId: 'BK-201', qty: 1 }], paymentMethod: 'INSTALLMENT', downPaymentType: 'PERCENTAGE', downPaymentInput: 25, installmentCount: 2 }, e1), 'e1 increase');
let e1Items = rows(S.RES_ITEMS).filter(i => i.Emp_ID === '1001' && i.Book_ID === 'BK-101');
assert.strictEqual(e1Items.length, 2);
assert.ok(e1Items.find(i => i.Tranche_No == 1).Priority_Timestamp.startsWith('2026-11-05 09:00:00.100'));
assert.ok(e1Items.find(i => i.Tranche_No == 2).Priority_Timestamp.startsWith('2026-11-06'));
at(2026, 11, 6, 9);
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-101', qty: 1 }], paymentMethod: 'CASH' }, e3), 'e3 book');
assert.strictEqual(ok(api('GET_EMPLOYEE_PORTAL_DATA', {}, e3), 'portal pop').books.find(b => b.Book_ID === 'BK-101').Pop, 3); passed++;
// القواعد
fail(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-101', qty: 4 }], paymentMethod: 'CASH' }, e3), 'max per book', /أقصى عدد/);
fail(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-301', qty: 1 }], paymentMethod: 'INSTALLMENT', downPaymentType: 'PERCENTAGE', downPaymentInput: 5, installmentCount: 2 }, e3), 'min down', /مقدم/);
fail(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-301', qty: 1 }], paymentMethod: 'INSTALLMENT', downPaymentType: 'PERCENTAGE', downPaymentInput: 25, installmentCount: 9 }, e3), 'max inst', /الأقساط/);
// تخفيض الموظف 1 لا يفقد أسبقية الشريحة الأولى
at(2026, 11, 7, 9);
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-101', qty: 2 }, { bookId: 'BK-201', qty: 1 }], paymentMethod: 'INSTALLMENT', downPaymentType: 'PERCENTAGE', downPaymentInput: 25, installmentCount: 2 }, e1), 'e1 same');
assert.strictEqual(rows(S.RES_AUDIT).filter(r => r.Emp_ID === '1001').length, 3);

// 3) لا تجميد للحصر والحجز مفتوح
fail(api('GENERATE_PO_SNAPSHOT', { phaseId: 'PH-01' }, coord), 'po while open', /أغلق الحجز/);
// انتهاء موعد الحجز ⇒ مغلق تلقائياً
at(2027, 1, 2, 9);
fail(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-01', items: [{ bookId: 'BK-101', qty: 1 }], paymentMethod: 'CASH' }, e1), 'booking after end', /مغلقة/);
// رصيد افتتاحي متبقٍ: نسخة واحدة BK-101 في المخزن (مثل مرتجع من موسم سابق)
ctx.__DB.insertRecordsBatch(S.INVENTORY, [{ Trans_ID: 'OPEN-1', Trans_Timestamp: '2027-01-01 08:00:00', Phase_ID: 'PH-00', Book_ID: 'BK-101', Batch_Ref_ID: 'PH-00', Movement_Type: 'OPENING_CARRYOVER', Qty_Change: 1, Unit_Actual_Cost: 102.6, Reference_Doc_ID: 'OPEN', Recorded_By: 'test', Notes: '' }]);
const po = ok(api('GENERATE_PO_SNAPSHOT', { phaseId: 'PH-01' }, coord), 'po');
const po101 = po.snapshot.find(p => p.Book_ID === 'BK-101');
assert.deepStrictEqual([po101.Total_Requested_Qty, po101.Carryover_Stock_Qty, po101.Net_Order_To_Supplier_Qty], [5, 1, 4]);

// 4) فاتورة ناقصة: BK-101 طلبنا 4، وصل 2 سليم + 1 تالف، BK-201 لم يُطبع
const inv = ok(api('SUBMIT_SUPPLIER_INVOICE', { supplierId: 'SUP-01', phaseId: 'PH-01', supplierInvoiceNo: 'N-100', invoiceDate: '2027-01-05', volumeDiscountPct: 5,
  items: [{ bookId: 'BK-101', orderedQty: 4, receivedQty: 2, damagedQty: 1, coverPrice: 135, itemDiscPct: 20 }, { bookId: 'BK-201', orderedQty: 1, receivedQty: 0, coverPrice: 150, itemDiscPct: 20, notPrinted: true }] }, store), 'sup inv');
// 3 مفوترة × 108 = 324؛ خصم كمية 5% = 16.2 ⇒ 307.8؛ مطالبة تالف 102.6
assert.strictEqual(inv.invoiceHeader.Net_Payable_Amount, 307.8);
assert.strictEqual(inv.invoiceHeader.Damaged_Claim_Amount, 102.6);
fail(api('SUBMIT_SUPPLIER_INVOICE', { supplierId: 'SUP-01', phaseId: 'PH-01', supplierInvoiceNo: 'N-100', items: [{ bookId: 'BK-101', receivedQty: 1 }] }, store), 'dup inv', /من قبل/);
assert.strictEqual(rows(S.PO_SNAPSHOT).find(p => p.Book_ID === 'BK-101').Outstanding_Qty, 2);

// 5) التوزيع بالأسبقية: المتاح 3 نسخ BK-101 (1 افتتاحي + 2)
const al = ok(api('RUN_ALLOCATION_ENGINE', { phaseId: 'PH-01' }, coord), 'alloc');
const it = rows(S.RES_ITEMS);
const get = (emp, book, t) => it.find(i => i.Emp_ID === emp && i.Book_ID === book && (t === undefined || i.Tranche_No == t));
// الترتيب: e1-T1 (5/11 9:00) ، e2 (5/11 10:00، نسختان) ، e1-T2 (6/11) ، e3 (6/11 9:00)
assert.strictEqual(get('1001', 'BK-101', 1).Allocated_Qty, 1);
assert.strictEqual(get('1002', 'BK-101').Allocated_Qty, 2);
assert.strictEqual(get('1001', 'BK-101', 2).Allocated_Qty, 0);
assert.strictEqual(get('1003', 'BK-101').Allocated_Qty, 0);
assert.strictEqual(get('1001', 'BK-201').Unallocated_Reason, 'الكتاب لم يُطبع بعد');
// التوزيع مرة أخرى يعطي نفس النتيجة
ok(api('RUN_ALLOCATION_ENGINE', { phaseId: 'PH-01' }, coord), 'alloc idempotent');
assert.strictEqual(rows(S.RES_ITEMS).filter(i => i.Book_ID === 'BK-101').reduce((s, i) => s + Number(i.Allocated_Qty), 0), 3);

// 6) الفواتير: e1 مخصص 1 × 111 = 111 ، تقسيط 25% ⇒ مقدم 28
let invs = rows(S.EMP_INVOICES);
const inv1 = invs.find(i => i.Emp_ID === '1001');
assert.strictEqual(inv1.Net_Final_Invoice_Amount, 111);
assert.strictEqual(inv1.Down_Payment_Required, 28);
const inv2 = invs.find(i => i.Emp_ID === '1002');
assert.strictEqual(inv2.Net_Final_Invoice_Amount, 222);
assert.strictEqual(inv2.Down_Payment_Required, 222); // دفع كامل
assert.ok(!invs.find(i => i.Emp_ID === '1003'), 'no invoice for zero allocation');

// 7) التسليم بشروط
fail(api('EXECUTE_BOOK_DELIVERY', { empId: '1001', phaseId: 'PH-01' }, store), 'deliver before down', /المقدم/);
fail(api('RECORD_EMPLOYEE_PAYMENT', { empInvId: inv1.Emp_Inv_ID, amount: 500, paymentMethod: 'CASH' }, fin), 'overpay', /أكبر من المتبقي/);
fail(api('RECORD_EMPLOYEE_PAYMENT', { empInvId: inv1.Emp_Inv_ID, amount: 28, paymentMethod: 'INSTAPAY' }, fin), 'instapay no ref', /مرجع/);
const p1 = ok(api('RECORD_EMPLOYEE_PAYMENT', { empInvId: inv1.Emp_Inv_ID, amount: 28, paymentMethod: 'INSTAPAY', transactionRef: 'IP998877' }, fin), 'pay down');
assert.strictEqual(p1.receiptNo, 'RCP-2027-00001');
fail(api('RECORD_EMPLOYEE_PAYMENT', { empInvId: inv2.Emp_Inv_ID, amount: 10, paymentMethod: 'INSTAPAY', transactionRef: 'IP998877' }, fin), 'dup ref', /مسجَّل/);
const d1 = ok(api('EXECUTE_BOOK_DELIVERY', { empId: '1001', phaseId: 'PH-01', receivedBy: 'الموظف' }, store), 'deliver e1');
assert.strictEqual(d1.receiptNo, 'DLV-2027-00001');
ok(api('RECORD_EMPLOYEE_PAYMENT', { empInvId: inv2.Emp_Inv_ID, amount: 222, paymentMethod: 'CASH' }, fin), 'pay e2 full');
ok(api('EXECUTE_BOOK_DELIVERY', { empId: '1002', phaseId: 'PH-01' }, store), 'deliver e2');

// 8) مرتجع: e2 يرجع نسخة خلال المدة ⇒ فاتورته 111 ورصيد دائن 111
at(2027, 1, 7, 9);
ok(api('RECORD_BOOK_RETURN', { returnType: 'EMP_RETURN', resItemId: get('1002', 'BK-101').Res_Item_ID, qty: 1, reason: 'مكرر' }, store), 'emp return');
const inv2b = rows(S.EMP_INVOICES).find(i => i.Emp_ID === '1002');
assert.strictEqual(inv2b.Net_Final_Invoice_Amount, 111);
assert.strictEqual(inv2b.Credit_Balance, 111);
assert.strictEqual(inv2b.Invoice_Status, 'Refund_Due');
ok(api('REFUND_EMPLOYEE_CREDIT', { empInvId: inv2b.Emp_Inv_ID }, fin), 'refund');
assert.strictEqual(rows(S.EMP_INVOICES).find(i => i.Emp_ID === '1002').Invoice_Status, 'Paid_In_Full');
// النسخة المرتجعة تذهب للمنتظر التالي (e1 الشريحة 2)
ok(api('RUN_ALLOCATION_ENGINE', { phaseId: 'PH-01' }, coord), 'realloc after return');
assert.strictEqual(rows(S.RES_ITEMS).find(i => i.Emp_ID === '1001' && i.Book_ID === 'BK-101' && i.Tranche_No == 2).Allocated_Qty, 1);
assert.strictEqual(rows(S.RES_ITEMS).find(i => i.Emp_ID === '1003').Allocated_Qty, 0);
// انتهاء مدة المرتجع
at(2027, 1, 20, 9);
fail(api('RECORD_BOOK_RETURN', { returnType: 'EMP_RETURN', resItemId: get('1001', 'BK-101', 1).Res_Item_ID, qty: 1 }, store), 'return window', /مدة المرتجع/);

// 9) إلغاء إيصال بعد الإقفال ممنوع
at(2027, 1, 5, 18);
ok(api('CLOSE_CASH_DAY', { date: '2027-01-07', counted: { CASH: 222 } }, fin), 'close day'); // اليوم الذي فيه دفعة e2 النقدية (تم في 7/1؟)
// إيصال e1 بتاريخ 2027-01-02
const voidRes = api('VOID_EMPLOYEE_PAYMENT', { receiptNo: 'RCP-2027-00001', reason: 'اختبار' }, fin);
fail(voidRes, 'finance cannot void', /صلاحية/);

// 10) المرحلة الثانية + ترحيل المنتظرين بأسبقيتهم
at(2027, 1, 21, 9);
ok(api('SAVE_PHASE', { phaseId: 'PH-02', phaseName: 'المرحلة الثانية', startDate: '2027-01-21', endDate: '2027-01-31' }, coord), 'phase 2');
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-02', items: [{ bookId: 'BK-101', qty: 1 }], paymentMethod: 'CASH' }, e2), 'e2 books phase2');
const carry = ok(api('CARRY_WAITLIST_TO_PHASE', { fromPhaseId: 'PH-01', toPhaseId: 'PH-02' }, coord), 'carry');
const c3 = rows(S.RES_ITEMS).find(i => i.Emp_ID === '1003' && i.Phase_ID === 'PH-02');
assert.ok(c3.Priority_Timestamp.startsWith('2026-11-06 09:00'), 'carried keeps old priority');
at(2027, 2, 2, 9);
const po2 = ok(api('GENERATE_PO_SNAPSHOT', { phaseId: 'PH-02' }, coord), 'po2');
// احتياج PH-02 لـ BK-101 = e3 (1) + e2 (1) = 2؛ المكتبة ما زالت مدينة بنسختين من PH-01 ⇒ لا طلب جديد
const l = po2.snapshot.find(p => p.Book_ID === 'BK-101');
assert.deepStrictEqual([l.Total_Requested_Qty, l.Pending_From_Previous_Qty, l.Net_Order_To_Supplier_Qty], [2, 2, 0]);
// المكتبة تورّد النسختين على فاتورة المرحلة الثانية
ok(api('SUBMIT_SUPPLIER_INVOICE', { supplierId: 'SUP-01', phaseId: 'PH-02', supplierInvoiceNo: 'N-200', items: [{ bookId: 'BK-101', orderedQty: 0, receivedQty: 2 }] }, store), 'sup inv 2');
assert.strictEqual(rows(S.PO_SNAPSHOT).find(p => p.PO_ID === 'PO-PH-01-BK-101').Line_Status, 'Fulfilled');
ok(api('RUN_ALLOCATION_ENGINE', { phaseId: 'PH-02' }, coord), 'alloc 2');
const ph2 = rows(S.RES_ITEMS).filter(i => i.Phase_ID === 'PH-02' && i.Book_ID === 'BK-101');
assert.strictEqual(ph2.find(i => i.Emp_ID === '1003').Allocated_Qty, 1, 'e3 first by original priority');
assert.strictEqual(ph2.find(i => i.Emp_ID === '1002').Allocated_Qty, 1);

// 11) BK-201 لن يُطبع: إلغاء النواقص
const po201 = rows(S.PO_SNAPSHOT).find(p => p.Book_ID === 'BK-201');
ok(api('CANCEL_PO_BACKORDER', { poId: po201.PO_ID, reason: 'الناشر أوقف الطبعة' }, coord), 'cancel backorder');
ok(api('CANCEL_UNDELIVERED_QTY', { resItemId: rows(S.RES_ITEMS).find(i => i.Emp_ID === '1001' && i.Book_ID === 'BK-201' && i.Phase_ID === 'PH-02').Res_Item_ID, qty: 1, reason: 'لم يُطبع' }, coord), 'cancel e1 BK-201');

// 12) مصروفات، دفعات للمكتبة، مرتجع للمكتبة
ok(api('RECORD_INITIATIVE_EXPENSE', { category: 'مصاريف شحن ونقل', amount: 150, beneficiary: 'سيارة نقل', phaseId: 'PH-01' }, fin), 'expense');
fail(api('RECORD_INITIATIVE_EXPENSE', { category: 'هدايا', amount: 150, beneficiary: 'x' }, fin), 'bad category');
fail(api('RECORD_SUPPLIER_PAYMENT', { supplierId: 'SUP-01', amount: 99999, docRef: 'T1' }, fin), 'overpay supplier', /أكبر من المستحق/);
ok(api('RECORD_SUPPLIER_PAYMENT', { supplierId: 'SUP-01', amount: 200, docRef: 'إيصال 55' }, fin), 'pay supplier');

// 13) تقرير التصفية
const rep = ok(api('GET_SETTLEMENT_REPORT', {}, A), 'settlement');
console.log(JSON.stringify({ pnl: rep.pnl, supplier: rep.supplier, cash: rep.cash, stock: { qty: rep.stock.qty, value: rep.stock.value }, checklist: rep.checklist.map(c => (c.ok ? '✓ ' : '✗ ') + c.item + ': ' + c.value) }, null, 1));
// رصيد المكتبة: 307.8 + (2×102.6=205.2) − 102.6 تالف − 200 مدفوع = 210.4
assert.strictEqual(rep.supplier.balance, 210.4);
// النقدية: 28 + 222 − 111 رد − 200 − 150 = −211
assert.strictEqual(rep.cash.expectedCashOnHand, -211);

// 14) المهمة اليومية وتحديث الأقساط المتأخرة
at(2027, 4, 15, 9);
ctx.__job();
const lateInst = rows(S.INSTALLMENTS).filter(i => i.Status === 'Overdue');
assert.ok(lateInst.length > 0, 'overdue marked');
fail(api('EXECUTE_BOOK_DELIVERY', { empId: '1001', phaseId: 'PH-01' }, store), 'blocked by overdue? or nothing left');

// 15) المخزن لا يصبح سالباً، وأرقام النصوص تحتفظ بأصفارها
assert.ok(rows(S.EMPLOYEES).find(e => e.Emp_ID === '1003').National_ID_Last4 === '0921');
const neg = Object.entries(api('GET_ADMIN_DASHBOARD_DATA', {}, A).stockMap).filter(([, v]) => v.onHand < 0);
assert.strictEqual(neg.length, 0);

// 16) المدير يلغي إيصالاً في يوم غير مُقفل ⇒ يعود الرصيد
const before = rows(S.EMP_INVOICES).find(i => i.Emp_ID === '1001' && i.Phase_ID === 'PH-01').Remaining_Balance;
ok(api('VOID_EMPLOYEE_PAYMENT', { receiptNo: 'RCP-2027-00001', reason: 'رقم مرجع خاطئ' }, A), 'admin void');
assert.strictEqual(rows(S.EMP_INVOICES).find(i => i.Emp_ID === '1001' && i.Phase_ID === 'PH-01').Remaining_Balance, before + 28);
fail(api('VOID_EMPLOYEE_PAYMENT', { receiptNo: 'RCP-2027-00001', reason: 'x' }, A), 'double void', /ملغى/);
// 17) الحد الائتماني
ok(api('SAVE_PHASE', { phaseId: 'PH-03', phaseName: 'ملحق', startDate: '2027-04-01', endDate: '2027-04-30' }, coord), 'ph3');
ctx.__DB.updateRecordByPK(S.EMPLOYEES, 'Emp_ID', '1003', { Max_Credit_Limit: 300 });
fail(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-03', items: [{ bookId: 'BK-302', qty: 2 }], paymentMethod: 'INSTALLMENT', downPaymentType: 'PERCENTAGE', downPaymentInput: 20, installmentCount: 2 }, e3), 'credit limit', /الحد الائتماني/);

// 18) الحجز لقريب + الحجز نيابة عن موظف من الإدارة
ok(api('SET_PHASE_STATUS', { phaseId: 'PH-03', status: 'Open' }, coord), 'open ph3');
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-03', items: [{ bookId: 'BK-302', qty: 1 }, { bookId: 'BK-302', qty: 2, beneficiary: 'أحمد — ابن أخ' }], paymentMethod: 'CASH' }, e1), 'relative booking');
const relItems = rows(S.RES_ITEMS).filter(i => i.Emp_ID === '1001' && i.Phase_ID === 'PH-03');
assert.strictEqual(relItems.find(i => i.Beneficiary === 'أحمد — ابن أخ').Requested_Qty, 2);
assert.strictEqual(relItems.find(i => i.Beneficiary === '').Requested_Qty, 1);
assert.strictEqual(new Set(relItems.map(i => i.Res_Item_ID)).size, relItems.length);
fail(api('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-03', items: [{ bookId: 'BK-302', qty: 4, beneficiary: 'س' }], paymentMethod: 'CASH' }, e1), 'max per beneficiary', /أقصى عدد/);
// الإدارة تضيف حجزاً لموظف ثم تعدّله ثم تحذفه
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { empId: '1002', phaseId: 'PH-03', items: [{ bookId: 'BK-302', qty: 1 }], paymentMethod: 'CASH' }, coord), 'admin adds reservation');
assert.ok(rows(S.RES_HEADER).find(h => h.Emp_ID === '1002' && h.Phase_ID === 'PH-03').Created_By);
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { empId: '1002', phaseId: 'PH-03', items: [{ bookId: 'BK-302', qty: 2 }], paymentMethod: 'CASH' }, coord), 'admin edits reservation');
assert.strictEqual(rows(S.RES_ITEMS).filter(i => i.Emp_ID === '1002' && i.Phase_ID === 'PH-03').reduce((s, i) => s + i.Requested_Qty, 0), 2);
ok(api('SUBMIT_OR_UPDATE_RESERVATION', { empId: '1002', phaseId: 'PH-03', items: [], paymentMethod: 'CASH' }, coord), 'admin deletes reservation');
assert.strictEqual(rows(S.RES_HEADER).find(h => h.Emp_ID === '1002' && h.Phase_ID === 'PH-03').Res_Status, 'Cancelled');
fail(api('SUBMIT_OR_UPDATE_RESERVATION', { empId: '1002', phaseId: 'PH-03', items: [] }, fin), 'finance cannot book', /صلاحية/);

// 19) تعديل فاتورة وحذفها
const invA = rows(S.EMP_INVOICES).find(i => i.Emp_ID === '1002' && i.Phase_ID === 'PH-01');
const net0 = invA.Net_Final_Invoice_Amount;
fail(api('ADJUST_EMP_INVOICE', { invId: invA.Emp_Inv_ID, amount: -10 }, fin), 'adjust needs reason', /سبب/);
ok(api('ADJUST_EMP_INVOICE', { invId: invA.Emp_Inv_ID, amount: -10, reason: 'خصم تأخير توريد' }, fin), 'adjust invoice');
assert.strictEqual(rows(S.EMP_INVOICES).find(i => i.Emp_Inv_ID === invA.Emp_Inv_ID).Net_Final_Invoice_Amount, net0 - 10);
ok(api('ADJUST_EMP_INVOICE', { invId: invA.Emp_Inv_ID, amount: 0 }, fin), 'reset adjust');
assert.strictEqual(rows(S.EMP_INVOICES).find(i => i.Emp_Inv_ID === invA.Emp_Inv_ID).Net_Final_Invoice_Amount, net0);
fail(api('DELETE_EMP_INVOICE', { invId: invA.Emp_Inv_ID, reason: 'x' }, fin), 'only admin deletes', /صلاحية/);
const anyDeliveredOrPaid = rows(S.EMP_PAYMENTS).some(p => p.Emp_Inv_ID === invA.Emp_Inv_ID && !p.Is_Voided) || rows(S.RES_ITEMS).some(i => i.Res_ID === invA.Res_ID && i.Delivered_Qty - i.Returned_Qty > 0);
const delRes = api('DELETE_EMP_INVOICE', { invId: invA.Emp_Inv_ID, reason: 'طلب الموظف' }, A);
if (anyDeliveredOrPaid) { assert.strictEqual(delRes.success, false); passed++; }
else { assert.ok(delRes.success, delRes.message); assert.ok(!rows(S.EMP_INVOICES).some(i => i.Emp_Inv_ID === invA.Emp_Inv_ID)); passed++; }

// 20) صلاحيات قابلة للتخصيص
fail(api('SAVE_ROLE_PERMISSIONS', { acl: { RECORD_EMPLOYEE_PAYMENT: ['Warehouse'] } }, fin), 'only admin edits permissions', /صلاحية/);
fail(api('ADJUST_EMP_INVOICE', { invId: 'x', amount: 0 }, store), 'warehouse cannot adjust by default', /صلاحية/);
ok(api('SAVE_ROLE_PERMISSIONS', { acl: { ADJUST_EMP_INVOICE: ['Finance', 'Warehouse'], RECORD_EMPLOYEE_PAYMENT: [], SAVE_SETTING: ['Finance'] } }, A), 'admin saves permissions');
const r20 = api('ADJUST_EMP_INVOICE', { invId: 'x', amount: 0 }, store); assert.ok(!/صلاحية/.test(r20.message), 'warehouse now allowed: ' + r20.message); passed++;
fail(api('RECORD_EMPLOYEE_PAYMENT', { empInvId: 'x', amount: 1, paymentMethod: 'CASH' }, fin), 'finance revoked', /صلاحية/);
fail(api('SAVE_SETTING', { key: 'MAX_RELATIVES', value: 3 }, fin), 'fixed actions cannot be granted', /صلاحية/);
assert.deepStrictEqual(api('GET_ADMIN_DASHBOARD_DATA', {}, A).acl.ADJUST_EMP_INVOICE, ['Finance', 'Warehouse']); passed++;
ok(api('SAVE_ROLE_PERMISSIONS', { acl: {} }, A), 'reset permissions');

// 21) سجل التعديلات
const lg = ok(api('GET_AUDIT_LOG', { limit: 50 }, A), 'audit log');
assert.ok(lg.entries.length > 0 && lg.entries[0].t >= lg.entries[lg.entries.length - 1].t); passed++;
const lgE = ok(api('GET_AUDIT_LOG', { empId: '1001' }, coord), 'audit log by employee');
assert.ok(lgE.entries.some(a => a.module === 'ReservationItems') && lgE.entries.every(a => a.uid === '1001' || a.emp === '1001' || a.key.includes('-1001'))); passed++;
assert.ok(ok(api('GET_AUDIT_LOG', { module: 'Invoices' }, A), 'audit by module').entries.every(a => a.module === 'Invoices')); passed++;
fail(api('GET_AUDIT_LOG', {}, fin), 'finance cannot read audit by default', /صلاحية/);

// 22) التسعير الجماعي
const pricingBook = rows(S.BOOKS).find(b => b.Book_Status === 'Pricing');
if (pricingBook) {
  const dry = ok(api('BULK_PRICE_BOOKS', { rows: [{ bookId: pricingBook.Book_ID, coverPrice: 200 }, { bookId: 'ZZ-999', coverPrice: 10 }, { bookId: pricingBook.Book_ID, coverPrice: 5 }], defaults: { supplierId: 'SUP-01', supplierDiscountPct: 25 }, dryRun: true }, coord), 'bulk price preview');
  assert.strictEqual(dry.priced, 1); assert.strictEqual(dry.rejected, 2);
  assert.strictEqual(rows(S.BOOKS).find(b => b.Book_ID === pricingBook.Book_ID).Book_Status, 'Pricing'); passed++;
  ok(api('BULK_PRICE_BOOKS', { rows: [{ bookId: pricingBook.Book_ID.toLowerCase(), coverPrice: '200', supplierDiscountPct: '' }], defaults: { supplierId: 'SUP-01', supplierDiscountPct: 25 } }, coord), 'bulk price apply');
  const pb = rows(S.BOOKS).find(b => b.Book_ID === pricingBook.Book_ID);
  assert.strictEqual(pb.Book_Status, 'Available'); assert.strictEqual(pb.Cover_Price, 200); assert.strictEqual(pb.Supplier_Discount_Pct, 25); assert.strictEqual(pb.Emp_Selling_Price, 164); passed++;
}
fail(api('BULK_PRICE_BOOKS', { rows: [] }, fin), 'finance cannot bulk price', /صلاحية/);

// 23) خصم المكتبة حسب الناشر
const bks = rows(S.BOOKS).filter(b => b.Book_Status !== 'Discontinued' && b.Cover_Price > 0).slice(0, 3);
if (bks.length >= 2) {
  const pubA = bks[0].Publisher;
  const rr = ok(api('BULK_PRICE_BOOKS', { rows: bks.map(b => ({ bookId: b.Book_ID, coverPrice: b.Cover_Price })), defaults: { supplierId: 'SUP-01', supplierDiscountPct: 20, publisherDiscounts: { [pubA]: 18 } } }, coord), 'publisher discount rules');
  bks.forEach(b => { const nb = rows(S.BOOKS).find(x => x.Book_ID === b.Book_ID); assert.strictEqual(nb.Supplier_Discount_Pct, b.Publisher === pubA ? 18 : 20, b.Book_ID); });
  assert.ok(rows(S.SETTINGS).find(x => x.Setting_Key === 'SUPPLIER_DISCOUNT_RULES')); passed++;
  ok(api('BULK_PRICE_BOOKS', { rows: [{ bookId: bks[0].Book_ID, coverPrice: bks[0].Cover_Price, supplierDiscountPct: 30 }], defaults: { publisherDiscounts: { [pubA]: 18 } } }, coord), 'row overrides rule');
  assert.strictEqual(rows(S.BOOKS).find(x => x.Book_ID === bks[0].Book_ID).Supplier_Discount_Pct, 30); passed++;
}

// 24) إشعارات الإدارة حسب المرحلة
ok(api('POST_ANNOUNCEMENT', { op: 'add', title: 'التسليم الأحد', phaseId: 'PH-03' }, coord), 'announce for phase');
ok(api('POST_ANNOUNCEMENT', { op: 'add', title: 'خبر عام' }, coord), 'announce for all');
const pd = ok(api('GET_EMPLOYEE_PORTAL_DATA', { phaseId: 'PH-01' }, e1), 'portal ph1');
assert.ok(pd.announcements.some(a => a.title === 'خبر عام') && !pd.announcements.some(a => a.title === 'التسليم الأحد')); passed++;
const pd3 = ok(api('GET_EMPLOYEE_PORTAL_DATA', { phaseId: 'PH-03' }, e1), 'portal ph3');
assert.ok(pd3.announcements.some(a => a.title === 'التسليم الأحد')); passed++;
fail(api('POST_ANNOUNCEMENT', { op: 'add', title: 'x' }, e1), 'employee cannot announce');

// 25) التسجيل الذاتي: زائر / معاش / تعهيد
const g = ok(api('REGISTER_MEMBER', { category: 'guest', name: 'سامي علي حسن', nationalId: '29001011234567', mobile: '01099887766' }), 'guest registers');
assert.strictEqual(g.newMemberId, '7000001'); assert.ok(g.sessionToken && g.user.empId === '7000001'); passed++;
ok(api('LOGIN_EMPLOYEE', { empId: '7000001', natIdLast4: '4567', mobile: '01099887766' }), 'guest logs in later');
const rt = ok(api('REGISTER_MEMBER', { category: 'retiree', name: 'محمد أحمد سعيد', nationalId: '25501011234560', mobile: '01155443322', org: 'سنترال المنصورة' }), 'retiree registers');
assert.strictEqual(rt.newMemberId, '8000001'); passed++;
fail(api('REGISTER_MEMBER', { category: 'guest', name: 'سامي علي حسن', nationalId: '29001011234567', mobile: '01099887766' }), 'duplicate mobile rejected');
fail(api('REGISTER_MEMBER', { category: 'guest', name: 'اسم ناقص', nationalId: '29001011234567', mobile: '01011112222' }), 'short name rejected');
fail(api('REGISTER_MEMBER', { category: 'outsource', name: 'كريم سعد محمود', nationalId: '29001011234567', mobile: '01011112222' }), 'outsource needs company');
fail(api('REGISTER_MEMBER', { category: 'guest', name: 'سامي علي حسن', nationalId: '1234', mobile: '01011113333' }), 'bad national id');
fail(api('REGISTER_MEMBER', { category: 'guest', name: 'منى سعيد علي', nationalId: '29001011234567', mobile: '01012345678' }), 'mynekaba mobile rejected');
ok(api('GET_EMPLOYEE_PORTAL_DATA', {}, g.sessionToken), 'guest portal works');
fail(api('REGISTER_MEMBER', { category: 'outsource', name: 'كريم سعد محمود', nationalId: '29001011234567', mobile: '01011114444', org: 'شركة أخرى' }), 'outsource company must be from list');
const os1 = ok(api('REGISTER_MEMBER', { category: 'outsource', name: 'كريم سعد محمود', nationalId: '29001011234567', mobile: '01011114444', org: 'Tedata' }), 'outsource Tedata');
assert.strictEqual(os1.newMemberId, '6000001'); passed++;

// 26) حذف مرحلة/مكتبة · تبعية الكتب للمكتبة الرئيسية · منع تكرار الكتاب عند التسجيل والتكويد
const mainSupId = rows(S.SUPPLIERS)[0].Supplier_ID;
ok(api('SAVE_SUPPLIER', { supplierName: 'مكتبة فرعية للتجربة', volumeDiscountPct: 3 }, coord), 'add secondary supplier');
const subSupId = rows(S.SUPPLIERS)[1].Supplier_ID;
assert.ok(rows(S.BOOKS).every(b => b.Supplier_ID === mainSupId), 'all books belong to main supplier'); passed++;
// تسجيل كتاب جديد: يتبع المكتبة الرئيسية ويُولَّد له كود فريد، ولا يُسمح بتكراره
ok(api('SAVE_SETTING', { key: 'BOOK_PUBLISHERS', value: 'سلاح التلميذ,المعاصر,الامتحان' }, A), 'ensure publishers list');
ok(api('SAVE_SETTING', { key: 'BOOK_SUBJECTS', value: 'عربي,رياضيات,علوم,إنجليزي' }, A), 'ensure subjects list');
ok(api('SAVE_SETTING', { key: 'BOOK_PARTS', value: 'شرح,أسئلة' }, A), 'ensure parts list');
const nb1 = ok(api('SAVE_BOOK', { grade: '4 ابتدائي', schoolTypes: 'حكومي،أزهر', publisher: 'سلاح التلميذ', subject: 'عربي', bookPart: 'شرح', supplierId: subSupId, coverPrice: 120, supplierDiscountPct: 20 }, coord), 'save new book');
assert.strictEqual(nb1.book.Supplier_ID, mainSupId, 'new book forced to main supplier');
assert.strictEqual(nb1.book.Book_ID, 'P4-001'); passed++;
// محاولة تسجيل نفس الكتاب مرة أخرى (أو بتقاطع نوع مدرسة): يُرفض لمنع التكرار
fail(api('SAVE_BOOK', { grade: '4 ابتدائي', schoolTypes: 'حكومي', publisher: 'سلاح التلميذ', subject: 'عربي', bookPart: 'شرح', coverPrice: 130, supplierDiscountPct: 20 }, coord), 'duplicate book rejected', /مسجّل بالفعل/);
// طبعة لغات منفصلة لنفس المادة والناشر والصف مسموحة وتأخذ الكود التالي بدون تكرار
const nb2 = ok(api('SAVE_BOOK', { grade: '4 ابتدائي', schoolTypes: 'لغات', publisher: 'سلاح التلميذ', subject: 'عربي', bookPart: 'شرح' }, coord), 'distinct lang edition allowed');
assert.strictEqual(nb2.book.Book_ID, 'P4-002');
assert.strictEqual(nb2.book.Supplier_ID, mainSupId); passed++;
// تعديل كتاب موجود ليطابق كتاباً آخر في نفس الصف: يُرفض
fail(api('SAVE_BOOK', { bookId: 'P4-002', grade: '4 ابتدائي', schoolTypes: 'حكومي', publisher: 'سلاح التلميذ', subject: 'عربي', bookPart: 'شرح' }, coord), 'edit into duplicate rejected', /مسجّل بالفعل/);
// استيراد كتاب مكرر في نفس الصف بكود مختلف: يُرفض السطر المكرر
const impRes = ok(api('BULK_IMPORT_BOOKS', { booksArray: [{ Book_ID: 'P4-099', Book_Name: nb1.book.Book_Name, Stage: 'المرحلة الابتدائية', Grade: '4 ابتدائي', Subject: 'عربي', Publisher: 'سلاح التلميذ', School_Types: 'حكومي', Book_Part: 'شرح', Cover_Price: 120, Supplier_Discount_Pct: 20 }] }, coord), 'bulk import duplicate check');
assert.ok(/كتاب مكرر/.test(impRes.message) && !rows(S.BOOKS).some(b => b.Book_ID === 'P4-099')); passed++;
// حذف المكتبة الفرعية غير المرتبطة بحركات، ومنع حذف المكتبة المرتبطة بحركات
fail(api('DELETE_SUPPLIER', { supplierId: mainSupId }, coord), 'cannot delete supplier with invoices/PO', /لارتباطها/);
ok(api('DELETE_SUPPLIER', { supplierId: subSupId }, coord), 'delete unused secondary supplier');
assert.strictEqual(rows(S.SUPPLIERS).length, 1); passed++;
// حذف مرحلة فارغة، ومنع حذف مرحلة مرتبطة بحجوزات
fail(api('DELETE_PHASE', { phaseId: 'PH-01' }, coord), 'cannot delete phase with reservations', /لارتباطها/);
ok(api('SAVE_PHASE', { phaseName: 'مرحلة مؤقتة', startDate: '2027-05-01', endDate: '2027-05-15' }, coord), 'add temp phase');
const tempPh = rows(S.PHASES).find(p => p.Phase_Name === 'مرحلة مؤقتة');
ok(api('DELETE_PHASE', { phaseId: tempPh.Phase_ID }, coord), 'delete empty phase');
assert.ok(!rows(S.PHASES).some(p => p.Phase_ID === tempPh.Phase_ID)); passed++;
// إضافة دار نشر جديدة + مادة جديدة + جزء جديد + صف دراسي جديد مباشرة أثناء تسجيل الكتاب
const customGradeBook = ok(api('SAVE_BOOK', {
  newGradeLabel: 'تمهيدي',
  newGradeStage: 'رياض الأطفال',
  newGradeCode: 'KG0',
  newPublisher: 'الأضواء',
  newSubject: 'مهارات مهنية',
  newBookPart: 'مراجعة نهائية',
  schoolTypes: 'حكومي',
  coverPrice: 95,
  supplierDiscountPct: 20
}, coord), 'save book with inline new grade/publisher/subject/part');
assert.strictEqual(customGradeBook.book.Book_ID, 'KG0-001');
assert.strictEqual(customGradeBook.book.Grade, 'تمهيدي');
assert.strictEqual(customGradeBook.book.Stage, 'رياض الأطفال');
assert.strictEqual(customGradeBook.book.Publisher, 'الأضواء');
assert.strictEqual(customGradeBook.book.Subject, 'مهارات مهنية');
assert.strictEqual(customGradeBook.book.Book_Part, 'مراجعة نهائية');
assert.strictEqual(customGradeBook.book.Supplier_ID, mainSupId); passed++;
// تسجيل سلسلة متكاملة: كتاب الأضواء عربي للصفوف من الأول حتى السادس الابتدائي دفعة واحدة
const seriesGrades = ['1 ابتدائي', '2 ابتدائي', '3 ابتدائي', '4 ابتدائي', '5 ابتدائي', '6 ابتدائي'];
const seriesRes = ok(api('SAVE_BOOK', {
  grades: seriesGrades,
  schoolTypes: 'حكومي،أزهر',
  publisher: 'الأضواء',
  subject: 'عربي',
  bookPart: 'شرح',
  coverPrice: 110,
  supplierDiscountPct: 20
}, coord), 'save 6-grade primary series');
assert.strictEqual(seriesRes.books.length, 6, '6 books created for grades 1..6 primary');
assert.deepStrictEqual(seriesRes.books.map(b => b.Book_ID), ['P1-001', 'P2-001', 'P3-001', 'P4-003', 'P5-001', 'P6-001']); passed++;
// إعادة تسجيل نفس السلسلة مع إضافة صف جديد (1 إعدادي): يتخطى الـ 6 المسجلة ويضيف الصف الجديد فقط بكود جديد
const partialSeries = ok(api('SAVE_BOOK', {
  grades: [...seriesGrades, '1 إعدادي'],
  schoolTypes: 'حكومي،أزهر',
  publisher: 'الأضواء',
  subject: 'عربي',
  bookPart: 'شرح',
  coverPrice: 115,
  supplierDiscountPct: 20
}, coord), 'partial series skips existing grades and adds new grade');
assert.strictEqual(partialSeries.books.length, 1);
assert.strictEqual(partialSeries.books[0].Book_ID, 'M1-001');
assert.strictEqual(partialSeries.skipped.length, 6); passed++;
// حذف كتاب مسجل غير مرتبط بحركات، ومنع حذف كتاب مرتبط بحجوزات/مخزون/فواتير
fail(api('DELETE_BOOK', { bookId: 'BK-101' }, coord), 'cannot delete book linked to reservations/inventory', /لارتباطه/);
ok(api('DELETE_BOOK', { bookId: 'KG0-001' }, coord), 'delete unused registered book');
assert.ok(!rows(S.BOOKS).some(b => b.Book_ID === 'KG0-001'), 'deleted book removed from 05_Books'); passed++;
// تحديث قوائم الكتالوج مباشرة (دور النشر، المواد، الأجزاء، الصفوف) بدون الحاجة للفصلات
const catRes = ok(api('SAVE_BOOK', {
  catalogUpdate: true,
  publishers: ['المعاصر', 'سلاح التلميذ', 'الأضواء', 'كيان'],
  subjects: ['عربي', 'إنجليزي', 'برمجة'],
  parts: ['شرح', 'مراجعة نهائية', 'بنك أسئلة'],
  customGrades: [{ label: 'تمهيدي متقدم', stage: 'رياض الأطفال', code: 'KGA' }]
}, coord), 'catalogUpdate via SAVE_BOOK');
assert.ok(catRes.bookLists.publishers.includes('كيان'), 'new publisher saved in catalog lists');
assert.ok(catRes.bookLists.subjects.includes('برمجة'), 'new subject saved in catalog lists');
assert.ok(catRes.bookLists.parts.includes('بنك أسئلة'), 'new part saved in catalog lists');
assert.ok(catRes.bookLists.grades.some(g => g.label === 'تمهيدي متقدم' && g.code === 'KGA'), 'new custom grade saved in catalog lists'); passed++;

console.log('\nALL PASSED:', passed, 'checks');


