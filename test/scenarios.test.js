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
console.log('\nALL PASSED:', passed, 'checks');
