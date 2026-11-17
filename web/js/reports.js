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

// تصنيف التقارير بألوان: الحجز (بنفسجي) · المال (أخضر) · المكتبة والمخزن (أزرق) · تحليلات (ذهبي)
const REP_CAT = { R01: "res", R02: "res", R04: "res", R05: "res", R14: "fin", R06: "fin", R07: "fin", R08: "fin", R10: "fin", R03: "sup", R09: "sup", R11: "sup", R12: "sup", R00: "ana", R13: "ana", R15: "ana", R16: "ana", R17: "ana" };
const REP_TONE = {
  res: { n: "الحجز", g: "from-brand-600 to-brand-800", soft: "bg-brand-50 text-brand-700 ring-brand-200", dot: "bg-brand-500" },
  fin: { n: "المال", g: "from-emerald-500 to-emerald-700", soft: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  sup: { n: "المكتبة والمخزن", g: "from-sky-500 to-sky-700", soft: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  ana: { n: "تحليلات", g: "from-amber-400 to-amber-600", soft: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" }
};
const repTone = id => REP_TONE[REP_CAT[id] || "ana"];
Router.add("/a/reports", view => {
  const cur = REPORTS.find(r => r[0] === Rep.sel) || REPORTS[0], t = repTone(cur[0]);
  const tile = r => { const tt = repTone(r[0]), on = r[0] === Rep.sel;
    return `<button data-act="pickRep" data-id="${r[0]}" class="rep-tile shrink-0 snap-start w-[8.6rem] lg:w-full text-right rounded-2xl p-2.5 ring-1 transition active:scale-[.98] ${on ? `bg-gradient-to-br ${tt.g} text-white ring-transparent shadow-lg` : "bg-white ring-slate-200 hover:ring-brand-300"}">
      <span class="flex lg:items-center gap-2.5 lg:flex-row flex-col"><span class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${on ? "bg-white/20 text-white" : tt.soft + " ring-1"}">${ic(r[1])}</span>
      <span class="min-w-0"><span class="block text-[12.5px] font-bold leading-snug ${on ? "text-white" : "text-slate-800"}">${r[2]}</span><span class="hidden lg:block text-[11px] truncate ${on ? "text-white/80" : "text-slate-400"}">${r[3]}</span></span></span></button>`; };
  const cats = Object.keys(REP_TONE);
  view.innerHTML = `<section class="relative overflow-hidden rounded-3xl p-4 sm:p-5 mb-4 text-white shadow-lg" style="background:radial-gradient(circle at 85% 0%,#8b55cc 0,#4c1d95 45%,#2a1347 100%)">
      <div class="absolute -left-10 -bottom-12 w-40 h-40 rounded-full bg-gold-400/20 blur-2xl"></div>
      <div class="relative flex items-center gap-3"><span class="w-12 h-12 rounded-2xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center text-[22px]">${ic("chart-column")}</span>
        <div class="flex-1 min-w-0"><h1 class="font-display font-bold text-[21px] leading-tight">التقارير والتصفية</h1><p class="text-[12.5px] text-white/75">${esc(phaseObj().Phase_Name || "")} · ${fmt(REPORTS.length)} تقرير جاهز للطباعة والتصدير</p></div></div>
      <div class="relative flex flex-wrap gap-1.5 mt-3">${cats.map(c => `<span class="inline-flex items-center gap-1.5 rounded-full bg-white/12 ring-1 ring-white/20 px-2.5 py-1 text-[11.5px]"><span class="w-2 h-2 rounded-full ${REP_TONE[c].dot}"></span>${REP_TONE[c].n} <b class="num">${REPORTS.filter(r => (REP_CAT[r[0]] || "ana") === c).length}</b></span>`).join("")}</div>
    </section>
    <div class="grid gap-4 sm:gap-6 lg:grid-cols-[290px_1fr] items-start">
    <nav class="no-print lg:sticky lg:top-24 min-w-0">
      <div class="lg:hidden -mx-4 px-4 flex gap-2 overflow-x-auto snap-x pb-2" id="repStrip">${REPORTS.map(tile).join("")}</div>
      <div class="hidden lg:block card p-2 max-h-[calc(100dvh-8rem)] overflow-y-auto space-y-3">${cats.map(c => { const list = REPORTS.filter(r => (REP_CAT[r[0]] || "ana") === c); return list.length ? `<div><div class="flex items-center gap-1.5 px-2 pt-1 pb-1.5 text-[11px] font-bold text-slate-500"><span class="w-2 h-2 rounded-full ${REP_TONE[c].dot}"></span>${REP_TONE[c].n}</div><div class="space-y-1.5">${list.map(tile).join("")}</div></div>` : ""; }).join("")}</div>
    </nav>
    <section class="card min-w-0 overflow-hidden">
      <div class="h-1.5 bg-gradient-to-l ${t.g}"></div>
      <div class="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100">
        <div class="flex items-center gap-3 min-w-0"><span class="w-11 h-11 rounded-2xl bg-gradient-to-br ${t.g} text-white flex items-center justify-center text-lg shadow">${ic(cur[1])}</span>
          <div class="min-w-0"><div class="flex items-center gap-2"><h2 class="font-bold text-slate-900 text-[16px]">${cur[2]}</h2><span class="rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ${t.soft}">${t.n}</span></div><p class="text-[12px] text-slate-500">${esc(cur[3])} · ${esc(Rep.sel === "R14" || ["R08", "R09", "R10", "R11", "R12", "R17"].includes(Rep.sel) ? "كل المراحل" : phaseObj().Phase_Name || "")}</p></div></div>
        <div class="flex gap-2 no-print"><button class="btn btn-outline btn-sm" data-act="exportRep">${ic("file-spreadsheet")} Excel</button><button class="btn btn-dark btn-sm" data-act="printRep">${ic("printer")} PDF</button></div>
      </div>
      <div id="repArea" class="rep-area rep-${REP_CAT[cur[0]] || "ana"} p-3 sm:p-5">${UI.skeleton(4)}</div>
    </section></div>`;
  const on = view.querySelector("#repStrip [aria-current], #repStrip .shadow-lg"); if (on && on.scrollIntoView) setTimeout(() => on.scrollIntoView({ inline: "center", block: "nearest" }), 30);
  renderReport();
});
on("pickRep", v => { Rep.sel = v; Rep.q = ""; Rep.sort = { k: -1, dir: 1 }; Shell.rerender(); });
on("printRep", () => {
  $$("#repArea details[data-rg]").forEach(d => { repFill(d); d.open = true; });
  const c = $("#repArea").cloneNode(true);
  $$(".lg\\:hidden", c).forEach(x => x.remove());
  $$("[style*=max-height]", c).forEach(x => x.style.maxHeight = "none");
  openPrint((REPORTS.find(r => r[0] === Rep.sel) || [])[2] || "تقرير", c.innerHTML);
});
on("exportRep", () => {
  $$("#repArea details[data-rg]").forEach(d => { repFill(d); d.open = true; });
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
        ${block("حساب المكتبة", "landmark", "bg-slate-100 text-slate-800", kvTable([["صافي الفواتير", money(r.supplier.purchasesNet)], ...(n(r.supplier.voids) ? [["(−) فواتير ملغاة", money(r.supplier.voids)]] : []), ["(−) مطالبات تالف", money(r.supplier.damageClaims)], ["(−) مرتجع نهائي للمكتبة", money(r.supplier.returns)], ["(−) مدفوع", money(r.supplier.paid)], [`<b>${Math.abs(n(r.supplier.balance)) < 0.005 ? "الحساب متصفّي" : n(r.supplier.balance) > 0 ? "مستحق للمكتبة (علينا)" : "مستحق على المكتبة (لنا)"}</b>`, `<b class="${n(r.supplier.balance) > 0.004 ? "text-rose-600" : "text-emerald-600"}">${money(Math.abs(n(r.supplier.balance)))}</b>`]]))}
        ${block("مديونيات الموظفين حسب العمر", "calendar-clock", "bg-gold-100 text-gold-700", kvTable([["لم تستحق", money(r.receivables.aging.notDue)], ["متأخر حتى 30 يوماً", money(r.receivables.aging.d1_30)], ["31–60 يوماً", money(r.receivables.aging.d31_60)], ["61–90 يوماً", money(r.receivables.aging.d61_90)], ["أكثر من 90 يوماً", money(r.receivables.aging.d90p)], ["<b>الإجمالي</b>", `<b>${money(r.receivables.total)}</b>`], ["أرصدة دائنة لم تُرد", money(r.receivables.creditsDue)]]))}
      </div>
      <div class="mt-4">${block("قائمة إغلاق الموسم", "list-checks", "bg-emerald-50 text-emerald-800", `<ul class="divide-y divide-slate-100">${r.checklist.map(c => `<li class="flex items-center gap-3 py-2.5 px-1"><span class="w-7 h-7 rounded-full flex items-center justify-center ${c.ok ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}">${ic(c.ok ? "check" : "x")}</span><span class="flex-1 text-[13.5px]">${esc(c.item)}</span><span class="text-[13px] font-semibold text-slate-600 num">${esc(c.value)}</span></li>`).join("")}</ul>`)}</div>
      <div class="mt-4">${block("المخزون المتبقي (يُرجع للمكتبة قبل الإغلاق)", "boxes", "bg-slate-100 text-slate-800", UI.table([{ t: "الكتاب", v: l => esc(bookName(b, l.bookId)) }, { t: "بالمخزن", cls: "num", v: l => fmt(l.onHand) }, { t: "مخصص", cls: "num", v: l => fmt(l.reserved) }, { t: "حر", cls: "num", v: l => fmt(l.free) }, { t: "متوسط التكلفة", cls: "num", v: l => fmt(l.avgCost) }, { t: "القيمة", cls: "num", v: l => money(l.value) }], r.stock.lines, { empty: "لا مخزون متبقٍ", emptyIcon: "boxes" }))}</div>`;
  }
  else if (sel === "R01" && !Rep.r01full) h = r01Summary(items, e);
  else if (sel === "R01") h = r01Toggle() + repGroups(groupBy(items.filter(i => !String(i.Allocation_Status).startsWith("Cancelled") && n(i.Requested_Qty) > 0), "Emp_ID"), {
      title: k => empName(e, k), sub: k => `${k} · ${(e[k] || {}).Department || ""} · ${ar((d.resHeaders.find(x => x.Emp_ID === k && x.Phase_ID === ph) || {}).Payment_Method_Selected)}`,
      sort: (x, y) => String(x.Priority_Timestamp).localeCompare(String(y.Priority_Timestamp)),
      stats: l => [["كتاب", l.length], ["نسخة", sum(l, "Requested_Qty")], ["القيمة", l.reduce((s, i) => s + n(i.Requested_Qty) * n(i.Unit_Emp_Price), 0)]],
      cols: [["الكتاب", i => `<b>${esc(bookName(b, i.Book_ID))}</b>${i.Beneficiary ? ` <span class="text-[11px] text-sky-700">لـ ${esc(i.Beneficiary)}</span>` : ""}<div class="text-[11px] text-slate-400 num" dir="ltr">${esc(String(i.Priority_Timestamp).slice(0, 16))}</div>`], ["العدد", i => `<span class="num">${fmt(i.Requested_Qty)}</span>`], ["القيمة", i => `<b class="num">${fmt(n(i.Requested_Qty) * n(i.Unit_Emp_Price))}</b>`]] });
  else if (sel === "R02") { const a = {}; items.forEach(i => { const x = a[i.Book_ID] = a[i.Book_ID] || { r: 0, al: 0, dl: 0 }; x.r += n(i.Requested_Qty); x.al += n(i.Allocated_Qty); x.dl += n(i.Delivered_Qty); });
    h = UI.table([{ t: "الكود", v: "k" }, { t: "الكتاب", v: x => esc(bookName(b, x.k)) }, { t: "المكتبة", v: x => esc((s[(b[x.k] || {}).Supplier_ID] || {}).Supplier_Name) }, { t: "محجوز", cls: "num", v: x => fmt(x.r) }, { t: "مخصص", cls: "num", v: x => fmt(x.al) }, { t: "مُسلَّم", cls: "num", v: x => fmt(x.dl) }, { t: "قبل الخصم", cls: "num", v: x => fmt(x.r * n((b[x.k] || {}).Cover_Price)) }, { t: "بالتكلفة", cls: "num", v: x => fmt(x.r * n((b[x.k] || {}).Standard_Net_Cost)) }], Object.keys(a).map(k => Object.assign({ k }, a[k]))); }
  else if (sel === "R03") { const ids = d.supInvHeaders.filter(x => x.Phase_ID === ph).map(x => x.Sup_Inv_ID);
    h = UI.table([{ t: "الفاتورة", v: "Sup_Inv_ID" }, { t: "الكتاب", v: x => esc(bookName(b, x.Book_ID)) }, { t: "مطلوب", cls: "num", v: x => fmt(x.Ordered_Qty) }, { t: "سليم", cls: "num", v: x => fmt(x.Received_Qty) }, { t: "تالف", cls: "num", v: x => fmt(x.Damaged_Qty) }, { t: "الفرق", cls: "num", v: x => fmt(x.Variance_Qty) }, { t: "النوع", v: x => pill(x.Matching_Flag) }, { t: "سعر مختلف", v: x => esc(x.Price_Mismatch) }], d.supInvItems.filter(x => ids.includes(x.Sup_Inv_ID) && (x.Matching_Flag !== "EXACT" || n(x.Damaged_Qty) || x.Price_Mismatch)), { empty: "لا فروق — كل الفواتير مطابقة", emptyIcon: "circle-check" }); }
  else if (sel === "R04") h = repGroups(groupBy(items.filter(i => !String(i.Allocation_Status).startsWith("Cancelled")), "Book_ID"), {
      title: k => bookName(b, k), sort: (x, y) => String(x.Priority_Timestamp).localeCompare(String(y.Priority_Timestamp)),
      stats: l => { const rq = sum(l, "Requested_Qty"), al = sum(l, "Allocated_Qty"); return [["حاجز", l.length], ["محجوز", rq], ["مخصص", al], ["منتظر", Math.max(0, rq - al)]]; },
      cols: [["#", (i, k) => `<b>${k + 1}</b>`], ["الموظف", i => `<b>${esc(empName(e, i.Emp_ID))}</b>${i.Beneficiary ? ` <span class="text-[11px] text-sky-700">لـ ${esc(i.Beneficiary)}</span>` : ""}<div class="text-[11px] text-slate-400 num" dir="ltr">${esc(String(i.Priority_Timestamp).slice(0, 19))}</div>`], ["محجوز / مخصص", i => `<span class="num">${fmt(i.Requested_Qty)} / <b>${fmt(i.Allocated_Qty)}</b></span>`], ["الحالة", i => pill(i.Allocation_Status)]] });
  else if (sel === "R05") h = repGroups(groupBy(items.filter(i => n(i.Requested_Qty) > Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)) && !String(i.Allocation_Status).startsWith("Cancelled")), "Book_ID"), {
      title: k => bookName(b, k), sort: (x, y) => String(x.Priority_Timestamp).localeCompare(String(y.Priority_Timestamp)), empty: "لا يوجد منتظرون",
      stats: l => [["منتظر", l.reduce((s, i) => s + n(i.Requested_Qty) - Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)), 0)], ["موظف", l.length]],
      cols: [["#", (i, k) => `<b>${k + 1}</b>`], ["الموظف", i => `<b>${esc(empName(e, i.Emp_ID))}</b><div class="text-[11px] text-slate-400 num" dir="ltr">${esc((e[i.Emp_ID] || {}).Mobile || "")} · ${esc(String(i.Priority_Timestamp).slice(0, 16))}</div>`], ["المنتظر", i => `<b class="num">${fmt(n(i.Requested_Qty) - Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)))}</b>`], ["السبب", i => esc(i.Unallocated_Reason || "")]] });
  else if (sel === "R06") h = UI.table([{ t: "الفاتورة", v: "Emp_Inv_ID" }, { t: "الموظف", v: i => esc(empName(e, i.Emp_ID)) }, { t: "قبل الخصم", cls: "num", v: i => fmt(i.Total_Cover_Amount) }, { t: "التوفير", cls: "num", v: i => fmt(i.Total_Savings) }, { t: "الصافي", cls: "num", v: i => `<b>${fmt(i.Net_Final_Invoice_Amount)}</b>` }, { t: "المسدد", cls: "num", v: i => fmt(i.Total_Paid_Amount) }, { t: "المتبقي", cls: "num", v: i => fmt(i.Remaining_Balance) }, { t: "رصيد دائن", cls: "num", v: i => fmt(i.Credit_Balance) }, { t: "الحالة", v: i => pill(i.Invoice_Status) }], d.empInvoices.filter(i => i.Phase_ID === ph));
  else if (sel === "R07") h = UI.table([{ t: "الموظف", v: i => esc(empName(e, i.Emp_ID)) }, { t: "الموبايل", cls: "num", v: i => `<span dir="ltr">${esc((e[i.Emp_ID] || {}).Mobile)}</span>` }, { t: "القسط", v: "Admin_Custom_Notes" }, { t: "الاستحقاق", cls: "num", v: i => esc(day(i.Due_Date)) }, { t: "المبلغ", cls: "num", v: i => fmt(i.Scheduled_Amount) }, { t: "المسدد", cls: "num", v: i => fmt(i.Paid_Amount) }, { t: "المتبقي", cls: "num", v: i => `<b>${fmt(i.Remaining_Inst_Amount)}</b>` }, { t: "الحالة", v: i => pill(i.Status, i.Status === "Scheduled" ? "مجدول" : null) }],
    d.installments.filter(i => String(i.Emp_Inv_ID).indexOf("-" + ph + "-") > 0 && n(i.Remaining_Inst_Amount) > 0).sort((x, y) => String(x.Due_Date).localeCompare(y.Due_Date)), { empty: "لا أقساط مستحقة", emptyIcon: "circle-check" });
  else if (sel === "R08") { const a = {}; d.empPayments.filter(p => !isTrue(p.Is_Voided)).forEach(p => { const k = day(p.Payment_Date) + "|" + p.Payment_Method; a[k] = a[k] || { c: 0, s: 0 }; a[k].c++; a[k].s += n(p.Amount); });
    h = UI.table([{ t: "اليوم", cls: "num", v: x => esc(x.d) }, { t: "الوسيلة", v: x => esc(ar(x.m)) }, { t: "عدد الإيصالات", cls: "num", v: x => fmt(x.c) }, { t: "الإجمالي", cls: "num", v: x => `<b>${fmt(x.s)}</b>` }], Object.keys(a).sort().reverse().map(k => { const [dd, m] = k.split("|"); return { d: dd, m, c: a[k].c, s: a[k].s }; })); }
  else if (sel === "R09") { let bal = 0; h = UI.table([{ t: "التاريخ", cls: "num", v: l => esc(day(l.Trans_Date)) }, { t: "المكتبة", v: l => esc((s[l.Supplier_ID] || {}).Supplier_Name || l.Supplier_ID) }, { t: "البيان", v: "Notes" }, { t: "المرجع", v: "Document_Ref" }, { t: "مدين", cls: "num", v: l => fmt(l.Debit_Amount) }, { t: "دائن", cls: "num", v: l => fmt(l.Credit_Amount) }, { t: "الرصيد", cls: "num", v: l => `<b>${fmt(l._b)}</b>` }], d.supLedger.map(l => { bal += n(l.Credit_Amount) - n(l.Debit_Amount); return Object.assign({ _b: bal }, l); })); }
  else if (sel === "R10") h = UI.table([{ t: "الرقم", v: "Expense_ID" }, { t: "التاريخ", cls: "num", v: x => esc(day(x.Expense_Date)) }, { t: "المرحلة", v: "Phase_ID" }, { t: "البند", v: "Expense_Category" }, { t: "المستفيد", v: "Beneficiary_Name" }, { t: "الإيصال", v: "Receipt_Doc_No" }, { t: "القيمة", cls: "num", v: x => `<b>${fmt(x.Amount)}</b>` }], d.expenses);
  else if (sel === "R11") h = UI.table([{ t: "التاريخ", cls: "num", v: x => esc(dt(x.Trans_Timestamp)) }, { t: "الكتاب", v: x => esc(bookName(b, x.Book_ID)) }, { t: "الحركة", v: "Movement_Type" }, { t: "الكمية", cls: "num", v: x => `<b class="${n(x.Qty_Change) < 0 ? "text-rose-600" : "text-emerald-600"}">${fmt(x.Qty_Change)}</b>` }, { t: "التكلفة", cls: "num", v: x => fmt(x.Unit_Actual_Cost) }, { t: "المستند", v: "Reference_Doc_ID" }, { t: "بواسطة", v: "Recorded_By" }], d.inventoryLedger.slice().reverse());
  else if (sel === "R12") h = UI.table([{ t: "الكتاب", v: x => esc(bookName(b, x.k)) }, { t: "بالمخزن", cls: "num", v: x => fmt(x.onHand) }, { t: "مخصص لم يُسلَّم", cls: "num", v: x => fmt(x.reserved) }, { t: "حر", cls: "num", v: x => fmt(x.free) }, { t: "متوسط التكلفة", cls: "num", v: x => fmt(x.avgCost) }, { t: "القيمة", cls: "num", v: x => `<b>${fmt(x.onHand * x.avgCost)}</b>` }], Object.keys(d.stockMap).filter(k => d.stockMap[k].onHand).map(k => Object.assign({ k }, d.stockMap[k])), { empty: "المخزن فارغ", emptyIcon: "boxes" });
  else if (sel === "R13") h = UI.table([{ t: "الكتاب", v: x => esc(bookName(b, x.Book_ID)) }, { t: "قبل الخصم", cls: "num", v: x => fmt(x.Cover_Price) }, { t: "التكلفة", cls: "num", v: x => fmt(x.Standard_Net_Cost) }, { t: "سعر الموظف", cls: "num", v: x => fmt(x.Emp_Selling_Price) }, { t: "الهامش للنسخة", cls: "num", v: x => `<b class="${x._m < 0 ? "text-rose-600" : "text-emerald-600"}">${fmt(x._m)}</b>` }, { t: "النسخ المحجوزة", cls: "num", v: x => fmt(x._q) }, { t: "إجمالي الهامش", cls: "num", v: x => `<b>${fmt(x._m * x._q)}</b>` }],
    d.books.map(x => Object.assign({ _q: items.filter(i => i.Book_ID === x.Book_ID).reduce((t, i) => t + n(i.Requested_Qty), 0), _m: r2(n(x.Emp_Selling_Price) - n(x.Standard_Net_Cost)) }, x)));
  if (Rep.sel === sel && $("#repArea")) $("#repArea").innerHTML = h;
}

// ---------------------------------------------------------------- R01: ملخص لكل موظف (خفيف التحميل) + تفاصيل الحجز عند الطلب
function r01Toggle() { return `<div class="flex gap-2 mb-3 no-print">${[[0, "ملخص لكل موظف"], [1, "تفصيلي بكل كتاب"]].map(x => `<button class="chip" data-act="r01Mode" data-id="${x[0]}" aria-pressed="${(+!!Rep.r01full) === x[0]}">${x[1]}</button>`).join("")}</div>`; }
on("r01Mode", v => { Rep.r01full = v === "1"; renderReport(); });
function r01Summary(items, e) {
  const d = A(), by = {};
  items.filter(i => !String(i.Allocation_Status).startsWith("Cancelled") && n(i.Requested_Qty) > 0).forEach(i => {
    const o = by[i.Emp_ID] = by[i.Emp_ID] || { id: i.Emp_ID, books: new Set(), q: 0, v: 0, first: i.Priority_Timestamp, rel: new Set(), resId: i.Res_ID };
    o.books.add(i.Book_ID); o.q += n(i.Requested_Qty); o.v += n(i.Requested_Qty) * n(i.Unit_Emp_Price); if (String(i.Priority_Timestamp) < String(o.first)) o.first = i.Priority_Timestamp; if (i.Beneficiary) o.rel.add(i.Beneficiary); });
  const rows = Object.values(by).sort((a, b) => String(a.first).localeCompare(String(b.first)));
  const tq = rows.reduce((s, r) => s + r.q, 0), tv = rows.reduce((s, r) => s + r.v, 0);
  return r01Toggle() + `<div class="grid grid-cols-3 gap-2 mb-3">${UI.stat("موظفين", fmt(rows.length))}${UI.stat("نسخ", fmt(tq))}${UI.stat("القيمة", fmt(tv))}</div>` + UI.table([
    { t: "الرقم", v: r => esc(r.id) },
    { t: "الموظف", v: r => `<b>${esc(empName(e, r.id))}</b><div class="text-[11px] text-slate-400">${esc((e[r.id] || {}).Department || "")}</div>` },
    { t: "الكتب / النسخ", cls: "num", v: r => `${fmt(r.books.size)} / <b>${fmt(r.q)}</b>` },
    { t: "القيمة", cls: "num", v: r => `<b>${fmt(r.v)}</b>` },
    { t: "السداد", v: r => { const h = d.resHeaders.find(x => x.Res_ID === r.resId) || {}; return esc(ar(h.Payment_Method_Selected)) + (h.Payment_Method_Selected === "INSTALLMENT" && h.Payment_Channel ? " · " + esc(ar(h.Payment_Channel)) : ""); } },
    { t: "أول أسبقية", cls: "num", v: r => `<span dir="ltr">${esc(String(r.first).slice(0, 16))}</span>` },
    { t: "للأقارب", v: r => r.rel.size ? [...r.rel].map(x => `<span class="pill pill-blue">${esc(x)}</span>`).join(" ") : "" },
    { t: "", actions: true, v: r => `<button class="btn btn-soft btn-xs" data-act="r01Detail" data-id="${esc(r.id)}" aria-label="تفاصيل الحجز">${ic("eye")} تفاصيل الحجز</button>` }
  ], rows, { maxH: 680, emptyIcon: "notebook-pen", empty: "لا حجوزات في المرحلة" });
}
on("r01Detail", id => {
  const d = A(), { e, b } = maps(), its = d.resItems.filter(i => i.Phase_ID === APP.phaseId && i.Emp_ID === id && !String(i.Allocation_Status).startsWith("Cancelled") && n(i.Requested_Qty) > 0)
    .sort((x, y) => String(x.Priority_Timestamp).localeCompare(String(y.Priority_Timestamp)));
  const h = d.resHeaders.find(x => x.Phase_ID === APP.phaseId && x.Emp_ID === id) || {};
  const tot = its.reduce((s, i) => s + n(i.Requested_Qty) * n(i.Unit_Emp_Price), 0);
  UI.open(`<div class="grid grid-cols-3 gap-2 mb-3">${UI.stat("النسخ", fmt(its.reduce((s, i) => s + n(i.Requested_Qty), 0)))}${UI.stat("القيمة", fmt(tot))}${UI.stat("السداد", esc(ar(h.Payment_Method_Selected)) + (n(h.Installment_Count) ? " · " + h.Installment_Count : ""))}</div>
    <ul class="divide-y divide-slate-100">${its.map(i => `<li class="py-2.5 flex items-start gap-3"><div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px] text-slate-900">${esc(bookName(b, i.Book_ID))}${carriedTag(i)}</div>
      <div class="text-[11.5px] text-slate-500 mt-0.5"><span class="num">${esc(i.Book_ID)}</span>${i.Beneficiary ? ` · لـ <b>${esc(i.Beneficiary)}</b>` : ""} · أسبقية <span class="num" dir="ltr">${esc(String(i.Priority_Timestamp).slice(0, 16))}</span></div></div>
      <div class="text-left shrink-0"><b class="num">${fmt(n(i.Requested_Qty) * n(i.Unit_Emp_Price))}</b><div class="text-[11px] text-slate-500">${fmt(i.Requested_Qty)} نسخة${n(i.Delivered_Qty) ? ` · سُلّم ${fmt(i.Delivered_Qty)}` : n(i.Allocated_Qty) ? ` · مخصص ${fmt(i.Allocated_Qty)}` : ""}</div></div></li>`).join("")}</ul>`,
    { title: "حجز " + empName(e, id), sub: `<span class="num">${esc(id)}</span> · ${esc((e[id] || {}).Department || "")}`, footer: `<div class="flex gap-2 justify-end"><button class="btn btn-outline btn-sm" data-act="printResA" data-id="${esc(id)}">${ic("printer")} طلب الحجز</button></div>` });
});

// ---------------------------------------------------------------- تقارير مجمّعة: العنوان مرة واحدة ثم سطوره (تُبنى عند الفتح فقط — خفيفة على الموبايل)
const groupBy = (arr, key) => { const g = {}; arr.forEach(x => (g[x[key]] = g[x[key]] || []).push(x)); return g; };
function repGroups(g, o) {
  const keys = Object.keys(g); if (!keys.length) return UI.empty("circle-check", o.empty || "لا توجد بيانات");
  Rep._g = { g, o, keys };
  const all = keys.reduce((s, k) => s + g[k].length, 0);
  return `<div class="flex items-center justify-between mb-2 no-print text-[12.5px] text-slate-500"><span><b class="num text-slate-800">${fmt(keys.length)}</b> مجموعة · <b class="num text-slate-800">${fmt(all)}</b> سطر</span><button class="btn btn-ghost btn-xs" data-act="repOpenAll">${ic("chevron-down")} فتح الكل</button></div>
    <div class="space-y-2">${keys.map((k, gi) => { const l = g[k];
      return `<details class="rep-grp relative rounded-2xl ring-1 ring-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,.04),0_6px_16px_-10px_rgba(76,29,149,.25)]" data-rg="${gi}"><summary class="list-none cursor-pointer p-3 pr-4 flex items-start gap-3 hover:bg-brand-50/40">
        <div class="flex-1 min-w-0"><div class="font-bold text-slate-900 text-[14px] leading-snug">${esc(o.title(k))}</div>${o.sub ? `<div class="text-[11.5px] text-slate-500 num">${esc(o.sub(k))}</div>` : ""}
        <div class="flex flex-wrap gap-1.5 mt-1.5">${o.stats(l).map((x, si) => { const tone = /منتظر/.test(x[0]) ? (x[1] > 0 ? "bg-amber-50 ring-amber-200 text-amber-800" : "bg-slate-50 ring-slate-200/70 text-slate-500") : /مخصص|القيمة/.test(x[0]) ? "bg-emerald-50 ring-emerald-200 text-emerald-800" : si === 0 ? "bg-brand-50 ring-brand-200 text-brand-800" : "bg-sky-50 ring-sky-200 text-sky-800";
          return `<span class="inline-flex items-baseline gap-1 rounded-lg ring-1 px-2 py-0.5 text-[11.5px] ${tone}"><span class="opacity-70">${x[0]}</span><b class="num">${fmt(Math.round(x[1]))}</b></span>`; }).join("")}</div></div>
        <span class="w-7 h-7 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-[14px] mt-0.5 rep-chev">▾</span></summary><div class="rg-body"></div></details>`; }).join("")}</div>`;
}
function repFill(el) {
  const R = Rep._g, gi = +el.dataset.rg, body = el.querySelector(".rg-body"); if (!R || body.dataset.done) return;
  const l = R.g[R.keys[gi]].slice().sort(R.o.sort || (() => 0));
  // العمود الرئيسي (الموظف/الكتاب) يأخذ العرض كله، والأعمدة الرقمية والحالة ضيقة بلا التفاف — يناسب الموبايل
  const main = R.o.cols.findIndex(c => /الموظف|الكتاب/.test(c[0])), cls = j => R.o.cols[j][0] === "#" ? "w-7 text-center text-slate-400" : j === main ? "w-full min-w-[8.5rem]" : "w-px whitespace-nowrap text-center text-[12px] [&_.pill]:!text-[10.5px] [&_.pill]:!px-1.5";
  body.innerHTML = `<table class="tbl tbl-grp w-full border-t border-slate-100"><thead><tr>${R.o.cols.map((c, j) => `<th class="${cls(j)}">${c[0]}</th>`).join("")}</tr></thead><tbody>${l.map((x, k) => `<tr>${R.o.cols.map((c, j) => `<td class="align-top ${cls(j)}">${c[1](x, k)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  body.dataset.done = 1;
}
document.addEventListener("toggle", ev => { const el = ev.target; if (el && el.matches && el.matches("details[data-rg]") && el.open) repFill(el); }, true);
on("repOpenAll", () => $$("#repArea details[data-rg]").forEach(d => { repFill(d); d.open = true; }));

// ================================================================ (1) ترتيب + (2) بحث داخل أي تقرير — على الجهاز بالكامل بلا أي طلب للخادم
Rep.q = ""; Rep.sort = { k: -1, dir: 1 };
const repTxt = el => (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
const repNum = t => { const m = String(t).replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? +m[0] : NaN; };
function repToolbar() {
  const area = $("#repArea"); if (!area || area.querySelector(".rep-tools")) return;
  const grp = !!area.querySelector("details[data-rg]"), th = area.querySelector("table thead") ? [...area.querySelector("table thead tr").children].map(repTxt) : [];
  const opts = grp ? [["0", "الاسم"]].concat(((Rep._g && Rep._g.o.stats(Rep._g.g[Rep._g.keys[0]] || [])) || []).map((s, i) => [String(i + 1), s[0]])) : th.map((t, i) => [String(i), t]).filter(x => x[1]);
  if (!grp && !area.querySelector("table")) return;
  area.insertAdjacentHTML("afterbegin", `<div class="rep-tools no-print flex flex-wrap items-center gap-2 mb-3">
    <div class="relative flex-1 min-w-[10rem]"><input class="input !h-10 !pr-9 text-[13.5px]" placeholder="ابحث باسم موظف أو كتاب…" data-rq value="${esc(Rep.q)}"><span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">${ic("search")}</span></div>
    ${opts.length ? `<select class="input !h-10 !w-auto text-[13px]" data-rs><option value="-1">ترتيب: الافتراضي</option>${opts.map(o => `<option value="${o[0]}" ${String(Rep.sort.k) === o[0] ? "selected" : ""}>ترتيب: ${esc(o[1])}</option>`).join("")}</select>
    <button class="btn btn-outline !h-10 !px-3" data-rd title="عكس الترتيب" aria-label="عكس الترتيب">${Rep.sort.dir > 0 ? "↑" : "↓"}</button>` : ""}
    <span class="text-[12px] text-slate-500 num" data-rc></span></div>`);
  const tb = area.querySelector(".rep-tools");
  tb.querySelector("[data-rq]").addEventListener("input", e => { Rep.q = e.target.value; repApply(); });
  const rs = tb.querySelector("[data-rs]"); if (rs) rs.addEventListener("change", e => { Rep.sort.k = +e.target.value; repApply(); });
  const rd = tb.querySelector("[data-rd]"); if (rd) rd.addEventListener("click", () => { Rep.sort.dir *= -1; rd.textContent = Rep.sort.dir > 0 ? "↑" : "↓"; repApply(); });
  // الضغط على عنوان العمود (الكمبيوتر) يرتّب أيضاً
  $$("table thead th", area).forEach((h, i) => { if (h.closest("details")) return; h.style.cursor = "pointer"; h.title = "اضغط للترتيب"; h.addEventListener("click", () => { Rep.sort.dir = Rep.sort.k === i ? -Rep.sort.dir : 1; Rep.sort.k = i; if (rs) rs.value = String(i); if (rd) rd.textContent = Rep.sort.dir > 0 ? "↑" : "↓"; repApply(); }); });
  repApply();
}
function repApply() {
  const area = $("#repArea"); if (!area) return;
  const q = Rep.q.trim().toLowerCase(), { k, dir } = Rep.sort; let shown = 0, total = 0;
  const cmp = (a, b) => { const na = repNum(a), nb = repNum(b); return (isNaN(na) || isNaN(nb) ? String(a).localeCompare(String(b), "ar") : na - nb) * dir; };
  const groups = $$("details[data-rg]", area);
  if (groups.length) {
    const R = Rep._g, box = groups[0].parentElement;
    const rowTxt = gi => { const l = R.g[R.keys[gi]]; return l._t || (l._t = l.map(x => [x.Emp_ID, x.Book_ID, x.Beneficiary, R.o.cols.map(c => String(c[1](x, 0)).replace(/<[^>]+>/g, " ")).join(" ")].join(" ")).join(" ").toLowerCase()); };
    groups.forEach(g => { const gi = +g.dataset.rg, hit = !q || repTxt(g.querySelector("summary")).toLowerCase().includes(q) || rowTxt(gi).includes(q); g.hidden = !hit; total++; if (hit) shown++;
      if (q && hit && !repTxt(g.querySelector("summary")).toLowerCase().includes(q)) { repFill(g); g.open = true; $$(".rg-body tbody tr", g).forEach(tr => { tr.hidden = !repTxt(tr).toLowerCase().includes(q); }); }
      else $$(".rg-body tbody tr", g).forEach(tr => { tr.hidden = false; }); });
    if (k >= 0) groups.slice().sort((a, b) => { const sa = R.o.stats(R.g[R.keys[+a.dataset.rg]]), sb = R.o.stats(R.g[R.keys[+b.dataset.rg]]);
      return k === 0 ? cmp(R.o.title(R.keys[+a.dataset.rg]), R.o.title(R.keys[+b.dataset.rg])) : cmp((sa[k - 1] || [])[1], (sb[k - 1] || [])[1]); }).forEach(g => box.appendChild(g));
  } else {
    const tbody = area.querySelector("table tbody"), cards = area.querySelector(".lg\\:hidden.grid");
    if (tbody) {
      const rows = [...tbody.children], cs = cards ? [...cards.children] : [];
      rows.forEach((tr, i) => { tr._i = i; });
      const order = k >= 0 ? rows.slice().sort((a, b) => cmp(repTxt(a.children[k] || a), repTxt(b.children[k] || b))) : rows.slice().sort((a, b) => a._i - b._i);
      order.forEach(tr => { tbody.appendChild(tr); const hit = !q || repTxt(tr).toLowerCase().includes(q); tr.hidden = !hit; total++; if (hit) shown++;
        const c = cs[tr._i]; if (c) { cards.appendChild(c); c.hidden = !hit; } });
    }
  }
  const rc = area.querySelector("[data-rc]"); if (rc) rc.textContent = q ? `${shown} من ${total}` : "";
}
new MutationObserver(() => { if (Router.current !== "/a/reports") return; const a = $("#repArea"); if (a && !a.querySelector(".rep-tools") && !a.querySelector(".skeleton")) repToolbar(); })
  .observe(document.body, { childList: true, subtree: true });

// ================================================================ (3) صورة المجموعة للمشاركة على واتساب
const _repFill0 = repFill;
repFill = function (el) {
  _repFill0(el);
  const body = el.querySelector(".rg-body"); if (!body || body.querySelector("[data-rgshot]")) return;
  body.insertAdjacentHTML("beforeend", `<div class="no-print flex justify-end gap-2 p-2 border-t border-slate-100">${Rep.sel !== "R01" ? `<button class="btn btn-ghost btn-xs" data-act="bookFile" data-id="${esc(Rep._g.keys[+el.dataset.rg])}">${ic("book-open")} ملف الكتاب</button>` : ""}<button class="btn btn-soft btn-xs" data-rgshot="${el.dataset.rg}">${ic("download")} صورة للمشاركة</button></div>`);
  body.querySelector("[data-rgshot]").addEventListener("click", () => {
    const R = Rep._g, k = R.keys[+el.dataset.rg], tb = body.querySelector("table").cloneNode(true); $$("tr[hidden]", tb).forEach(r => r.remove());
    const cur = REPORTS.find(r => r[0] === Rep.sel) || [];
    const stats = R.o.stats(R.g[k]).map(s => `${s[0]} <b>${fmt(Math.round(s[1]))}</b>`).join(" · ");
    Doc.show(R.o.title(k), Doc.page(`${Doc.head(cur[2] || "تقرير", "")}<h3 style="margin:2mm 0 1mm;font-size:13pt">${esc(R.o.title(k))}</h3><p class="sub" style="margin:0 0 2mm">${stats}${phaseObj().Phase_Name ? " · " + esc(phaseObj().Phase_Name) : ""}</p>${tb.outerHTML.replace(/class="[^"]*"/g, "")}${Doc.foot("")}`, "", "", "dense"), { file: (cur[0] || "rep") + "-" + k });
  });
};

// ================================================================ (5) مقارنة المراحل
REPORTS.push(["R17", "arrow-left-right", "مقارنة المراحل", "الحاجزون والنسخ والقيمة والتحصيل لكل مرحلة جنب بعض"]);
const _renderReport0 = renderReport;
renderReport = async function () {
  if (Rep.sel !== "R17") return _renderReport0();
  const d = A(), area = $("#repArea"); if (!area) return; const { b } = maps();
  const ph = d.phases.slice(-4), live = i => !String(i.Allocation_Status).startsWith("Cancelled") && n(i.Requested_Qty) > 0;
  const m = ph.map(p => { const its = d.resItems.filter(i => i.Phase_ID === p.Phase_ID && live(i)), invs = d.empInvoices.filter(i => i.Phase_ID === p.Phase_ID), emps = new Set(its.map(i => i.Emp_ID)).size;
    const val = its.reduce((s, i) => s + n(i.Requested_Qty) * n(i.Unit_Emp_Price), 0), net = sum(invs, "Net_Final_Invoice_Amount"), paid = sum(invs, "Total_Paid_Amount");
    const top = {}; its.forEach(i => { top[i.Book_ID] = (top[i.Book_ID] || 0) + n(i.Requested_Qty); });
    return { p, emps, copies: sum(its, "Requested_Qty"), val, avg: emps ? val / emps : 0, kin: its.filter(i => i.Beneficiary).length, net, paid, pct: net ? Math.round(paid / net * 100) : 0, deliv: sum(its, "Delivered_Qty"),
      top: Object.entries(top).sort((x, y) => y[1] - x[1]).slice(0, 3).map(x => bookName(b, x[0])) }; });
  const rows = [["الحاجزون", x => fmt(x.emps)], ["النسخ المحجوزة", x => fmt(x.copies)], ["قيمة الحجز", x => money(x.val)], ["متوسط الأسرة", x => money(Math.round(x.avg))], ["حجوزات للأقارب", x => fmt(x.kin)],
    ["صافي الفواتير", x => money(x.net)], ["المحصَّل", x => money(x.paid)], ["نسبة التحصيل", x => x.pct + "%"], ["المُسلَّم", x => fmt(x.deliv)], ["الأكثر طلباً", x => x.top.map(esc).join("<br>") || "—"]];
  const delta = (k, i) => { if (!i) return ""; const a = m[i - 1][k], c = m[i][k]; if (!a) return ""; const p = Math.round((c - a) / a * 100); return p ? ` <span class="text-[10.5px] ${p > 0 ? "text-emerald-600" : "text-rose-600"}">${p > 0 ? "▲" : "▼"}${Math.abs(p)}%</span>` : ""; };
  const keyOf = ["emps", "copies", "val", "avg", "kin", "net", "paid", "pct", "deliv"];
  area.innerHTML = m.length < 2 ? UI.empty("arrow-left-right", "محتاج مرحلتين على الأقل للمقارنة") : `<div class="overflow-x-auto -mx-1"><table class="tbl tbl-grp w-full"><thead><tr><th class="w-full">البند</th>${m.map(x => `<th class="whitespace-nowrap text-center">${esc(x.p.Phase_Name || x.p.Phase_ID)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r, ri) => `<tr><td class="font-semibold">${r[0]}</td>${m.map((x, i) => `<td class="text-center num whitespace-nowrap text-[12.5px]">${r[1](x)}${keyOf[ri] ? delta(keyOf[ri], i) : ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="text-[11.5px] text-slate-500 mt-2">▲▼ التغيّر مقارنة بالمرحلة اللي قبلها. آخر 4 مراحل.</p>`;
};
