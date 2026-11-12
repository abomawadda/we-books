// بروفة آلية كاملة على الخادم الحي (تُعاد القاعدة بعدها من نسخة احتياطية):
// REH_PASS=... REH_EMPS='[[id,nat4,mobile,name],...]' node supabase/rehearsal.mjs
const U = process.env.API || 'https://bulfwclnhbwpzqwnxjie.supabase.co/functions/v1/books-api';
const EMPS = JSON.parse(process.env.REH_EMPS || '[]');
const log = [], issues = [];
const call = async (action, payload, token) => { const t = Date.now(); const r = await (await fetch(U, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, payload, token }) })).json(); r._ms = Date.now() - t; return r; };
const step = async (label, action, payload, token, expectFail) => {
  const r = await call(action, payload, token);
  const good = expectFail ? !r.success : r.success;
  log.push(`${good ? '✓' : '✗'} ${label} (${r._ms}ms)${r.message ? ' — ' + r.message : ''}`);
  if (!good) issues.push(`${label}: ${r.message}`);
  return r;
};
const today = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10), plus = d => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
(async () => {
  const adm = (await step('دخول الإدارة', 'LOGIN_ADMIN', { username: 'reh_admin', password: process.env.REH_PASS })).sessionToken;
  let dash = await step('لوحة الإدارة', 'GET_ADMIN_DASHBOARD_DATA', {}, adm);
  log.push(`  الكتب: ${dash.books.length} · الموظفون: ${dash.employees.length} · المراحل: ${dash.phases.length}`);
  const pick = dash.books.filter(b => b.Grade === '4 ابتدائي' && b.Book_Status === 'Pricing').slice(0, 6);
  const covers = [135, 150, 120, 140, 95, 160];
  await step('تسعير جماعي (معاينة)', 'BULK_PRICE_BOOKS', { rows: pick.map((b, i) => ({ bookId: b.Book_ID, coverPrice: covers[i] })), defaults: { supplierId: 'SUP-01', supplierDiscountPct: 20, publisherDiscounts: { 'سلاح التلميذ': 18 } }, dryRun: true }, adm);
  await step('تسعير جماعي (اعتماد 6 كتب)', 'BULK_PRICE_BOOKS', { rows: pick.map((b, i) => ({ bookId: b.Book_ID, coverPrice: covers[i] })), defaults: { supplierId: 'SUP-01', supplierDiscountPct: 20, publisherDiscounts: { 'سلاح التلميذ': 18 } } }, adm);
  const B = pick.map(b => b.Book_ID);
  await step('إنشاء مرحلة', 'SAVE_PHASE', { phaseId: 'PH-REH', phaseName: 'مرحلة البروفة', startDate: today, endDate: plus(7), deliveryStartDate: plus(2) }, adm);
  await step('فتح الحجز', 'SET_PHASE_STATUS', { phaseId: 'PH-REH', status: 'Open' }, adm);
  await step('إعلان للمرحلة', 'POST_ANNOUNCEMENT', { op: 'add', title: 'بروفة: الحجز مفتوح', phaseId: 'PH-REH' }, adm);
  const tok = [];
  for (const [id, nat, mob] of EMPS) tok.push((await step('دخول موظف ' + id, 'LOGIN_EMPLOYEE', { empId: id, natIdLast4: nat, mobile: mob })).sessionToken);
  await step('دخول ببيانات خاطئة يُرفض', 'LOGIN_EMPLOYEE', { empId: EMPS[0][0], natIdLast4: '9999', mobile: EMPS[0][2] }, null, true);
  const portal = await step('بوابة الموظف', 'GET_EMPLOYEE_PORTAL_DATA', { phaseId: 'PH-REH' }, tok[0]);
  if (!(portal.announcements || []).some(a => a.title.includes('بروفة'))) issues.push('الإعلان لم يظهر في بوابة الموظف');
  const t0 = Date.now();
  const res = await Promise.all([
    call('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-REH', items: [{ bookId: B[0], qty: 1 }, { bookId: B[1], qty: 1 }, { bookId: B[0], qty: 1, beneficiary: 'يوسف — ابن أخ' }], paymentMethod: 'INSTALLMENT', downPaymentType: 'PERCENTAGE', downPaymentInput: 25, installmentCount: 3 }, tok[0]),
    call('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-REH', items: [{ bookId: B[0], qty: 2 }, { bookId: B[2], qty: 1 }], paymentMethod: 'CASH' }, tok[1]),
    call('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-REH', items: [{ bookId: B[3], qty: 1 }, { bookId: B[4], qty: 1 }], paymentMethod: 'INSTALLMENT', downPaymentType: 'PERCENTAGE', downPaymentInput: 30, installmentCount: 2 }, tok[2]),
    call('SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-REH', items: [{ bookId: B[0], qty: 1 }], paymentMethod: 'INSTAPAY' }, tok[3])]);
  res.forEach((r, i) => { log.push(`${r.success ? '✓' : '✗'} حجز متزامن موظف ${EMPS[i][0]} (${r._ms}ms) — ${r.message}`); if (!r.success) issues.push('حجز ' + EMPS[i][0] + ': ' + r.message); });
  log.push(`  4 حجوزات متزامنة في ${Date.now() - t0}ms`);
  await step('زيادة كمية فوق الحد تُرفض', 'SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-REH', items: [{ bookId: B[0], qty: 9 }], paymentMethod: 'CASH' }, tok[1], true);
  await step('الإدارة تحجز لموظف 5', 'SUBMIT_OR_UPDATE_RESERVATION', { empId: EMPS[4][0], phaseId: 'PH-REH', items: [{ bookId: B[5], qty: 1 }, { bookId: B[0], qty: 1 }], paymentMethod: 'CASH' }, adm);
  await step('الإدارة تعدّل حجز موظف 4', 'SUBMIT_OR_UPDATE_RESERVATION', { empId: EMPS[3][0], phaseId: 'PH-REH', items: [{ bookId: B[0], qty: 1 }, { bookId: B[2], qty: 1 }], paymentMethod: 'INSTAPAY' }, adm);
  await step('إغلاق الحجز', 'SET_PHASE_STATUS', { phaseId: 'PH-REH', status: 'Closed' }, adm);
  await step('الحجز بعد الإغلاق يُرفض للموظف', 'SUBMIT_OR_UPDATE_RESERVATION', { phaseId: 'PH-REH', items: [{ bookId: B[1], qty: 1 }], paymentMethod: 'CASH' }, tok[2], true);
  const po = await step('تجميد الحصر وطلب التوريد', 'GENERATE_PO_SNAPSHOT', { phaseId: 'PH-REH' }, adm);
  dash = await call('GET_ADMIN_DASHBOARD_DATA', {}, adm);
  const snaps = dash.poSnapshots.filter(p => p.Phase_ID === 'PH-REH');
  log.push('  طلب التوريد: ' + snaps.map(p => p.Book_ID + '×' + p.Net_Order_To_Supplier_Qty).join('، '));
  // المكتبة تورّد الكل عدا نسخة واحدة من الكتاب الأول (لاختبار قائمة الانتظار)
  const items = snaps.map(p => { const bk = dash.books.find(b => b.Book_ID === p.Book_ID); const q = n(p.Net_Order_To_Supplier_Qty) - (p.Book_ID === B[0] ? 1 : 0); return { bookId: p.Book_ID, orderedQty: n(p.Net_Order_To_Supplier_Qty), receivedQty: q, coverPrice: bk.Cover_Price, itemDiscPct: bk.Supplier_Discount_Pct }; });
  await step('فاتورة المكتبة والجرد (نقص نسخة)', 'SUBMIT_SUPPLIER_INVOICE', { supplierId: 'SUP-01', phaseId: 'PH-REH', supplierInvoiceNo: 'REH-1', invoiceDate: today, volumeDiscountPct: 0, items }, adm);
  const al = await step('التوزيع بالأسبقية', 'RUN_ALLOCATION_ENGINE', { phaseId: 'PH-REH' }, adm);
  dash = await call('GET_ADMIN_DASHBOARD_DATA', {}, adm);
  const its = dash.resItems.filter(i => i.Phase_ID === 'PH-REH');
  const wait = its.filter(i => n(i.Requested_Qty) > n(i.Allocated_Qty));
  log.push(`  بعد التوزيع: ${its.length} بند · في الانتظار ${wait.length} (${wait.map(i => i.Emp_ID + '/' + i.Book_ID).join('، ')})`);
  const invs = dash.empInvoices.filter(i => i.Phase_ID === 'PH-REH');
  log.push(`  الفواتير: ${invs.length} · الإجمالي ${invs.reduce((s, i) => s + n(i.Net_Final_Invoice_Amount), 0)} ج.م`);
  for (const inv of invs) {
    const due = Math.max(0, n(inv.Down_Payment_Required) - n(inv.Total_Paid_Amount));
    if (due) await step(`تحصيل مقدم ${inv.Emp_ID} (${due})`, 'RECORD_EMPLOYEE_PAYMENT', { empInvId: inv.Emp_Inv_ID, amount: due, paymentMethod: 'CASH' }, adm);
    await step(`تسليم ${inv.Emp_ID}`, 'EXECUTE_BOOK_DELIVERY', { empId: inv.Emp_ID, phaseId: 'PH-REH', receivedBy: 'الموظف' }, adm);
  }
  await step('تعديل فاتورة (خصم)', 'ADJUST_EMP_INVOICE', { invId: invs[0].Emp_Inv_ID, amount: -5, reason: 'بروفة' }, adm);
  await step('سجل التعديلات', 'GET_AUDIT_LOG', { limit: 50 }, adm);
  const rep = await step('تقرير التصفية', 'GET_SETTLEMENT_REPORT', {}, adm);
  const p2 = await step('بوابة الموظف بعد التسليم', 'GET_EMPLOYEE_PORTAL_DATA', { phaseId: 'PH-REH' }, tok[0]);
  log.push(`  الموظف 1: فاتورة ${(p2.myInvoices || []).filter(i => i.Phase_ID === 'PH-REH').map(i => i.Net_Final_Invoice_Amount + ' متبقي ' + i.Remaining_Balance).join()} · أقساط ${(p2.myInstallments || []).length}`);
  console.log(log.join('\n'));
  console.log('\nISSUES:', issues.length ? '\n- ' + issues.join('\n- ') : 'لا شيء');
  function n(v) { return Number(v) || 0; }
})();
