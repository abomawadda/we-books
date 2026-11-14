/* ============================================================================
 * إقرار نهاية الحملة: قائمة الإغلاق، أرشيف كامل للتنزيل، التقرير الختامي، الإغلاق النهائي
 * (ضمن حزمة الإدارة؛ لا يغيّر شيئاً في الخادم إلا زر الإغلاق = SET_PHASE_STATUS Completed)
 * ========================================================================== */
"use strict";
const CL = { st: null };
async function loadCloseState() {
  const r = await call("GET_SETTLEMENT_REPORT");
  CL.st = r.success ? r : { error: r.message || "تعذر التحميل" };
  APP.settlement = r.success ? r : APP.settlement;
  rerenderList("clBody", closeBody);
}
function closeBody() {
  if (!CL.st) { setTimeout(loadCloseState, 0); return UI.skeleton(4); }
  if (CL.st.error) return UI.empty("circle-alert", CL.st.error);
  const ph = phaseObj(), items = phaseItems(), st = ph.Effective_Status || ph.Phase_Status;
  const pend = items.reduce((s, i) => s + Math.max(0, n(i.Allocated_Qty) - n(i.Delivered_Qty)), 0);
  const list = [{ item: "كل الكتب المخصصة في هذه المرحلة سُلِّمت", ok: pend === 0, value: fmt(pend) + " نسخة", must: true }].concat(CL.st.checklist || []);
  const okAll = list.every(c => c.ok), P = CL.st.pnl || {};
  const step = (k, t, body) => `<section class="card mb-4"><div class="px-4 sm:px-5 pt-4 pb-2 flex items-center gap-3"><span class="w-8 h-8 rounded-full bg-brand-700 text-white font-bold flex items-center justify-center num">${k}</span><h2 class="card-title">${t}</h2></div><div class="px-4 sm:px-5 pb-4">${body}</div></section>`;
  return (st === "Completed" ? `<div class="mb-4 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800 p-4 font-semibold flex items-center gap-2">${ic("circle-check")} «${esc(ph.Phase_Name)}» مغلقة نهائياً — الحجوزات لا تقبل أي تعديل.</div>` : "")
    + step(1, "راجع قائمة الإغلاق", `<ul class="space-y-2">${list.map(c => `<li class="flex items-center gap-3 rounded-xl px-3 py-2.5 ${c.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}">${ic(c.ok ? "circle-check" : "circle-x")}<span class="flex-1 font-semibold text-[13.5px]">${esc(c.item)}</span><span class="text-[12px] num">${esc(String(c.value || ""))}</span></li>`).join("")}</ul>
      <p class="text-[12.5px] text-slate-500 mt-3">${okAll ? "كل البنود سليمة ✅" : "البنود الحمراء غير مانعة إلا التسليم، لكن الأفضل تسويتها قبل الإغلاق (التصفية تشمل كل المراحل)."}</p>`)
    + step(2, "احفظ أرشيف الحملة", `<p class="text-[13px] text-slate-600 mb-3">ملف كامل بكل بيانات المرحلة (حجوزات، فواتير، إيصالات، تسليمات، مخزون، مصروفات) يُحفظ على جهازك — بجانب النسخة الاحتياطية الليلية على الخادم.</p>
      <div class="flex flex-wrap gap-2"><button class="btn btn-primary btn-sm" data-act="clArchive">${ic("download")} أرشيف كامل (JSON)</button><button class="btn btn-outline btn-sm" data-act="clCsv">${ic("file-spreadsheet")} الفواتير والمدفوعات (Excel)</button></div>`)
    + step(3, "اطبع التقرير الختامي", `<div class="grid grid-cols-2 gap-2 mb-3">${UI.stat(n(P.surplus) >= 0 ? "الفائض" : "العجز", money(P.surplus))}${UI.stat("وفّرها الموظفون", money(P.employeeSavings))}</div>
      <div class="flex flex-wrap gap-2"><button class="btn btn-outline btn-sm" data-act="clRep" data-id="R00">${ic("printer")} تقرير المجلس</button><button class="btn btn-outline btn-sm" data-act="clRep" data-id="R14">${ic("printer")} التصفية المالية والمخزنية</button></div>`)
    + step(4, "أغلق المرحلة نهائياً", st === "Completed" ? `<div class="text-sm text-slate-500">تم.</div>` : `<p class="text-[13px] text-slate-600 mb-3">بعد الإغلاق: لا تعديل على الحجوزات في هذه المرحلة، وتظهر «مكتملة» للجميع. التحصيل والأقساط تستمر عادي.</p>
      ${can("SET_PHASE_STATUS") ? `<button class="btn ${pend ? "btn-outline" : "btn-gold"} w-full sm:w-auto" data-act="clClose" ${pend ? "disabled" : ""}>${ic("lock")} إغلاق «${esc(ph.Phase_Name)}» نهائياً</button>${pend ? `<div class="text-[12px] text-rose-600 mt-2">سلّم الـ ${fmt(pend)} نسخة المتبقية أو ألغِ تخصيصها أولاً.</div>` : ""}` : `<div class="text-sm text-slate-500">الإغلاق لمدير المنظومة.</div>`}`);
}
Router.add("/a/close", view => {
  if (!APP.phaseId) { view.innerHTML = UI.empty("calendar-range", "لا توجد مرحلة"); return; }
  view.innerHTML = UI.pageHead("إقرار نهاية الحملة", esc(phaseObj().Phase_Name || "") + " — أربع خطوات لإغلاق الموسم بأمان", `<button class="btn btn-ghost btn-sm" data-act="clReload">${ic("refresh-cw")} تحديث</button>`)
    + `<div id="clBody" class="max-w-3xl">${closeBody()}</div>`;
});
on("clReload", () => { CL.st = null; rerenderList("clBody", closeBody); });
const download = (name, text, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
on("clArchive", () => {
  const d = A(), id = APP.phaseId, inPh = x => String(x.Phase_ID || "") === id, invIds = new Set(d.empInvoices.filter(inPh).map(i => i.Emp_Inv_ID));
  const arc = { generatedAt: new Date().toISOString(), phase: phaseObj(), books: d.books, suppliers: d.suppliers,
    reservations: d.resHeaders.filter(inPh), reservationItems: d.resItems.filter(inPh), poSnapshots: d.poSnapshots.filter(inPh), supplierInvoices: d.supInvHeaders.filter(inPh), supplierInvoiceItems: (d.supInvItems || []),
    employeeInvoices: d.empInvoices.filter(inPh), installments: d.installments.filter(i => invIds.has(i.Emp_Inv_ID)), payments: d.empPayments.filter(p => invIds.has(p.Emp_Inv_ID)),
    deliveriesReturns: d.deliveryReturns.filter(inPh), expenses: d.expenses.filter(inPh), supplierLedger: d.supLedger.filter(inPh), settlement: CL.st && !CL.st.error ? CL.st : null,
    employees: d.employees.filter(e => d.resHeaders.some(h => inPh(h) && h.Emp_ID === e.Emp_ID)).map(e => ({ Emp_ID: e.Emp_ID, Full_Name: e.Full_Name, Department: e.Department })) };
  download(`أرشيف-${phaseObj().Phase_Name || id}-${todayKey()}.json`, JSON.stringify(arc, null, 1), "application/json");
  toast("اتحفظ الأرشيف على جهازك", "success");
});
on("clCsv", () => {
  const { e } = maps(), invs = A().empInvoices.filter(i => i.Phase_ID === APP.phaseId);
  exportCSV("فواتير " + (phaseObj().Phase_Name || ""), ["الفاتورة", "الرقم الوظيفي", "الموظف", "الصافي", "المسدد", "المتبقي", "الحالة"], invs.map(i => [i.Emp_Inv_ID, i.Emp_ID, empName(e, i.Emp_ID), i.Net_Final_Invoice_Amount, i.Total_Paid_Amount, i.Remaining_Balance, ar(i.Invoice_Status)]));
});
on("clRep", id => { Rep.sel = id; Router.go("/a/reports"); });
on("clClose", async () => {
  const ph = phaseObj();
  const v = await UI.form({ title: "إغلاق المرحلة نهائياً", sub: ph.Phase_Name, danger: true, intro: "بعد الإغلاق لا يمكن تعديل الحجوزات في هذه المرحلة. اكتب كلمة «إغلاق» للتأكيد.", fields: [{ name: "c", label: "التأكيد", required: true, placeholder: "إغلاق" }], ok: "إغلاق نهائي", icon: "lock" });
  if (!v) return;
  if (String(v.c).trim() !== "إغلاق") return toast("اكتب كلمة «إغلاق» بالظبط للتأكيد", "warning");
  const r = await call("SET_PHASE_STATUS", { phaseId: APP.phaseId, status: "Completed" }, { block: true });
  toast(r.success ? "اتقفلت المرحلة نهائياً ✅" : r.message, r.success ? "success" : "danger");
  if (r.success) { CL.st = null; await Admin.load(); }
});
