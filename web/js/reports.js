/* ============================================================================
 * التقارير والتصفية
 * ========================================================================== */
"use strict";
const REPORTS = [
  ["R14", "chart-pie", "التصفية المالية والمخزنية", "نتيجة المبادرة والنقدية وحساب المكتبة والمديونيات"],
  ["R01", "notebook-pen", "حجوزات الموظفين", "تفصيلي بكل نسخة ووقت أسبقيتها"],
  ["R02", "clipboard-list", "الحصر التجميعي", "لكل كتاب: محجوز ومخصص ومُسلَّم"],
  ["R03", "scale", "فروق فواتير المكتبة", "نقص وزيادة وتالف ولم يُطبع"],
  ["R04", "list-ordered", "الأسبقية والتخصيص", "ترتيب كل كتاب بوقت الحجز"],
  ["R05", "hourglass", "قائمة المنتظرين", "من لم يُخصَّص له بعد"],
  ["R06", "receipt", "فواتير الموظفين", "الأرصدة والمسدد والمتبقي"],
  ["R07", "calendar-clock", "الأقساط والمتأخرات", "المستحق مرتباً بالتاريخ"],
  ["R08", "wallet", "التحصيلات اليومية", "حسب الوسيلة"],
  ["R09", "landmark", "كشف حساب المكتبة", "مدين ودائن ورصيد"],
  ["R10", "coins", "المصروفات", "كل مصروفات المبادرة"],
  ["R11", "arrow-left-right", "حركة المخزون", "كل حركة وارد ومنصرف"],
  ["R12", "boxes", "أرصدة المخزن", "الرصيد الحالي وقيمته"],
  ["R13", "trending-up", "هامش كل كتاب", "يكشف الكتب المباعة بخسارة"]
];
const Rep = { sel: "R14" };

Router.add("/a/reports", view => {
  const cur = REPORTS.find(r => r[0] === Rep.sel);
  view.innerHTML = UI.pageHead("التقارير والتصفية", "اختر التقرير ثم اطبعه أو صدّره إلى Excel")
  + `<div class="grid gap-4 sm:gap-6 lg:grid-cols-[300px_1fr] items-start">
    <nav class="no-print lg:sticky lg:top-24">
      <div class="lg:hidden"><select class="input" data-change="pickRep">${REPORTS.map(r => `<option value="${r[0]}" ${r[0] === Rep.sel ? "selected" : ""}>${r[2]}</option>`).join("")}</select></div>
      <div class="hidden lg:block card p-2 max-h-[calc(100dvh-8rem)] overflow-y-auto">${REPORTS.map(r => `<button data-act="pickRep" data-id="${r[0]}" class="w-full flex items-center gap-3 rounded-xl p-2.5 text-right transition ${r[0] === Rep.sel ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-slate-50"}">
        <span class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${r[0] === Rep.sel ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-500"}">${ic(r[1])}</span>
        <span class="min-w-0"><span class="block text-[13.5px] font-semibold ${r[0] === Rep.sel ? "text-brand-900" : "text-slate-700"}">${r[2]}</span><span class="block text-[11px] text-slate-400 truncate">${r[3]}</span></span></button>`).join("")}</div>
    </nav>
    <section class="card min-w-0">
      <div class="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-slate-100">
        <div class="flex items-center gap-3"><span class="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center text-lg">${ic(cur[1])}</span><div><h2 class="font-bold text-slate-900">${cur[2]}</h2><p class="text-xs text-slate-500">${esc(Rep.sel === "R14" || ["R08", "R09", "R10", "R11", "R12"].includes(Rep.sel) ? "كل المراحل" : phaseObj().Phase_Name || "")}</p></div></div>
        <div class="flex gap-2 no-print"><button class="btn btn-outline btn-sm" data-act="exportRep">${ic("file-spreadsheet")} Excel</button><button class="btn btn-dark btn-sm" data-act="printRep">${ic("printer")} طباعة / PDF</button></div>
      </div>
      <div id="repArea" class="p-4 sm:p-5">${UI.skeleton(4)}</div>
    </section></div>`;
  renderReport();
});
on("pickRep", v => { Rep.sel = v; Shell.rerender(); });
on("printRep", () => {
  const c = $("#repArea").cloneNode(true);
  $$(".md\\:hidden", c).forEach(x => x.remove());
  $$("[style*=max-height]", c).forEach(x => x.style.maxHeight = "none");
  openPrint((REPORTS.find(r => r[0] === Rep.sel) || [])[2] || "تقرير", c.innerHTML);
});
on("exportRep", () => {
  const tables = $$("#repArea table");
  if (!tables.length) return toast("لا يوجد جدول للتصدير", "warning");
  const rows = []; let headers = null;
  tables.forEach((t, ti) => {
    const hs = $$("thead th", t).map(th => th.innerText.trim());
    if (!headers) headers = hs; else rows.push([], hs);
    $$("tbody tr", t).forEach(tr => rows.push($$("td", tr).map(td => td.innerText.trim())));
  });
  exportCSV((REPORTS.find(r => r[0] === Rep.sel) || [])[2] || "تقرير", headers, rows);
});

function kvTable(rows, opts) {
  return UI.table([{ t: "البند", v: r => r[0] }, { t: "القيمة", cls: "num text-left", v: r => r[1] }], rows, Object.assign({ cardsOnMobile: false }, opts || {}));
}
async function renderReport() {
  const d = A(), area = $("#repArea"); if (!d || !area) return;
  const { e, b, s } = maps(), ph = APP.phaseId, sel = Rep.sel;
  const items = d.resItems.filter(i => i.Phase_ID === ph);
  let h = "";
  if (sel === "R14") {
    if (!APP.settlement) { const r = await call("GET_SETTLEMENT_REPORT"); if (!r.success) { area.innerHTML = UI.empty("circle-alert", "تعذر تحميل التصفية", r.message); return; } APP.settlement = r; }
    if (Rep.sel !== "R14" || !$("#repArea")) return;
    const r = APP.settlement, P = r.pnl;
    const block = (title, icon, tone, body) => `<div class="rounded-2xl ring-1 ring-slate-200/80 overflow-hidden"><div class="flex items-center gap-2 px-4 py-3 font-bold text-[14px] ${tone}">${ic(icon)}${title}</div><div class="p-3">${body}</div></div>`;
    h = `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        ${UI.kpi(P.surplus >= 0 ? "الفائض" : "العجز", `<span class="${P.surplus < 0 ? "text-rose-600" : "text-emerald-600"}">${money(P.surplus)}</span>`, { icon: P.surplus < 0 ? "trending-up" : "piggy-bank", tone: P.surplus < 0 ? "red" : "green", foot: `يؤول إلى / يتحمله: ${esc(r.deficitBearer)}` })}
        ${UI.kpi("توفير الموظفين", money(P.employeeSavings), { icon: "badge-percent", tone: "brand" })}
        ${UI.kpi("النقدية المتوقعة", money(r.cash.expectedCashOnHand), { icon: "wallet", tone: "blue", foot: "لدى " + esc(r.cashHolder) })}
        ${UI.kpi("مديونيات الموظفين", money(r.receivables.total), { icon: "hand-coins", tone: "amber" })}</div>
      <div class="grid gap-4 md:grid-cols-2">
        ${block("نتيجة المبادرة", "chart-pie", "bg-slate-900 text-white", kvTable([["مبيعات الكتب المسلَّمة (صافي المرتجع)", money(P.deliveredRevenue)], ["إجمالي الفواتير (يشمل المخصص غير المسلَّم)", money(P.billedRevenue)], ["(−) تكلفة الكتب المسلَّمة", money(P.cogs)], ["(−) المصروفات", money(P.expenses)], ["(−) عجز الجرد", money(P.inventoryShrink)], [`<b>${P.surplus >= 0 ? "الفائض" : "العجز"}</b>`, `<b class="${P.surplus < 0 ? "text-rose-600" : "text-emerald-600"}">${money(P.surplus)}</b>`]]))}
        ${block("النقدية", "wallet", "bg-brand-700 text-white", kvTable([["المحصَّل من الموظفين", money(r.cash.collected)], ...Object.keys(r.cash.byMethod).map(k => ["· منها " + ar(k), money(r.cash.byMethod[k])]), ["(−) المردود للموظفين", money(r.cash.refunds)], ["(−) المدفوع للمكتبة", money(r.cash.supplierPaid)], ["(−) المصروفات", money(r.cash.expenses)], [`<b>النقدية المتوقعة لدى ${esc(r.cashHolder)}</b>`, `<b>${money(r.cash.expectedCashOnHand)}</b>`]]) + `<p class="text-xs text-slate-500 mt-2">${esc(r.reconciliation.note)}</p>`)}
        ${block("حساب المكتبة", "landmark", "bg-slate-100 text-slate-800", kvTable([["صافي الفواتير", money(r.supplier.purchasesNet)], ["(−) مطالبات تالف", money(r.supplier.damageClaims)], ["(−) مرتجعات", money(r.supplier.returns)], ["(−) مدفوع", money(r.supplier.paid)], ["<b>الرصيد المستحق للمكتبة</b>", `<b>${money(r.supplier.balance)}</b>`]]))}
        ${block("مديونيات الموظفين حسب العمر", "calendar-clock", "bg-gold-100 text-gold-700", kvTable([["لم تستحق", money(r.receivables.aging.notDue)], ["متأخر حتى 30 يوماً", money(r.receivables.aging.d1_30)], ["31–60 يوماً", money(r.receivables.aging.d31_60)], ["61–90 يوماً", money(r.receivables.aging.d61_90)], ["أكثر من 90 يوماً", money(r.receivables.aging.d90p)], ["<b>الإجمالي</b>", `<b>${money(r.receivables.total)}</b>`], ["أرصدة دائنة لم تُرد", money(r.receivables.creditsDue)]]))}
      </div>
      <div class="mt-4">${block("قائمة إغلاق الموسم", "list-checks", "bg-emerald-50 text-emerald-800", `<ul class="divide-y divide-slate-100">${r.checklist.map(c => `<li class="flex items-center gap-3 py-2.5 px-1"><span class="w-7 h-7 rounded-full flex items-center justify-center ${c.ok ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}">${ic(c.ok ? "check" : "x")}</span><span class="flex-1 text-[13.5px]">${esc(c.item)}</span><span class="text-[13px] font-semibold text-slate-600 num">${esc(c.value)}</span></li>`).join("")}</ul>`)}</div>
      <div class="mt-4">${block("المخزون المتبقي (يُرجع للمكتبة قبل الإغلاق)", "boxes", "bg-slate-100 text-slate-800", UI.table([{ t: "الكتاب", v: l => esc(bookName(b, l.bookId)) }, { t: "بالمخزن", cls: "num", v: l => fmt(l.onHand) }, { t: "مخصص", cls: "num", v: l => fmt(l.reserved) }, { t: "حر", cls: "num", v: l => fmt(l.free) }, { t: "متوسط التكلفة", cls: "num", v: l => fmt(l.avgCost) }, { t: "القيمة", cls: "num", v: l => money(l.value) }], r.stock.lines, { empty: "لا مخزون متبقٍ", emptyIcon: "boxes" }))}</div>`;
  }
  else if (sel === "R01") h = UI.table([{ t: "الرقم", v: "Emp_ID" }, { t: "الموظف", v: i => esc(empName(e, i.Emp_ID)) }, { t: "الكتاب", v: i => esc(bookName(b, i.Book_ID)) }, { t: "الأسبقية", cls: "num", v: i => `<span dir="ltr">${esc(i.Priority_Timestamp)}</span>` }, { t: "محجوز", cls: "num", v: i => fmt(i.Requested_Qty) }, { t: "القيمة", cls: "num", v: i => fmt(n(i.Requested_Qty) * n(i.Unit_Emp_Price)) }, { t: "السداد", v: i => esc(ar((d.resHeaders.find(x => x.Res_ID === i.Res_ID) || {}).Payment_Method_Selected)) }], items);
  else if (sel === "R02") { const a = {}; items.forEach(i => { const x = a[i.Book_ID] = a[i.Book_ID] || { r: 0, al: 0, dl: 0 }; x.r += n(i.Requested_Qty); x.al += n(i.Allocated_Qty); x.dl += n(i.Delivered_Qty); });
    h = UI.table([{ t: "الكود", v: "k" }, { t: "الكتاب", v: x => esc(bookName(b, x.k)) }, { t: "المكتبة", v: x => esc((s[(b[x.k] || {}).Supplier_ID] || {}).Supplier_Name) }, { t: "محجوز", cls: "num", v: x => fmt(x.r) }, { t: "مخصص", cls: "num", v: x => fmt(x.al) }, { t: "مُسلَّم", cls: "num", v: x => fmt(x.dl) }, { t: "بسعر الغلاف", cls: "num", v: x => fmt(x.r * n((b[x.k] || {}).Cover_Price)) }, { t: "بالتكلفة", cls: "num", v: x => fmt(x.r * n((b[x.k] || {}).Standard_Net_Cost)) }], Object.keys(a).map(k => Object.assign({ k }, a[k]))); }
  else if (sel === "R03") { const ids = d.supInvHeaders.filter(x => x.Phase_ID === ph).map(x => x.Sup_Inv_ID);
    h = UI.table([{ t: "الفاتورة", v: "Sup_Inv_ID" }, { t: "الكتاب", v: x => esc(bookName(b, x.Book_ID)) }, { t: "مطلوب", cls: "num", v: x => fmt(x.Ordered_Qty) }, { t: "سليم", cls: "num", v: x => fmt(x.Received_Qty) }, { t: "تالف", cls: "num", v: x => fmt(x.Damaged_Qty) }, { t: "الفرق", cls: "num", v: x => fmt(x.Variance_Qty) }, { t: "النوع", v: x => pill(x.Matching_Flag) }, { t: "سعر مختلف", v: x => esc(x.Price_Mismatch) }], d.supInvItems.filter(x => ids.includes(x.Sup_Inv_ID) && (x.Matching_Flag !== "EXACT" || n(x.Damaged_Qty) || x.Price_Mismatch)), { empty: "لا فروق — كل الفواتير مطابقة", emptyIcon: "circle-check" }); }
  else if (sel === "R04") { const g = {}; h = UI.table([{ t: "الكتاب", v: i => esc(bookName(b, i.Book_ID)) }, { t: "الترتيب", cls: "num", v: i => `<b>${i._rank}</b>` }, { t: "الموظف", v: i => esc(empName(e, i.Emp_ID)) }, { t: "الأسبقية", cls: "num", v: i => `<span dir="ltr">${esc(i.Priority_Timestamp)}</span>` }, { t: "محجوز", cls: "num", v: i => fmt(i.Requested_Qty) }, { t: "مخصص", cls: "num", v: i => fmt(i.Allocated_Qty) }, { t: "الحالة", v: i => pill(i.Allocation_Status) }],
    items.slice().sort((x, y) => (x.Book_ID + x.Priority_Timestamp).localeCompare(y.Book_ID + y.Priority_Timestamp)).map(i => { g[i.Book_ID] = (g[i.Book_ID] || 0) + 1; return Object.assign({ _rank: g[i.Book_ID] }, i); })); }
  else if (sel === "R05") h = UI.table([{ t: "الموظف", v: i => esc(empName(e, i.Emp_ID)) }, { t: "الموبايل", cls: "num", v: i => `<span dir="ltr">${esc((e[i.Emp_ID] || {}).Mobile)}</span>` }, { t: "الكتاب", v: i => esc(bookName(b, i.Book_ID)) }, { t: "الأسبقية", cls: "num", v: i => `<span dir="ltr">${esc(i.Priority_Timestamp)}</span>` }, { t: "المنتظر", cls: "num", v: i => `<b>${fmt(n(i.Requested_Qty) - Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)))}</b>` }, { t: "السبب", v: "Unallocated_Reason" }],
    items.filter(i => n(i.Requested_Qty) > Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)) && !String(i.Allocation_Status).startsWith("Cancelled")), { empty: "لا يوجد منتظرون", emptyIcon: "circle-check" });
  else if (sel === "R06") h = UI.table([{ t: "الفاتورة", v: "Emp_Inv_ID" }, { t: "الموظف", v: i => esc(empName(e, i.Emp_ID)) }, { t: "الغلاف", cls: "num", v: i => fmt(i.Total_Cover_Amount) }, { t: "التوفير", cls: "num", v: i => fmt(i.Total_Savings) }, { t: "الصافي", cls: "num", v: i => `<b>${fmt(i.Net_Final_Invoice_Amount)}</b>` }, { t: "المسدد", cls: "num", v: i => fmt(i.Total_Paid_Amount) }, { t: "المتبقي", cls: "num", v: i => fmt(i.Remaining_Balance) }, { t: "رصيد دائن", cls: "num", v: i => fmt(i.Credit_Balance) }, { t: "الحالة", v: i => pill(i.Invoice_Status) }], d.empInvoices.filter(i => i.Phase_ID === ph));
  else if (sel === "R07") h = UI.table([{ t: "الموظف", v: i => esc(empName(e, i.Emp_ID)) }, { t: "الموبايل", cls: "num", v: i => `<span dir="ltr">${esc((e[i.Emp_ID] || {}).Mobile)}</span>` }, { t: "القسط", v: "Admin_Custom_Notes" }, { t: "الاستحقاق", cls: "num", v: i => esc(day(i.Due_Date)) }, { t: "المبلغ", cls: "num", v: i => fmt(i.Scheduled_Amount) }, { t: "المسدد", cls: "num", v: i => fmt(i.Paid_Amount) }, { t: "المتبقي", cls: "num", v: i => `<b>${fmt(i.Remaining_Inst_Amount)}</b>` }, { t: "الحالة", v: i => pill(i.Status, i.Status === "Scheduled" ? "مجدول" : null) }],
    d.installments.filter(i => String(i.Emp_Inv_ID).indexOf("-" + ph + "-") > 0 && n(i.Remaining_Inst_Amount) > 0).sort((x, y) => String(x.Due_Date).localeCompare(y.Due_Date)), { empty: "لا أقساط مستحقة", emptyIcon: "circle-check" });
  else if (sel === "R08") { const a = {}; d.empPayments.filter(p => !isTrue(p.Is_Voided)).forEach(p => { const k = day(p.Payment_Date) + "|" + p.Payment_Method; a[k] = a[k] || { c: 0, s: 0 }; a[k].c++; a[k].s += n(p.Amount); });
    h = UI.table([{ t: "اليوم", cls: "num", v: x => esc(x.d) }, { t: "الوسيلة", v: x => esc(ar(x.m)) }, { t: "عدد الإيصالات", cls: "num", v: x => fmt(x.c) }, { t: "الإجمالي", cls: "num", v: x => `<b>${fmt(x.s)}</b>` }], Object.keys(a).sort().reverse().map(k => { const [dd, m] = k.split("|"); return { d: dd, m, c: a[k].c, s: a[k].s }; })); }
  else if (sel === "R09") { let bal = 0; h = UI.table([{ t: "التاريخ", cls: "num", v: l => esc(day(l.Trans_Date)) }, { t: "المكتبة", v: l => esc((s[l.Supplier_ID] || {}).Supplier_Name || l.Supplier_ID) }, { t: "البيان", v: "Notes" }, { t: "المرجع", v: "Document_Ref" }, { t: "مدين", cls: "num", v: l => fmt(l.Debit_Amount) }, { t: "دائن", cls: "num", v: l => fmt(l.Credit_Amount) }, { t: "الرصيد", cls: "num", v: l => `<b>${fmt(l._b)}</b>` }], d.supLedger.map(l => { bal += n(l.Credit_Amount) - n(l.Debit_Amount); return Object.assign({ _b: bal }, l); })); }
  else if (sel === "R10") h = UI.table([{ t: "الرقم", v: "Expense_ID" }, { t: "التاريخ", cls: "num", v: x => esc(day(x.Expense_Date)) }, { t: "المرحلة", v: "Phase_ID" }, { t: "البند", v: "Expense_Category" }, { t: "المستفيد", v: "Beneficiary_Name" }, { t: "الإيصال", v: "Receipt_Doc_No" }, { t: "القيمة", cls: "num", v: x => `<b>${fmt(x.Amount)}</b>` }], d.expenses);
  else if (sel === "R11") h = UI.table([{ t: "التاريخ", cls: "num", v: x => esc(dt(x.Trans_Timestamp)) }, { t: "الكتاب", v: x => esc(bookName(b, x.Book_ID)) }, { t: "الحركة", v: "Movement_Type" }, { t: "الكمية", cls: "num", v: x => `<b class="${n(x.Qty_Change) < 0 ? "text-rose-600" : "text-emerald-600"}">${fmt(x.Qty_Change)}</b>` }, { t: "التكلفة", cls: "num", v: x => fmt(x.Unit_Actual_Cost) }, { t: "المستند", v: "Reference_Doc_ID" }, { t: "بواسطة", v: "Recorded_By" }], d.inventoryLedger.slice().reverse());
  else if (sel === "R12") h = UI.table([{ t: "الكتاب", v: x => esc(bookName(b, x.k)) }, { t: "بالمخزن", cls: "num", v: x => fmt(x.onHand) }, { t: "مخصص لم يُسلَّم", cls: "num", v: x => fmt(x.reserved) }, { t: "حر", cls: "num", v: x => fmt(x.free) }, { t: "متوسط التكلفة", cls: "num", v: x => fmt(x.avgCost) }, { t: "القيمة", cls: "num", v: x => `<b>${fmt(x.onHand * x.avgCost)}</b>` }], Object.keys(d.stockMap).filter(k => d.stockMap[k].onHand).map(k => Object.assign({ k }, d.stockMap[k])), { empty: "المخزن فارغ", emptyIcon: "boxes" });
  else if (sel === "R13") h = UI.table([{ t: "الكتاب", v: x => esc(x.Book_Name) }, { t: "الغلاف", cls: "num", v: x => fmt(x.Cover_Price) }, { t: "التكلفة", cls: "num", v: x => fmt(x.Standard_Net_Cost) }, { t: "سعر الموظف", cls: "num", v: x => fmt(x.Emp_Selling_Price) }, { t: "الهامش للنسخة", cls: "num", v: x => `<b class="${x._m < 0 ? "text-rose-600" : "text-emerald-600"}">${fmt(x._m)}</b>` }, { t: "النسخ المحجوزة", cls: "num", v: x => fmt(x._q) }, { t: "إجمالي الهامش", cls: "num", v: x => `<b>${fmt(x._m * x._q)}</b>` }],
    d.books.map(x => Object.assign({ _q: items.filter(i => i.Book_ID === x.Book_ID).reduce((t, i) => t + n(i.Requested_Qty), 0), _m: r2(n(x.Emp_Selling_Price) - n(x.Standard_Net_Cost)) }, x)));
  if (Rep.sel === sel && $("#repArea")) $("#repArea").innerHTML = h;
}
