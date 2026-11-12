/* ============================================================================
 * لوحة الإدارة
 * ========================================================================== */
"use strict";
const Admin = {
  async load() {
    const r = await call("GET_ADMIN_DASHBOARD_DATA");
    if (!r.success) { toast(r.message, "danger"); return; }
    APP.adm = r; store.set("cache", { t: "ADMIN", d: r, p: APP.phaseId });
    if (!APP.phaseId || !r.phases.find(p => p.Phase_ID === APP.phaseId)) {
      const op = r.phases.filter(p => p.Phase_Status !== "Completed");
      APP.phaseId = (op[op.length - 1] || r.phases[r.phases.length - 1] || {}).Phase_ID;
    }
    Shell.rerender();
  }
};
const A = () => APP.adm;
const phaseObj = () => A().phases.find(p => p.Phase_ID === APP.phaseId) || {};
const maps = () => ({ e: by(A().employees, "Emp_ID"), b: by(A().books, "Book_ID"), s: by(A().suppliers, "Supplier_ID") });
const phaseItems = () => A().resItems.filter(i => i.Phase_ID === APP.phaseId && !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward");
const empName = (e, id) => (e[id] || {}).Full_Name || id;
const bookName = (b, id) => (b[id] || {}).Book_Name || id;
const noPhase = view => { if (APP.phaseId) return false; view.innerHTML = UI.empty("calendar-range", "لا توجد مراحل بعد", "ابدأ بإنشاء أول مرحلة حجز.", can("SAVE_PHASE") ? `<button class="btn btn-primary mt-5" data-act="phaseForm">${ic("plus")} مرحلة جديدة</button>` : ""); return true; };
const lockedBtn = (action, html) => can(action) ? html : "";
const searchBox = (act, val, ph) => `<div class="input-icon w-full sm:w-72">${ic("search")}<input type="search" class="input input-sm !h-10" placeholder="${esc(ph || "بحث")}" value="${esc(val || "")}" data-input="${act}"></div>`;
const Q = {};   // نصوص البحث لكل صفحة
const rerenderList = (key, fn) => { const el = $("#" + key); if (el) el.innerHTML = fn(); };

// ============================================================ لوحة القيادة
const FLOW = [["Open", "الحجز", "calendar-check"], ["Closed", "إغلاق الحجز", "lock"], ["Ordered", "طلب التوريد", "clipboard-list"], ["Receiving", "الاستلام والجرد", "truck"], ["Delivering", "التوزيع والتسليم", "package-check"], ["Completed", "الإغلاق", "circle-check"]];
const NEXT = {
  Draft: ["افتح الحجز للموظفين", "SET_PHASE_STATUS", "Open"], Scheduled: ["الحجز سيبدأ تلقائياً في موعده", null], Open: ["أغلق الحجز ثم جمّد الحصر", "SET_PHASE_STATUS", "Closed"],
  Closed: ["جمّد الحصر وأرسل طلب التوريد", "go", "/a/po"], Ordered: ["أدخل فاتورة المكتبة ونتيجة الجرد", "go", "/a/receive"], Receiving: ["شغّل التوزيع بالأسبقية", "go", "/a/alloc"],
  Delivering: ["سلّم الكتب وحصّل المقدمات", "go", "/a/delivery"], Completed: ["المرحلة مكتملة — راجع التصفية", "go", "/a/reports"]
};
/* ---------- ملخصات عامة (لا تحتاج مرحلة): جاهزية الأسعار، الأعضاء، صحة المهام الليلية ---------- */
const STAGE_ORDER = () => [...new Set(((A().catalog || {}).grades || []).map(g => g.stage))];
function overviewKpis() {
  const d = A(), bk = d.books.filter(x => x.Book_Status !== "Discontinued");
  const pricing = bk.filter(x => x.Book_Status === "Pricing").length, priced = bk.length - pricing;
  const active = d.employees.filter(e => !/موقوف|Suspended|Inactive/i.test(e.Employment_Status || "")).length;
  return `<div class="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6">
    ${UI.kpi("أعضاء المبادرة", fmt(d.employees.length), { icon: "users", tone: "brand", foot: `${fmt(active)} نشط · مزامنة يومية من MyNekaba` })}
    ${UI.kpi("الكتب في الدليل", fmt(bk.length), { icon: "library-big", tone: "gray", foot: `${fmt(new Set(bk.map(x => x.Publisher)).size)} ناشر · ${fmt(new Set(bk.map(x => x.Subject)).size)} مادة` })}
    ${UI.kpi("كتب مسعّرة", fmt(priced), { icon: "badge-check", tone: priced === bk.length ? "green" : "brand", pct: bk.length ? priced / bk.length * 100 : 0, foot: bk.length ? Math.round(priced / bk.length * 100) + "% من الدليل" : "" })}
    ${UI.kpi("جاري التسعير", fmt(pricing), { icon: "hourglass", tone: pricing ? "amber" : "green", foot: pricing ? `<a href="#/a/books" data-act="goPricing" class="text-brand-700 font-semibold">سعّرها الآن ←</a>` : "كل الكتب مسعّرة" })}
  </div>`;
}
function pricingByStage() {
  const bk = A().books.filter(x => x.Book_Status !== "Discontinued"), g = {};
  bk.forEach(x => { const k = x.Stage || "أخرى"; g[k] = g[k] || [0, 0]; g[k][1]++; if (x.Book_Status !== "Pricing") g[k][0]++; });
  const ord = STAGE_ORDER(), keys = Object.keys(g).sort((a, b) => (ord.indexOf(a) + 99 * (ord.indexOf(a) < 0)) - (ord.indexOf(b) + 99 * (ord.indexOf(b) < 0)));
  if (!keys.length) return UI.empty("library-big", "الدليل فارغ");
  return UI.bars(keys.map(k => ({ label: `${k} — ${fmt(g[k][0])} من ${fmt(g[k][1])}`, value: Math.round(g[k][0] / g[k][1] * 100), tone: g[k][0] === g[k][1] ? "bg-emerald-500" : "bg-amber-500" })), v => v + "%");
}
function healthBox() {
  setTimeout(loadHealth, 0);
  return `<div id="sysHealth">${UI.skeleton(1)}</div>`;
}
async function loadHealth() {
  const el = $("#sysHealth"); if (!el) return;
  const NAMES = { SYNC_MEMBERS: ["مزامنة الأعضاء من MyNekaba", "refresh-cw"], DAILY_JOB: ["المهمة اليومية (الأقساط والحالات)", "calendar-clock"], SNAPSHOT: ["النسخة الاحتياطية اليومية", "database"] };
  let h = null;
  try { h = await (await fetch(API_URL + (API_URL.includes("?") ? "&" : "?") + "health")).json(); } catch (_) {}
  if (!$("#sysHealth")) return;
  if (!h || !h.jobs) { el.innerHTML = `<div class="text-sm text-slate-500">تعذر قراءة حالة المهام الآن.</div>`; return; }
  el.innerHTML = `<ul class="space-y-2">${Object.keys(NAMES).map(k => { const j = h.jobs[k] || {}; return `<li class="flex items-center gap-3 rounded-2xl p-3 ring-1 ring-slate-100">
    <span class="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${j.ok ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}">${ic(NAMES[k][1])}</span>
    <span class="flex-1"><span class="block font-semibold text-[13.5px] text-slate-800">${NAMES[k][0]}</span><span class="block text-[12px] text-slate-500 num">${j.last ? "آخر تشغيل: " + esc(dt(j.last)) : "لم تعمل بعد"}</span></span>
    ${j.ok ? pillTxt("سليمة", "green") : pillTxt("تحتاج مراجعة", "red")}</li>`; }).join("")}</ul>`;
}
const pillTxt = (t, c) => `<span class="text-[11.5px] font-bold rounded-full px-2.5 py-1 ${c === "green" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}">${t}</span>`;
on("goPricing", () => { Q.bookF = { st: "Pricing" }; Router.go("/a/books"); });
function overviewSections() {
  return `<div class="grid gap-4 sm:gap-6 lg:grid-cols-2 mt-4 sm:mt-6">
    ${UI.section(`${ic("badge-check", "text-brand-600")} جاهزية الأسعار`, "نسبة الكتب المسعّرة في كل مرحلة دراسية", pricingByStage(), can("SAVE_BOOK") ? `<a href="#/a/books" data-act="goPricing" class="btn btn-ghost btn-sm">الكتب ${ic("chevron-left")}</a>` : "")}
    ${UI.section(`${ic("activity", "text-brand-600")} صحة المنظومة`, "المهام الليلية خلال آخر 26 ساعة", healthBox())}
  </div>`;
}

Router.add("/a/dash", view => {
  if (!APP.phaseId) {
    view.innerHTML = `<section class="hero text-white rounded-4xl p-5 sm:p-7 shadow-lift"><div class="text-brand-200 text-sm">لوحة القيادة</div><h1 class="text-2xl font-bold mt-0.5">لا توجد مرحلة حجز بعد</h1>
      <p class="text-brand-200 text-[13px] mt-1">جهّز الأسعار ثم أنشئ أول مرحلة حجز.</p>${can("SAVE_PHASE") ? `<button class="btn btn-gold btn-sm mt-4" data-act="phaseForm">${ic("plus")} مرحلة جديدة</button>` : ""}</section>`
      + overviewKpis() + overviewSections();
    return;
  }
  const d = A(), ph = phaseObj(), items = phaseItems(), { b } = maps();
  const invs = d.empInvoices.filter(i => i.Phase_ID === APP.phaseId);
  const people = new Set(items.map(i => i.Emp_ID)).size;
  const req = sum(items, "Requested_Qty"), al = sum(items, "Allocated_Qty"), dl = sum(items, "Delivered_Qty");
  const waiting = items.reduce((s, i) => s + Math.max(0, n(i.Requested_Qty) - Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty))), 0);
  const billed = sum(invs, "Net_Final_Invoice_Amount"), paid = sum(invs, "Total_Paid_Amount"), rem = sum(invs, "Remaining_Balance");
  const overdue = d.installments.filter(i => i.Status === "Overdue").reduce((s, i) => s + n(i.Remaining_Inst_Amount), 0);
  const st = ph.Effective_Status || ph.Phase_Status, cur = FLOW.findIndex(s => s[0] === st);
  const nx = NEXT[st] || ["", null];

  // تنبيهات قابلة للتنفيذ
  const alerts = [];
  const notPaidDown = invs.filter(i => n(i.Total_Paid_Amount) < n(i.Down_Payment_Required)).length;
  if (waiting) alerts.push(["hourglass", "amber", `${waiting} نسخة في قائمة الانتظار`, "أدخل فاتورة النواقص وشغّل التوزيع، أو رحّلهم للمرحلة التالية.", "/a/alloc"]);
  if (notPaidDown) alerts.push(["hand-coins", "amber", `${notPaidDown} موظف لم يسدد المقدم`, "لن يُسلَّم قبل سداد المقدم.", "/a/collect"]);
  const openPO = d.poSnapshots.filter(p => p.Line_Status === "Open").reduce((s, p) => s + n(p.Outstanding_Qty), 0);
  if (openPO) alerts.push(["truck", "blue", `المكتبة مدينة بـ ${openPO} نسخة`, "نواقص لم تُورَّد بعد من طلبات التوريد.", "/a/po"]);
  const refunds = d.empInvoices.filter(i => n(i.Credit_Balance) > 0).length;
  if (refunds) alerts.push(["undo-2", "blue", `${refunds} موظف لهم أرصدة مستحقة الرد`, "سجّل رد الرصيد من صفحة التحصيل.", "/a/collect"]);
  const loss = d.books.filter(x => n(x.Emp_Selling_Price) < n(x.Standard_Net_Cost));
  if (loss.length) alerts.push(["triangle-alert", "red", `${loss.length} كتاب يُباع بأقل من تكلفته`, "راجع الأسعار أو تقرير الهامش.", "/a/books"]);
  if (overdue) alerts.push(["circle-alert", "red", `أقساط متأخرة ${moneyTxt(overdue)}`, "تابع التحصيل من الموظفين المتأخرين.", "/a/collect"]);

  // أكثر الكتب طلباً
  const agg = {}; items.forEach(i => agg[i.Book_ID] = (agg[i.Book_ID] || 0) + n(i.Requested_Qty));
  const top = Object.keys(agg).sort((x, y) => agg[y] - agg[x]).slice(0, 6).map((k, i) => ({ label: bookName(b, k), value: agg[k], tone: i === 0 ? "bg-gradient-to-l from-brand-500 to-brand-700" : "bg-brand-400/80" }));
  const pays = d.empPayments.filter(p => !isTrue(p.Is_Voided) && n(p.Amount) > 0 && String(p.Emp_Inv_ID || "").indexOf("-" + APP.phaseId + "-") > 0);
  const byM = {}; pays.forEach(p => byM[p.Payment_Method] = (byM[p.Payment_Method] || 0) + n(p.Amount));
  const MCOL = { CASH: "#059669", INSTAPAY: "#7c4bb6", WALLET: "#0ea5e9", PAYROLL: "#f0930b" };
  const recent = pays.slice(-5).reverse(), { e } = maps();
  const sAgg = {}; items.forEach(i => { const k = (b[i.Book_ID] || {}).Stage || "أخرى"; sAgg[k] = (sAgg[k] || 0) + n(i.Requested_Qty); });
  const so = STAGE_ORDER(), byStage = Object.keys(sAgg).sort((x, y) => so.indexOf(x) - so.indexOf(y)).map(k => ({ label: k, value: sAgg[k] }));
  const dAgg = {}; [...new Set(items.map(i => i.Emp_ID))].forEach(id => { const k = (e[id] || {}).Department || "غير محدد"; dAgg[k] = (dAgg[k] || 0) + 1; });
  const byDept = Object.keys(dAgg).sort((x, y) => dAgg[y] - dAgg[x]).slice(0, 8).map(k => ({ label: k, value: dAgg[k], tone: "bg-sky-500" }));

  view.innerHTML = `
  <section class="hero text-white rounded-4xl p-5 sm:p-7 shadow-lift relative overflow-hidden">
    <div class="absolute -left-20 -top-24 w-72 h-72 rounded-full bg-white/5"></div>
    <div class="relative flex flex-wrap items-start justify-between gap-4">
      <div><div class="text-brand-200 text-sm">المرحلة الحالية</div><h1 class="text-2xl sm:text-[28px] font-bold mt-0.5">${esc(ph.Phase_Name)}</h1>
        <div class="text-brand-200 text-[13px] mt-1 num">${esc(day(ph.Start_DateTime))} ← ${esc(day(ph.End_DateTime))}${ph.Delivery_Start_Date ? ` · التسليم من ${esc(day(ph.Delivery_Start_Date))}` : ""}</div></div>
      <div class="flex flex-wrap gap-2">${nx[1] === "go" ? `<a href="#${nx[2]}" class="btn btn-gold btn-sm">${esc(nx[0])} ${ic("chevron-left")}</a>` : nx[1] && can(nx[1]) ? `<button class="btn btn-gold btn-sm" data-act="setStatus" data-id="${nx[2]}">${esc(nx[0])}</button>` : nx[0] ? `<span class="text-sm text-brand-200">${esc(nx[0])}</span>` : ""}
        ${can("SET_PHASE_STATUS") ? `<button class="btn btn-sm bg-white/10 text-white hover:bg-white/20" data-act="statusMenu">${ic("sliders-horizontal")} الحالة</button>` : ""}</div>
    </div>
    <ol class="relative mt-7 grid grid-cols-6 gap-1">${FLOW.map((s, i) => `<li class="flex flex-col items-center text-center">
      <div class="w-full flex items-center"><span class="h-0.5 flex-1 ${i && i <= cur ? "bg-gold-400" : i ? "bg-white/15" : "bg-transparent"}"></span>
      <span class="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${i < cur ? "bg-gold-400 text-brand-950" : i === cur ? "bg-white text-brand-800 ring-4 ring-white/20" : "bg-white/10 text-brand-200"}">${ic(i < cur ? "check" : s[2])}</span>
      <span class="h-0.5 flex-1 ${i < FLOW.length - 1 && i < cur ? "bg-gold-400" : i < FLOW.length - 1 ? "bg-white/15" : "bg-transparent"}"></span></div>
      <span class="mt-2 text-[10.5px] sm:text-xs font-semibold leading-tight ${i <= cur ? "text-white" : "text-brand-300"}">${s[1]}</span></li>`).join("")}</ol>
  </section>

  <div class="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mt-4 sm:mt-6">
    ${UI.kpi("الموظفون الحاجزون", fmt(people), { icon: "users", tone: "brand", foot: `${fmt(d.employees.length)} موظف مسجل` })}
    ${UI.kpi("النسخ المحجوزة", fmt(req), { icon: "book-open", tone: "blue", foot: `مخصص ${fmt(al)} · مُسلَّم ${fmt(dl)}`, pct: req ? dl / req * 100 : 0 })}
    ${UI.kpi("في قائمة الانتظار", fmt(waiting), { icon: "hourglass", tone: waiting ? "amber" : "green" })}
    ${UI.kpi("أقساط متأخرة", money(overdue), { icon: "triangle-alert", tone: overdue ? "red" : "green", foot: "كل المراحل" })}
    ${UI.kpi("فواتير المرحلة", money(billed), { icon: "receipt", tone: "brand", foot: `${invs.length} فاتورة` })}
    ${UI.kpi("المحصَّل", money(paid), { icon: "circle-check", tone: "green", pct: billed ? paid / billed * 100 : 0 })}
    ${UI.kpi("المتبقي على الموظفين", money(rem), { icon: "hand-coins", tone: "amber" })}
    ${UI.kpi("الكتب في الكتالوج", fmt(d.books.length), { icon: "library-big", tone: "gray", foot: `${fmt(d.suppliers.length)} مكتبة متعاقدة` })}
  </div>

  <div class="grid gap-4 sm:gap-6 lg:grid-cols-3 mt-4 sm:mt-6">
    ${UI.section(`${ic("chart-pie", "text-brand-600")} موقف التحصيل`, "صافي فواتير المرحلة", billed ? UI.ring([{ label: "محصَّل", value: paid, color: "#059669" }, { label: "متبقٍ غير متأخر", value: Math.max(0, rem - overdue), color: "#c4b0e3" }, { label: "متأخر", value: Math.min(overdue, rem), color: "#e11d48" }], `<div class="text-xl font-bold num text-slate-900">${billed ? Math.round(paid / billed * 100) : 0}%</div><div class="text-[11px] text-slate-500">محصَّل</div>`) : UI.empty("receipt", "لم تصدر فواتير بعد", "تصدر بعد التوزيع."))}
    ${UI.section(`${ic("trending-up", "text-brand-600")} الأكثر طلباً`, "بعدد النسخ المحجوزة", top.length ? UI.bars(top) : UI.empty("book-open", "لا حجوزات بعد"))}
    ${UI.section(`${ic("triangle-alert", "text-amber-500")} يحتاج إجراء`, "", alerts.length ? `<ul class="space-y-2">${alerts.map(a => `<li><a href="#${a[4]}" class="flex items-start gap-3 rounded-2xl p-3 ring-1 ring-slate-100 hover:bg-slate-50 transition">
      <span class="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${{ amber: "bg-amber-50 text-amber-600", red: "bg-rose-50 text-rose-600", blue: "bg-sky-50 text-sky-600" }[a[1]]}">${ic(a[0])}</span>
      <span class="flex-1"><span class="block font-semibold text-[13.5px] text-slate-800">${esc(a[2])}</span><span class="block text-[12px] text-slate-500 mt-0.5">${esc(a[3])}</span></span>${ic("chevron-left", "text-slate-300 mt-2")}</a></li>`).join("")}</ul>` : `<div class="rounded-2xl bg-emerald-50 text-emerald-700 p-4 flex items-center gap-3 font-semibold text-sm">${ic("circle-check", "text-xl")} كل شيء على ما يرام</div>`)}
  </div>
  <div class="grid gap-4 sm:gap-6 lg:grid-cols-2 mt-4 sm:mt-6">
    ${UI.section(`${ic("wallet", "text-brand-600")} التحصيل حسب الوسيلة`, "", Object.keys(byM).length ? UI.ring(Object.keys(byM).map(k => ({ label: ar(k), value: byM[k], color: MCOL[k] || "#94a3b8" })), `<div class="text-lg font-bold num">${fmt(sum(Object.values(byM), x => x))}</div><div class="text-[11px] text-slate-500">ج.م</div>`) : UI.empty("wallet", "لا تحصيلات بعد"))}
    ${UI.section(`${ic("receipt", "text-brand-600")} آخر الإيصالات`, "", recent.length ? `<ul class="divide-y divide-slate-100">${recent.map(p => `<li class="flex items-center gap-3 py-2.5">${UI.avatar(empName(e, p.Emp_ID), "w-9 h-9 text-xs")}<div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px] truncate">${esc(empName(e, p.Emp_ID))}</div><div class="text-[11.5px] text-slate-400 num">${esc(p.Receipt_No)} · ${esc(ar(p.Payment_Method))} · ${esc(dt(p.Payment_Date))}</div></div><div class="font-bold num text-emerald-600">${fmt(p.Amount)}</div></li>`).join("")}</ul>` : UI.empty("receipt", "لا إيصالات بعد"), `<a href="#/a/cash" class="btn btn-ghost btn-sm">الكل ${ic("chevron-left")}</a>`)}
  </div>
  <div class="grid gap-4 sm:gap-6 lg:grid-cols-2 mt-4 sm:mt-6">
    ${UI.section(`${ic("graduation-cap", "text-brand-600")} الحجز حسب المرحلة الدراسية`, "عدد النسخ المحجوزة", byStage.length ? UI.bars(byStage) : UI.empty("graduation-cap", "لا حجوزات بعد"))}
    ${UI.section(`${ic("building-2", "text-brand-600")} أكثر جهات العمل حجزاً`, "عدد الموظفين الحاجزين", byDept.length ? UI.bars(byDept) : UI.empty("building-2", "لا حجوزات بعد"))}
  </div>
  <h2 class="text-lg font-bold text-slate-800 mt-8">ملخص المنظومة</h2>
  ${overviewKpis()}${overviewSections()}`;
});
on("setStatus", async st => { const lbl = (FLOW.find(f => f[0] === st) || [, ar(st)])[1]; await act("SET_PHASE_STATUS", { phaseId: APP.phaseId, status: st }, { title: "تغيير حالة المرحلة", message: `تغيير حالة «${phaseObj().Phase_Name}» إلى: ${lbl}؟` }); });
on("statusMenu", async () => {
  const v = await UI.form({ title: "حالة المرحلة", sub: phaseObj().Phase_Name, intro: "المراحل الوسيطة (طلب التوريد، الاستلام، التوزيع) تتغير تلقائياً مع تنفيذ عملياتها.",
    fields: [{ name: "st", label: "الحالة الجديدة", type: "select", value: phaseObj().Phase_Status, options: [["Open", "فتح الحجز"], ["Closed", "إغلاق الحجز"], ["Completed", "إغلاق المرحلة نهائياً"]] }], ok: "تطبيق" });
  if (v) await act("SET_PHASE_STATUS", { phaseId: APP.phaseId, status: v.st });
});

// ============================================================ الكتب والأسعار
function bookPrice(f) {
  const sup = A().suppliers.find(s => s.Supplier_ID === f.supplierId) || {};
  const cover = n(f.coverPrice), sd = n(f.supplierDiscountPct);
  const vd = f.volumeDiscountSharePct === "" || f.volumeDiscountSharePct === undefined ? n(sup.Volume_Discount_Pct) : n(f.volumeDiscountSharePct);
  const ed = f.empDiscountPct === "" || f.empDiscountPct === undefined ? n(A().settingsMap.UNIFIED_EMP_DISCOUNT_PCT) : n(f.empDiscountPct);
  const first = r2(cover * (1 - sd / 100)), cost = r2(first - Math.round(first * vd) / 100), emp = ceil(cover * (1 - ed / 100));
  return { first, cost, emp, margin: r2(emp - cost), vd, ed };
}
function booksTable() {
  const d = A(), st = d.stockMap || {}, q = (Q.books || "").toLowerCase();
  const f = Q.bookF || {};
  const list = d.books.filter(x => (!q || (x.Book_ID + x.Book_Name + x.Grade + x.Subject + x.Publisher).toLowerCase().includes(q))
    && (!f.grade || x.Grade === f.grade) && (!f.type || String(x.School_Types || "").split("،").includes(f.type))
    && (!f.pub || x.Publisher === f.pub) && (!f.sub || x.Subject === f.sub) && (!f.st || x.Book_Status === f.st));
  return UI.table([
    { t: "الكتاب", v: x => `<div class="font-semibold text-slate-900">${esc(x.Book_Name)}</div><div class="text-[11.5px] text-slate-400"><span class="num">${esc(x.Book_ID)}</span> · ${esc(x.Grade)} · ${esc(x.School_Types || "")}</div>` },
    { t: "الحالة", v: x => pill(x.Book_Status) },
    { t: "الغلاف", cls: "num", v: x => x.Book_Status === "Pricing" ? `<span class="text-amber-600 font-semibold">جاري التسعير</span>` : fmt(x.Cover_Price) },
    { t: "خصم المكتبة", cls: "num", v: x => fmt(x.Supplier_Discount_Pct) + "%" },
    { t: "التكلفة", cls: "num", v: x => fmt(x.Standard_Net_Cost) },
    { t: "سعر الموظف", cls: "num", v: x => `<b class="text-brand-800">${fmt(x.Emp_Selling_Price)}</b>` },
    { t: "الهامش", cls: "num", v: x => { const m = r2(n(x.Emp_Selling_Price) - n(x.Standard_Net_Cost)); return `<span class="${m < 0 ? "text-rose-600 font-bold" : "text-emerald-600"}">${fmt(m)}</span>`; } },
    { t: "المخزن / حر", cls: "num", v: x => `${fmt(st[x.Book_ID] ? st[x.Book_ID].onHand : 0)} / ${fmt(st[x.Book_ID] ? st[x.Book_ID].free : 0)}` },
    { t: "", actions: true, v: x => can("SAVE_BOOK") ? `<button class="btn btn-outline btn-xs" data-act="bookForm" data-id="${esc(x.Book_ID)}">${ic("pencil")} تعديل</button>` : "" }
  ], list, { maxH: 640, emptyIcon: "library-big", empty: q ? "لا نتائج للبحث" : "الكتالوج فارغ", emptySub: q ? "" : "أضف الكتب يدوياً أو استوردها من Excel." });
}
Router.add("/a/books", view => {
  const d = A(), loss = d.books.filter(x => n(x.Emp_Selling_Price) < n(x.Standard_Net_Cost)).length;
  view.innerHTML = UI.pageHead("الكتب والأسعار", `${d.books.length} كتاب · سعر الموظف = الغلاف − ${fmt(d.settingsMap.UNIFIED_EMP_DISCOUNT_PCT)}%`,
    lockedBtn("BULK_IMPORT_BOOKS", `<button class="btn btn-outline btn-sm" data-act="importBooks">${ic("file-spreadsheet")} استيراد من Excel</button>`) + lockedBtn("SAVE_BOOK", `<button class="btn btn-primary btn-sm" data-act="bookForm">${ic("plus")} كتاب جديد</button>`))
    + (loss ? `<div class="rounded-2xl bg-rose-50 ring-1 ring-rose-100 text-rose-800 p-3.5 mb-4 text-sm flex gap-2">${ic("triangle-alert", "mt-0.5")}${loss} كتاب سعر الموظف فيه أقل من التكلفة الصافية.</div>` : "")
    + `<section class="card card-pad"><div class="flex flex-wrap items-center justify-between gap-3 mb-4">${searchBox("qBooks", Q.books, "بحث بالاسم أو الكود أو الناشر")}
      ${bookFilters()}
      <button class="btn btn-ghost btn-sm" data-act="exportBooks">${ic("download")} تصدير</button></div><div id="booksList">${booksTable()}</div></section>`;
});
on("qBooks", v => { Q.books = v.trim(); rerenderList("booksList", booksTable); });
/** فلاتر الكتالوج: الصف، نوع المدرسة، الناشر، المادة، الحالة */
function bookFilters() {
  const c = A().catalog || {}, f = Q.bookF || {};
  const sel = (k, label, opts) => `<select class="input !h-10 !w-auto !text-sm" data-change="bookF" data-k="${k}"><option value="">${label}</option>${opts.map(o => `<option value="${esc(o[0])}" ${f[k] === o[0] ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`;
  const pricing = A().books.filter(b => b.Book_Status === "Pricing").length;
  return `<div class="flex flex-wrap gap-2">${sel("grade", "كل الصفوف", (c.grades || []).map(g => [g.label, g.label]))}${sel("type", "كل الأنواع", (c.schoolTypes || []).map(t => [t, t]))}${sel("pub", "كل الناشرين", (c.publishers || []).map(t => [t, t]))}${sel("sub", "كل المواد", (c.subjects || []).map(t => [t, t]))}${sel("st", "كل الحالات", [["Pricing", `جاري التسعير (${pricing})`], ["Available", "متاح"], ["Not_Yet_Printed", "لم يُطبع بعد"], ["Suspended", "موقوف"], ["Discontinued", "ملغى"]])}</div>`;
}
on("bookF", (v, el) => { Q.bookF = Object.assign({}, Q.bookF, { [el.dataset.k]: v }); rerenderList("booksList", booksTable); });
on("exportBooks", () => exportCSV("الكتالوج", ["الكود", "الكتاب", "المرحلة", "الصف", "نوع المدرسة", "الناشر", "المادة", "الجزء", "الحالة", "كود المكتبة", "الغلاف", "خصم المكتبة %", "التكلفة", "سعر الموظف"], A().books.map(x => [x.Book_ID, x.Book_Name, x.Stage, x.Grade, x.School_Types, x.Publisher, x.Subject, x.Book_Part, ar(x.Book_Status), x.Supplier_ID, x.Cover_Price, x.Supplier_Discount_Pct, x.Standard_Net_Cost, x.Emp_Selling_Price])));
/** خيارات نوع المدرسة: كل نوع منفرداً أو مشتركاً (حكومي، حكومي + لغات، ...) */
function typeCombos(types) {
  const out = [];
  for (let m = 1; m < (1 << types.length); m++) { const pick = types.filter((t, i) => m & (1 << i)); out.push([pick.join("،"), pick.length > 1 ? "مشترك: " + pick.join(" + ") : pick[0]]); }
  return out.sort((a, b) => a[0].split("،").length - b[0].split("،").length);
}
on("bookForm", async id => {
  const x = id ? A().books.find(b => b.Book_ID === id) : {}, c = A().catalog || {};
  const v = await UI.form({
    title: id ? "تعديل كتاب" : "كتاب جديد", sub: id ? x.Book_Name : "", wide: true, icon: "check",
    fields: [
      { name: "bookId", type: "html", html: id ? `<div class="rounded-xl bg-slate-50 px-4 py-3 text-sm">الكود: <b class="num">${esc(x.Book_ID)}</b></div>` : `<div class="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">يُولَّد الكود تلقائياً من الصف (مثل P4-012).</div>` },
      { name: "grade", label: "الصف الدراسي", type: "select", value: x.Grade || "", cols: 1, required: true, options: [["", "— اختر —"]].concat((c.grades || []).map(g => [g.label, g.label + " · " + g.stage])) },
      { name: "schoolTypes", label: "نوع المدرسة", type: "select", value: x.School_Types || "حكومي", cols: 1, required: true, options: typeCombos(c.schoolTypes || []) },
      { name: "publisher", label: "الناشر", type: "select", value: x.Publisher || "", cols: 1, required: true, options: [["", "— اختر —"]].concat((c.publishers || []).map(t => [t, t])) },
      { name: "subject", label: "المادة", type: "select", value: x.Subject || "", cols: 1, required: true, options: [["", "— اختر —"]].concat((c.subjects || []).map(t => [t, t])) },
      { name: "bookPart", label: "جزء الكتاب", type: "select", value: x.Book_Part || "", cols: 1, options: [["", "كتاب واحد"]].concat((c.parts || []).map(t => [t, t])) },
      { name: "supplierId", label: "المكتبة", type: "select", value: x.Supplier_ID || "", cols: 1, options: A().suppliers.map(s => [s.Supplier_ID, s.Supplier_Name]) },
      { name: "bookStatus", label: "الحالة", type: "select", value: x.Book_Status === "Pricing" ? "Available" : (x.Book_Status || "Available"), options: [["Available", "متاح"], ["Not_Yet_Printed", "لم يُطبع بعد (يقبل الحجز)"], ["Suspended", "موقوف مؤقتاً"], ["Discontinued", "ملغى"]] },
      { name: "coverPrice", label: "سعر الغلاف", type: "number", value: x.Cover_Price || "", cols: 1, hint: "اتركه فارغاً ليظهر الكتاب «جاري التسعير»" },
      { name: "supplierDiscountPct", label: "خصم المكتبة على الصنف %", type: "number", value: x.Supplier_Discount_Pct || "", cols: 1 },
      { name: "volumeDiscountSharePct", label: "خصم الكمية %", type: "number", value: x.Volume_Discount_Share_Pct === undefined ? "" : x.Volume_Discount_Share_Pct, cols: 1, placeholder: "من عقد المكتبة" },
      { name: "empDiscountPct", label: "خصم الموظف %", type: "number", value: x.Emp_Discount_Pct === undefined ? "" : x.Emp_Discount_Pct, cols: 1, placeholder: "الخصم الموحد" },
      { name: "_pv", type: "html", html: `<div id="pricePv" class="rounded-2xl bg-brand-50 p-4"></div>` }
    ],
    onChange: (f, form) => {
      const p = bookPrice(f), el = form.querySelector("#pricePv");
      el.innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">${[["بعد خصم الصنف", p.first], [`التكلفة (خصم كمية ${p.vd}%)`, p.cost], [`سعر الموظف (خصم ${p.ed}%)`, p.emp], ["الهامش", p.margin]].map((c, i) => `<div><div class="text-[11px] text-brand-700/80 font-semibold">${c[0]}</div><div class="text-lg font-bold num ${i === 3 && c[1] < 0 ? "text-rose-600" : i === 2 ? "text-brand-800" : "text-slate-900"}">${fmt(c[1])}</div></div>`).join("")}</div>`;
    }
  });
  if (v) { delete v._pv; v.bookId = id || ""; await act("SAVE_BOOK", v); }
});
on("importBooks", async () => {
  const v = await UI.form({ title: "استيراد الكتالوج", wide: true, intro: "انسخ الصفوف من Excel والصقها هنا. الأعمدة بالترتيب:<br><b>الكود، الاسم، المرحلة، الصف، المادة، الناشر، كود المكتبة، سعر الغلاف، خصم المكتبة %</b>",
    fields: [{ name: "txt", label: "البيانات", type: "textarea", rows: 8, required: true, placeholder: "BK-101\tسلاح التلميذ رياضيات\tالمرحلة الابتدائية\tالرابع\tرياضيات\t..." }], ok: "استيراد", icon: "upload" });
  if (!v) return;
  const rows = parsePaste(v.txt).map(p => ({ Book_ID: p[0], Book_Name: p[1], Stage: p[2], Grade: p[3], Subject: p[4], Publisher: p[5], Supplier_ID: p[6], Cover_Price: p[7], Supplier_Discount_Pct: p[8] }));
  if (rows.length) await act("BULK_IMPORT_BOOKS", { booksArray: rows });
});
function parsePaste(txt) { return String(txt || "").trim().split(/\r?\n/).filter(Boolean).map(l => l.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s => s.trim().replace(/^"|"$/g, ""))); }

// ============================================================ المراحل
Router.add("/a/phases", view => {
  const d = A();
  view.innerHTML = UI.pageHead("المراحل", "مواعيد الحجز والتسليم لكل مرحلة", lockedBtn("SAVE_PHASE", `<button class="btn btn-primary btn-sm" data-act="phaseForm">${ic("plus")} مرحلة جديدة</button>`))
    + (d.phases.length ? `<div class="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">${d.phases.slice().reverse().map(p => {
      const st = p.Effective_Status || p.Phase_Status, cur = p.Phase_ID === APP.phaseId;
      const its = d.resItems.filter(i => i.Phase_ID === p.Phase_ID && !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward");
      return `<article class="card card-pad ${cur ? "ring-2 ring-brand-400" : ""}">
        <div class="flex items-start justify-between gap-2"><div><div class="text-[11.5px] text-slate-400 num">${esc(p.Phase_ID)}</div><h3 class="font-bold text-slate-900 text-[16px]">${esc(p.Phase_Name)}</h3></div>${pill(st)}</div>
        <dl class="grid grid-cols-2 gap-2 mt-4">${UI.stat("الحجز من", esc(day(p.Start_DateTime)))}${UI.stat("الحجز إلى", esc(day(p.End_DateTime)))}${UI.stat("بداية التسليم", esc(day(p.Delivery_Start_Date)) || "—")}${UI.stat("الصفوف", esc(p.Allowed_Grades === "ALL" || !p.Allowed_Grades ? "الكل" : p.Allowed_Grades))}</dl>
        <div class="flex items-center justify-between mt-4 text-[13px] text-slate-500"><span>${fmt(new Set(its.map(i => i.Emp_ID)).size)} موظف · ${fmt(sum(its, "Requested_Qty"))} نسخة</span>
          <div class="flex gap-1.5">${cur ? "" : `<button class="btn btn-ghost btn-xs" data-act="setPhase" data-id="${esc(p.Phase_ID)}">عرض</button>`}${lockedBtn("SAVE_PHASE", `<button class="btn btn-outline btn-xs" data-act="phaseForm" data-id="${esc(p.Phase_ID)}">${ic("pencil")} تعديل</button>`)}</div></div></article>`;
    }).join("")}</div>` : `<div class="card">${UI.empty("calendar-range", "لا توجد مراحل بعد", "", lockedBtn("SAVE_PHASE", `<button class="btn btn-primary mt-5" data-act="phaseForm">${ic("plus")} مرحلة جديدة</button>`))}</div>`);
});
on("phaseForm", async id => {
  const p = id ? A().phases.find(x => x.Phase_ID === id) : {};
  const v = await UI.form({ title: id ? "تعديل مرحلة" : "مرحلة جديدة", sub: id || "", fields: [
    { name: "phaseName", label: "اسم المرحلة", value: p.Phase_Name || "", required: true, placeholder: "مثال: الترم الأول 2026/2027" },
    { name: "startDate", label: "بداية الحجز", type: "date", value: day(p.Start_DateTime), cols: 1, required: true },
    { name: "endDate", label: "نهاية الحجز", type: "date", value: day(p.End_DateTime), cols: 1, required: true },
    { name: "deliveryStartDate", label: "بداية التسليم", type: "date", value: day(p.Delivery_Start_Date), cols: 1, hint: "أساس جدول الأقساط" },
    { name: "allowedGrades", label: "الصفوف المتاحة", value: p.Allowed_Grades || "ALL", cols: 1, hint: "ALL أو أسماء مفصولة بفاصلة" }] });
  if (v) await act("SAVE_PHASE", Object.assign({ phaseId: id || "" }, v));
});

// ============================================================ المكتبات
Router.add("/a/suppliers", view => {
  const d = A(), bal = supplierBalances();
  view.innerHTML = UI.pageHead("المكتبات المتعاقدة", "خصم الكمية يُطبق على إجمالي الفاتورة بعد خصومات الأصناف", lockedBtn("SAVE_SUPPLIER", `<button class="btn btn-primary btn-sm" data-act="supplierForm">${ic("plus")} مكتبة جديدة</button>`))
    + (d.suppliers.length ? `<div class="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">${d.suppliers.map(s => { const x = bal[s.Supplier_ID] || { inv: 0, claim: 0, ret: 0, paid: 0 }; const due = x.inv - x.claim - x.ret - x.paid;
      return `<article class="card card-pad"><div class="flex items-center gap-3"><span class="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center text-xl">${ic("store")}</span>
        <div class="min-w-0 flex-1"><h3 class="font-bold text-slate-900 truncate">${esc(s.Supplier_Name)}</h3><div class="text-[12px] text-slate-500 num">${esc(s.Supplier_ID)}${s.Phone ? " · " + esc(s.Phone) : ""}</div></div><span class="pill pill-brand">خصم كمية ${fmt(s.Volume_Discount_Pct)}%</span></div>
        <div class="grid grid-cols-3 gap-2 mt-4">${UI.stat("الكتب", fmt(d.books.filter(b => b.Supplier_ID === s.Supplier_ID).length))}${UI.stat("المدفوع", fmt(x.paid))}${UI.stat("المستحق لها", `<span class="${due > 0 ? "text-rose-600" : ""}">${fmt(due)}</span>`)}</div></article>`; }).join("")}</div>`
      : `<div class="card">${UI.empty("store", "لا توجد مكتبات", "أضف المكتبة المتعاقدة أولاً لربط الكتب بها.")}</div>`);
});
on("supplierForm", async () => {
  const v = await UI.form({ title: "مكتبة جديدة", fields: [{ name: "supplierName", label: "اسم المكتبة", required: true }, { name: "phone", label: "الهاتف", type: "tel", cols: 1 }, { name: "volumeDiscountPct", label: "خصم الكمية %", type: "number", cols: 1 }] });
  if (v) await act("SAVE_SUPPLIER", v);
});
function supplierBalances() {
  const out = {};
  A().supLedger.forEach(l => { const x = out[l.Supplier_ID] = out[l.Supplier_ID] || { inv: 0, claim: 0, ret: 0, paid: 0 };
    if (l.Trans_Type === "INVOICE_CREDIT") x.inv += n(l.Credit_Amount); else if (l.Trans_Type === "DAMAGE_CLAIM") x.claim += n(l.Debit_Amount); else if (l.Trans_Type === "RETURN_DEBIT_NOTE") x.ret += n(l.Debit_Amount); else x.paid += n(l.Debit_Amount); });
  return out;
}

// ============================================================ الموظفون
function empTable() {
  const d = A(), q = (Q.emp || "").toLowerCase(), bal = {};
  d.empInvoices.forEach(i => bal[i.Emp_ID] = (bal[i.Emp_ID] || 0) + n(i.Remaining_Balance));
  const list = d.employees.filter(e => !q || (e.Emp_ID + e.Full_Name + e.Mobile + e.Department).toLowerCase().includes(q));
  return UI.table([
    { t: "الموظف", v: e => `<div class="flex items-center gap-2.5">${UI.avatar(e.Full_Name, "w-9 h-9 text-xs")}<div><div class="font-semibold text-slate-900">${esc(e.Full_Name)}</div><div class="text-[11.5px] text-slate-400 num">${esc(e.Emp_ID)}</div></div></div>` },
    { t: "الموبايل", cls: "num", v: e => `<span dir="ltr">${esc(e.Mobile)}</span>` },
    { t: "الإدارة", v: "Department" },
    { t: "الحالة", v: e => pill("", e.Employment_Status || "نشط", /نشط|active/i.test(e.Employment_Status || "نشط") ? "green" : "gray") },
    { t: "التقسيط", v: e => String(e.Installment_Allowed) === "false" ? pill("", "غير مسموح", "red") : pill("", "مسموح", "green") },
    { t: "الحد الائتماني", cls: "num", v: e => e.Max_Credit_Limit ? fmt(e.Max_Credit_Limit) : "الافتراضي" },
    { t: "المتبقي عليه", cls: "num", v: e => `<b class="${bal[e.Emp_ID] ? "text-rose-600" : "text-slate-400"}">${fmt(bal[e.Emp_ID] || 0)}</b>` }
  ], list.slice(0, 400), { maxH: 640, emptyIcon: "users", empty: q ? "لا نتائج" : "لا يوجد موظفون", emptySub: q ? "" : "استورد بيانات الموظفين من Excel." });
}
Router.add("/a/employees", view => {
  view.innerHTML = UI.pageHead("الموظفون", `${fmt(A().employees.length)} موظف مسجل`,
    lockedBtn("SUBMIT_OR_UPDATE_RESERVATION", `<button class="btn btn-outline btn-sm" data-act="reserveFor">${ic("notebook-pen")} حجز نيابة عن موظف</button>`) + lockedBtn("BULK_IMPORT_EMPLOYEES", `<button class="btn btn-primary btn-sm" data-act="importEmps">${ic("file-spreadsheet")} استيراد / تحديث</button>`))
    + `<section class="card card-pad"><div class="mb-4">${searchBox("qEmp", Q.emp, "بحث بالاسم أو الرقم أو الموبايل")}</div><div id="empList">${empTable()}</div></section>`;
});
on("qEmp", v => { Q.emp = v.trim(); rerenderList("empList", empTable); });
on("importEmps", async () => {
  const v = await UI.form({ title: "استيراد الموظفين", wide: true, intro: "الصق من Excel بالأعمدة: <b>الرقم الوظيفي، الاسم، آخر 4 قومي، الموبايل، الإدارة، الوظيفة، الحد الائتماني (اختياري)</b>. الموظف الموجود تُحدَّث بياناته.",
    fields: [{ name: "txt", label: "البيانات", type: "textarea", rows: 8, required: true }], ok: "استيراد", icon: "upload" });
  if (!v) return;
  const rows = parsePaste(v.txt).map(p => ({ Emp_ID: p[0], Full_Name: p[1], National_ID_Last4: p[2], Mobile: p[3], Department: p[4], Job_Title: p[5], Max_Credit_Limit: p[6] }));
  if (rows.length) await act("BULK_IMPORT_EMPLOYEES", { employeesArray: rows });
});
on("reserveFor", async () => {
  const v = await UI.form({ title: "حجز نيابة عن موظف", sub: phaseObj().Phase_Name, intro: "للموظف الذي لا يملك هاتفاً. تُسجَّل الأسبقية بوقت الحفظ ويوثَّق اسمك كمُدخِل.",
    fields: [{ name: "empId", label: "الرقم الوظيفي", required: true, cols: 1 }, { name: "method", label: "السداد", type: "seg", value: "CASH", cols: 1, options: [["CASH", "دفعة واحدة"], ["INSTALLMENT", "تقسيط 25% + 2"]] },
      { name: "items", label: "الكتب والكميات", required: true, placeholder: "BK-101:2, BK-201:1", hint: "كود الكتاب ثم : ثم العدد، وافصل بين الكتب بفاصلة" }] });
  if (!v) return;
  const items = v.items.split(/[,،]/).map(s => s.trim()).filter(Boolean).map(s => { const [bk, q] = s.split(":"); return { bookId: bk.trim(), qty: parseInt(q || "1", 10) }; });
  const inst = v.method === "INSTALLMENT";
  await act("SUBMIT_OR_UPDATE_RESERVATION", { empId: v.empId.trim(), phaseId: APP.phaseId, items, paymentMethod: inst ? "INSTALLMENT" : "CASH", downPaymentType: "PERCENTAGE", downPaymentInput: 25, installmentCount: 2 });
});

// ============================================================ الإعدادات
Router.add("/a/settings", view => {
  const d = A();
  view.innerHTML = UI.pageHead("الإعدادات", APP.user.role === "Admin" ? "قواعد المبادرة العامة" : "للاطلاع فقط — التعديل للمدير")
    + `<section class="card divide-y divide-slate-100">${d.settings.map(s => `<div class="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3.5">
      <div class="flex-1 min-w-[12rem]"><div class="font-semibold text-slate-800 text-[14px]">${esc(s.Description || s.Setting_Key)}</div><code class="text-[11px] text-slate-400" dir="ltr">${esc(s.Setting_Key)}</code></div>
      <div class="font-bold text-brand-800 num text-[15px]">${esc(s.Setting_Value)}</div>
      ${can("SAVE_SETTING") ? `<button class="btn btn-outline btn-xs" data-act="editSetting" data-id="${esc(s.Setting_Key)}">${ic("pencil")} تعديل</button>` : ""}</div>`).join("")}</section>`;
});
on("editSetting", async key => {
  const s = A().settings.find(x => x.Setting_Key === key);
  const v = await UI.form({ title: s.Description || key, sub: key, fields: [{ name: "value", label: "القيمة", value: s.Setting_Value, required: true }] });
  if (v) await act("SAVE_SETTING", { key, value: v.value });
});

// ============================================================ الحصر وطلب التوريد
Router.add("/a/po", view => {
  if (noPhase(view)) return;
  const d = A(), { b, s } = maps(), items = phaseItems(), agg = {};
  items.forEach(i => { const x = agg[i.Book_ID] = agg[i.Book_ID] || { req: 0, emps: new Set() }; x.req += n(i.Requested_Qty); x.emps.add(i.Emp_ID); });
  const live = Object.keys(agg).map(k => ({ id: k, req: agg[k].req, emps: agg[k].emps.size, free: d.stockMap[k] ? d.stockMap[k].free : 0 }));
  const snaps = d.poSnapshots.filter(p => p.Phase_ID === APP.phaseId);
  view.innerHTML = UI.pageHead("الحصر وطلب التوريد", "يُخصم المخزون الحر والنواقص المستحقة على المكتبة بعد نصيب المنتظرين من المراحل السابقة",
    lockedBtn("GENERATE_PO_SNAPSHOT", `<button class="btn btn-gold btn-sm" data-act="freezePO">${ic("lock")} تجميد الحصر</button>`) + (snaps.length ? `<button class="btn btn-outline btn-sm" data-act="exportPO">${ic("download")} تصدير طلب التوريد</button>` : ""))
    + `<div class="grid grid-cols-3 gap-3 sm:gap-4 mb-4">${UI.kpi("كتب مختلفة", fmt(live.length), { icon: "library", tone: "brand" })}${UI.kpi("نسخ محجوزة", fmt(sum(live, "req")), { icon: "book-open", tone: "blue" })}${UI.kpi("المطلوب من المكتبة", fmt(sum(snaps, "Net_Order_To_Supplier_Qty")), { icon: "truck", tone: "green", foot: snaps.length ? "بعد التجميد" : "لم يُجمَّد بعد" })}</div>`
    + UI.section(`${ic("clipboard-list", "text-brand-600")} الحجوزات الحالية`, "تجميع لحظي يتغير مع حجوزات الموظفين", UI.table([
      { t: "الكتاب", v: x => `<b>${esc(bookName(b, x.id))}</b><div class="text-[11.5px] text-slate-400">${esc(x.id)}</div>` },
      { t: "عدد الموظفين", cls: "num", v: x => fmt(x.emps) }, { t: "النسخ المحجوزة", cls: "num", v: x => `<b>${fmt(x.req)}</b>` }, { t: "الرصيد الحر بالمخزن", cls: "num", v: x => fmt(x.free) }
    ], live.sort((x, y) => y.req - x.req), { maxH: 380, empty: "لا حجوزات في المرحلة", emptyIcon: "clipboard-list" }))
    + `<div class="h-4"></div>`
    + UI.section(`${ic("truck", "text-brand-600")} طلب التوريد المجمَّد`, "", UI.table([
      { t: "الكتاب", v: p => `<b>${esc(bookName(b, p.Book_ID))}</b><div class="text-[11.5px] text-slate-400">${esc((s[p.Supplier_ID] || {}).Supplier_Name || p.Supplier_ID)}</div>` },
      { t: "الاحتياج", cls: "num", v: p => fmt(p.Total_Requested_Qty) }, { t: "من المخزون", cls: "num", v: p => fmt(p.Carryover_Stock_Qty) }, { t: "نواقص سابقة", cls: "num", v: p => fmt(p.Pending_From_Previous_Qty) },
      { t: "المطلوب", cls: "num", v: p => `<b class="text-brand-800">${fmt(p.Net_Order_To_Supplier_Qty)}</b>` }, { t: "وصل", cls: "num", v: p => fmt(p.Received_Qty_To_Date) },
      { t: "متبقٍ", cls: "num", v: p => `<span class="${n(p.Outstanding_Qty) ? "text-rose-600 font-bold" : ""}">${fmt(p.Outstanding_Qty)}</span>` },
      { t: "الحالة", v: p => pill(p.Line_Status, p.Line_Status === "Open" ? "مستحق على المكتبة" : null, p.Line_Status === "Open" ? "amber" : null) },
      { t: "", actions: true, v: p => p.Line_Status === "Open" && can("CANCEL_PO_BACKORDER") ? `<button class="btn btn-outline-danger btn-xs" data-act="cancelBO" data-id="${esc(p.PO_ID)}">${ic("ban")} لن يُورَّد</button>` : "" }
    ], snaps, { maxH: 520, emptyIcon: "lock", empty: "لم يُجمَّد الحصر بعد", emptySub: "التجميد يُغلق الحجز ويُنشئ طلب التوريد النهائي للمكتبة." }));
});
on("freezePO", () => act("GENERATE_PO_SNAPSHOT", { phaseId: APP.phaseId }, { title: "تجميد الحصر", message: "سيتم إغلاق الحجز لهذه المرحلة وإنشاء طلب التوريد النهائي. متابعة؟", ok: "تجميد" }));
on("exportPO", () => { const { b, s } = maps(); exportCSV("طلب_توريد_" + APP.phaseId, ["الكود", "الكتاب", "المكتبة", "الاحتياج", "من المخزون", "المطلوب من المكتبة"], A().poSnapshots.filter(p => p.Phase_ID === APP.phaseId).map(p => [p.Book_ID, bookName(b, p.Book_ID), (s[p.Supplier_ID] || {}).Supplier_Name, p.Total_Requested_Qty, p.Carryover_Stock_Qty, p.Net_Order_To_Supplier_Qty])); });
on("cancelBO", async id => {
  const v = await UI.form({ title: "إلغاء نواقص لن تُورَّد", tone: "danger", fields: [{ name: "reason", label: "السبب", required: true, placeholder: "مثال: الناشر أوقف الطبعة" }], ok: "تأكيد الإلغاء" });
  if (v) await act("CANCEL_PO_BACKORDER", { poId: id, reason: v.reason });
});

// ============================================================ فاتورة المكتبة والجرد
Router.add("/a/receive", view => {
  if (noPhase(view)) return;
  const d = A(), sid = Q.sup || (d.suppliers[0] || {}).Supplier_ID, sup = d.suppliers.find(x => x.Supplier_ID === sid) || {};
  const snaps = {}; d.poSnapshots.filter(p => p.Phase_ID === APP.phaseId).forEach(p => snaps[p.Book_ID] = n(p.Outstanding_Qty));
  const books = d.books.filter(b => b.Supplier_ID === sup.Supplier_ID).sort((x, y) => (snaps[y.Book_ID] || 0) - (snaps[x.Book_ID] || 0));
  const canSubmit = can("SUBMIT_SUPPLIER_INVOICE");
  view.innerHTML = UI.pageHead("فاتورة المكتبة والجرد", "أدخل ما وصل فعلياً: السليم يدخل المخزن، والتالف مطالبة على المكتبة، وما لم يُطبع يبقى مستحقاً")
  + `<section class="card card-pad mb-4"><div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <div class="col-span-2 lg:col-span-1"><label class="label">المكتبة</label><select class="input" data-change="pickSup">${d.suppliers.map(s => `<option value="${esc(s.Supplier_ID)}" ${s.Supplier_ID === sid ? "selected" : ""}>${esc(s.Supplier_Name)}</option>`).join("")}</select></div>
      <div><label class="label">رقم فاتورة المكتبة</label><input id="siNo" class="input"></div>
      <div><label class="label">التاريخ</label><input id="siDate" type="date" class="input" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div><label class="label">خصم الكمية %</label><input id="siVol" type="number" class="input num" value="${n(sup.Volume_Discount_Pct)}" data-input="recalcSI"></div>
      <div><label class="label">الصافي بفاتورة المكتبة</label><input id="siStated" type="number" class="input num" placeholder="للمطابقة"></div></div></section>
  ${books.length ? `<div id="siBody" class="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">${books.map(b => { const o = snaps[b.Book_ID] || 0; return `<article class="card p-4 si-row" data-id="${esc(b.Book_ID)}" data-ord="${o}">
      <div class="flex items-start justify-between gap-2"><div class="min-w-0"><h3 class="font-bold text-slate-900 leading-snug">${esc(b.Book_Name)}</h3><div class="text-[11.5px] text-slate-400">${esc(b.Book_ID)}</div></div>
        <div class="text-left shrink-0"><div class="text-[11px] text-slate-500">المطلوب</div><div class="font-bold text-lg num">${o}</div></div></div>
      <div class="grid grid-cols-4 gap-2 mt-3">
        <div><label class="text-[11px] font-semibold text-emerald-700">سليم</label><input type="number" min="0" class="input input-sm num si-rec" value="${o}" data-input="recalcSI"></div>
        <div><label class="text-[11px] font-semibold text-rose-600">تالف</label><input type="number" min="0" class="input input-sm num si-dmg" value="0" data-input="recalcSI"></div>
        <div><label class="text-[11px] font-semibold text-slate-500">الغلاف</label><input type="number" class="input input-sm num si-cover" value="${n(b.Cover_Price)}" data-input="recalcSI"></div>
        <div><label class="text-[11px] font-semibold text-slate-500">خصم %</label><input type="number" class="input input-sm num si-disc" value="${n(b.Supplier_Discount_Pct)}" data-input="recalcSI"></div></div>
      <div class="flex items-center justify-between mt-3 text-[12.5px]"><label class="flex items-center gap-2 text-slate-600"><input type="checkbox" class="w-4 h-4 accent-brand-700 si-np"> لم يُطبع بعد</label>
        <span class="text-slate-500">الوحدة <b class="si-unit num text-slate-800"></b> · الإجمالي <b class="si-line num text-slate-800"></b></span><span class="si-var"></span></div></article>`; }).join("")}</div>`
    : `<div class="card">${UI.empty("truck", "لا توجد كتب لهذه المكتبة")}</div>`}
  <div class="sticky bottom-[calc(4.3rem+env(safe-area-inset-bottom))] md:bottom-4 z-20 mt-4">
    <div class="card p-3.5 sm:p-4 shadow-lift flex flex-wrap items-center gap-x-6 gap-y-2">
      <div class="text-[13px] text-slate-500">بعد خصم الأصناف <b id="siAfter" class="num text-slate-800"></b></div>
      <div class="text-[13px] text-slate-500">خصم الكمية <b id="siVolAmt" class="num text-slate-800"></b></div>
      <div class="text-[13px] text-rose-600">مطالبة تالف <b id="siDmg" class="num"></b></div>
      <div class="flex-1 text-[15px] font-bold text-brand-800">الصافي <span id="siNet" class="num"></span></div>
      ${canSubmit && books.length ? `<button class="btn btn-success" data-act="submitSI">${ic("clipboard-check")} اعتماد الفاتورة</button>` : ""}
    </div></div>
  <div class="h-4"></div>
  ${UI.section(`${ic("receipt", "text-brand-600")} فواتير المكتبة المسجلة`, "", UI.table([
    { t: "المرجع", v: h => `<b>${esc(h.Internal_Ref_No)}</b><div class="text-[11.5px] text-slate-400">${esc(h.Supplier_Invoice_No)}</div>` }, { t: "المرحلة", v: "Phase_ID" }, { t: "التاريخ", cls: "num", v: h => esc(day(h.Invoice_Date)) },
    { t: "بعد خصم الأصناف", cls: "num", v: h => fmt(h.Total_After_Item_Discount) }, { t: "خصم الكمية", cls: "num", v: h => fmt(h.Volume_Discount_Amount) }, { t: "الصافي", cls: "num", v: h => `<b>${fmt(h.Net_Payable_Amount)}</b>` },
    { t: "تالف", cls: "num", v: h => fmt(h.Damaged_Claim_Amount) }, { t: "الحالة", v: h => esc(h.Status) + (n(h.Variance_Amount) ? ` ${pill("", "فرق " + fmt(h.Variance_Amount), "red")}` : "") }
  ], d.supInvHeaders.slice().reverse(), { maxH: 420, emptyIcon: "receipt", empty: "لا فواتير مسجلة" }))}`;
  recalcSI();
});
on("pickSup", v => { Q.sup = v; Shell.rerender(); });
function recalcSI() {
  const vol = n(($("#siVol") || {}).value); let after = 0, dmgAmt = 0;
  $$(".si-row").forEach(tr => {
    const g = c => n(tr.querySelector(c).value), rec = g(".si-rec"), dmg = g(".si-dmg"), cover = g(".si-cover"), disc = g(".si-disc"), ord = n(tr.dataset.ord);
    const first = r2(cover * (1 - disc / 100)), unit = r2(first - Math.round(first * vol) / 100);
    after += first * (rec + dmg); dmgAmt += unit * dmg;
    tr.querySelector(".si-unit").textContent = fmt(unit); tr.querySelector(".si-line").textContent = fmt(unit * (rec + dmg));
    const v = rec + dmg - ord;
    tr.querySelector(".si-var").innerHTML = !ord && !rec && !dmg ? "" : v === 0 ? pill("EXACT") : pill("", (v > 0 ? "+" : "") + v, v < 0 ? "red" : "amber");
  });
  after = r2(after); const va = Math.round(after * vol) / 100;
  if ($("#siAfter")) { $("#siAfter").textContent = moneyTxt(after); $("#siVolAmt").textContent = moneyTxt(va); $("#siNet").textContent = moneyTxt(after - va); $("#siDmg").textContent = moneyTxt(dmgAmt); }
}
on("recalcSI", () => recalcSI());
on("submitSI", async () => {
  const items = [];
  $$(".si-row").forEach(tr => {
    const it = { bookId: tr.dataset.id, orderedQty: n(tr.dataset.ord), receivedQty: n(tr.querySelector(".si-rec").value), damagedQty: n(tr.querySelector(".si-dmg").value), coverPrice: n(tr.querySelector(".si-cover").value), itemDiscPct: n(tr.querySelector(".si-disc").value), notPrinted: tr.querySelector(".si-np").checked };
    if (it.orderedQty || it.receivedQty || it.damagedQty) items.push(it);
  });
  if (!$("#siNo").value.trim()) return toast("أدخل رقم فاتورة المكتبة", "warning");
  await act("SUBMIT_SUPPLIER_INVOICE", { supplierId: Q.sup || (A().suppliers[0] || {}).Supplier_ID, phaseId: APP.phaseId, supplierInvoiceNo: $("#siNo").value.trim(), invoiceDate: $("#siDate").value, volumeDiscountPct: $("#siVol").value, supplierStatedNet: $("#siStated").value, items },
    { title: "اعتماد فاتورة المكتبة", message: "الاعتماد نهائي ولا يُعدَّل، ويُدخل السليم للمخزن. هل راجعت الجرد؟", ok: "اعتماد" });
});

// ============================================================ التوزيع بالأسبقية
function allocTable() {
  const { e, b } = maps(), q = (Q.alloc || "").toLowerCase(), f = Q.allocF || "";
  const items = phaseItems().filter(i => (!f || (f === "wait" ? n(i.Requested_Qty) > n(i.Allocated_Qty) : i.Allocation_Status === f)) && (!q || (bookName(b, i.Book_ID) + i.Book_ID + i.Emp_ID + empName(e, i.Emp_ID)).toLowerCase().includes(q)))
    .sort((x, y) => (x.Book_ID + x.Priority_Timestamp).localeCompare(y.Book_ID + y.Priority_Timestamp));
  return UI.table([
    { t: "الكتاب", v: i => `<b>${esc(bookName(b, i.Book_ID))}</b>` },
    { t: "الموظف", v: i => `${esc(empName(e, i.Emp_ID))} <span class="text-slate-400 text-xs">(${esc(i.Emp_ID)})</span>` },
    { t: "الأسبقية", cls: "num", v: i => `<span dir="ltr" class="text-xs">${esc(i.Priority_Timestamp)}</span>${n(i.Tranche_No) > 1 ? ` <span class="pill pill-gray">ش${esc(i.Tranche_No)}</span>` : ""}${i.Carried_From_Item_ID ? ` <span class="pill pill-blue">مُرحَّل</span>` : ""}` },
    { t: "محجوز", cls: "num", v: i => fmt(i.Requested_Qty) }, { t: "مخصص", cls: "num", v: i => `<b class="text-brand-800">${fmt(i.Allocated_Qty)}</b>` }, { t: "مُسلَّم", cls: "num", v: i => fmt(i.Delivered_Qty) },
    { t: "الحالة", v: i => pill(i.Allocation_Status) + (i.Unallocated_Reason ? `<div class="text-[11px] text-slate-400 mt-1">${esc(i.Unallocated_Reason)}</div>` : "") + (isTrue(i.Is_Manual_Exception) ? `<div class="mt-1">${pill("", "استثناء: " + i.Exception_Reason, "blue")}</div>` : "") },
    { t: "", actions: true, v: i => can("MANUAL_ALLOCATION_OVERRIDE") ? `<button class="btn btn-outline btn-xs" data-act="override" data-id="${esc(i.Res_Item_ID)}">${ic("pencil")} تعديل التخصيص</button>` : "" }
  ], items, { maxH: 680, emptyIcon: "list-ordered", empty: "لا توجد سطور" });
}
Router.add("/a/alloc", view => {
  if (noPhase(view)) return;
  const items = phaseItems(), others = A().phases.filter(p => p.Phase_ID !== APP.phaseId);
  const req = sum(items, "Requested_Qty"), al = sum(items, "Allocated_Qty");
  view.innerHTML = UI.pageHead("التوزيع بالأسبقية", "كل نسخة تُخصَّص بوقت حجزها؛ الأقدم أولاً",
    lockedBtn("CARRY_WAITLIST_TO_PHASE", others.length ? `<button class="btn btn-outline btn-sm" data-act="carry">${ic("arrow-left-right")} ترحيل المنتظرين</button>` : "") + lockedBtn("RUN_ALLOCATION_ENGINE", `<button class="btn btn-success btn-sm" data-act="runAlloc">${ic("play")} تشغيل التوزيع</button>`))
    + `<div class="grid grid-cols-3 gap-3 sm:gap-4 mb-4">${UI.kpi("محجوز", fmt(req), { icon: "book-open", tone: "blue" })}${UI.kpi("مخصص", fmt(al), { icon: "list-checks", tone: "green", pct: req ? al / req * 100 : 0 })}${UI.kpi("منتظر", fmt(Math.max(0, req - al)), { icon: "hourglass", tone: req - al > 0 ? "amber" : "gray" })}</div>`
    + `<section class="card card-pad"><div class="flex flex-wrap items-center gap-3 mb-4">${searchBox("qAlloc", Q.alloc, "تصفية بالكتاب أو الموظف")}
      <div class="scroll-x !mx-0 !px-0">${[["", "الكل"], ["wait", "غير مكتمل"], ["Fully_Allocated", "مخصص بالكامل"], ["Waitlisted", "في الانتظار"]].map(f => `<button class="chip !h-9" data-act="allocF" data-id="${f[0]}" aria-pressed="${(Q.allocF || "") === f[0]}">${f[1]}</button>`).join("")}</div></div>
      <div id="allocList">${allocTable()}</div></section>`;
});
on("qAlloc", v => { Q.alloc = v.trim(); rerenderList("allocList", allocTable); });
on("allocF", v => { Q.allocF = v; Shell.rerender(); });
on("runAlloc", () => act("RUN_ALLOCATION_ENGINE", { phaseId: APP.phaseId }, { title: "تشغيل التوزيع", message: "سيُوزَّع المخزون الحر على الحجوزات حسب أسبقية كل نسخة، وتصدر/تُحدَّث فواتير الموظفين.", ok: "تشغيل" }));
on("carry", async () => {
  const v = await UI.form({ title: "ترحيل المنتظرين", intro: "يُنقل كل ما لم يُخصَّص إلى المرحلة المختارة مع الاحتفاظ بأسبقيته الأصلية.",
    fields: [{ name: "to", label: "إلى مرحلة", type: "select", options: A().phases.filter(p => p.Phase_ID !== APP.phaseId).map(p => [p.Phase_ID, p.Phase_Name]) }], ok: "ترحيل", icon: "arrow-left-right" });
  if (v) await act("CARRY_WAITLIST_TO_PHASE", { fromPhaseId: APP.phaseId, toPhaseId: v.to });
});
on("override", async id => {
  const i = A().resItems.find(x => x.Res_Item_ID === id), { e, b } = maps();
  const v = await UI.form({ title: "استثناء موثق في التخصيص", sub: `${bookName(b, i.Book_ID)} · ${empName(e, i.Emp_ID)}`, intro: `المحجوز ${fmt(i.Requested_Qty)} · المخصص حالياً ${fmt(i.Allocated_Qty)}. يُسجَّل الاستثناء باسمك في سجل المراجعة.`,
    fields: [{ name: "q", label: "الكمية المخصصة الجديدة", type: "number", value: i.Allocated_Qty, min: 0, required: true }, { name: "reason", label: "السبب", required: true }], ok: "تطبيق" });
  if (v) await act("MANUAL_ALLOCATION_OVERRIDE", { resItemId: id, newAllocatedQty: v.q, reason: v.reason });
});

// ============================================================ التسليم والمرتجعات
function deliveryList() {
  const { e, b } = maps(), q = (Q.del || "").toLowerCase(), d = A();
  const items = phaseItems().filter(i => n(i.Allocated_Qty) > 0 || n(i.Delivered_Qty) > 0);
  const byEmp = {}; items.forEach(i => (byEmp[i.Emp_ID] = byEmp[i.Emp_ID] || []).push(i));
  let ids = Object.keys(byEmp).filter(id => !q || (id + empName(e, id)).toLowerCase().includes(q));
  if (Q.delF === "pending") ids = ids.filter(id => byEmp[id].some(i => n(i.Allocated_Qty) > n(i.Delivered_Qty)));
  if (!ids.length) return UI.empty("package-check", q ? "لا نتائج" : "لا توجد كتب مخصصة", q ? "" : "شغّل التوزيع أولاً لتظهر الكتب الجاهزة للتسليم.");
  return `<div class="grid gap-3 sm:gap-4 xl:grid-cols-2">${ids.slice(0, q ? 60 : 30).map(id => {
    const list = byEmp[id], inv = d.empInvoices.find(x => x.Emp_Inv_ID === `EINV-${APP.phaseId}-${id}`) || {};
    const rem = list.reduce((s, i) => s + n(i.Allocated_Qty) - n(i.Delivered_Qty), 0);
    const downOk = n(inv.Total_Paid_Amount) >= n(inv.Down_Payment_Required);
    return `<article class="card overflow-hidden">
      <div class="flex items-center gap-3 p-4 border-b border-slate-100">${UI.avatar(empName(e, id), "w-11 h-11 text-sm")}
        <div class="flex-1 min-w-0"><div class="font-bold text-slate-900 truncate">${esc(empName(e, id))}</div><div class="text-[12px] text-slate-500 num">${esc(id)} · فاتورة ${fmt(inv.Net_Final_Invoice_Amount)} · مسدد ${fmt(inv.Total_Paid_Amount)}</div></div>
        ${rem > 0 ? (downOk ? pill("", "مسموح بالتسليم", "green") : pill("", "لم يسدد المقدم", "red")) : pill("", "تم التسليم", "gray")}</div>
      <ul class="divide-y divide-slate-100">${list.map(i => { const r = n(i.Allocated_Qty) - n(i.Delivered_Qty); return `<li class="flex items-center gap-3 px-4 py-2.5">
        <div class="flex-1 min-w-0"><div class="text-[13.5px] font-semibold text-slate-800 truncate">${esc(bookName(b, i.Book_ID))}</div><div class="text-[11.5px] text-slate-500 num">مخصص ${fmt(i.Allocated_Qty)} · مُسلَّم ${fmt(i.Delivered_Qty)}${n(i.Returned_Qty) ? ` · مرتجع ${fmt(i.Returned_Qty)}` : ""}</div></div>
        <div class="flex gap-1.5">${r > 0 && can("CANCEL_UNDELIVERED_QTY") ? `<button class="btn btn-ghost btn-xs" data-act="cancelUnd" data-id="${esc(i.Res_Item_ID)}">${ic("ban")} تنازل</button>` : ""}${n(i.Delivered_Qty) > n(i.Returned_Qty) && can("RECORD_BOOK_RETURN") ? `<button class="btn btn-ghost btn-xs text-rose-600" data-act="empReturn" data-id="${esc(i.Res_Item_ID)}">${ic("undo-2")} مرتجع</button>` : ""}</div></li>`; }).join("")}</ul>
      ${rem > 0 && can("EXECUTE_BOOK_DELIVERY") ? `<div class="p-3 bg-slate-50/70"><button class="btn ${downOk ? "btn-success" : "btn-outline"} w-full" data-act="deliver" data-id="${esc(id)}">${ic("check-check")} تسليم الكل (${rem}) بإذن واحد</button></div>` : ""}</article>`;
  }).join("")}</div>`;
}
Router.add("/a/delivery", view => {
  if (noPhase(view)) return;
  const d = A(), { b } = maps();
  const docs = d.deliveryReturns.filter(x => x.Phase_ID === APP.phaseId).slice(-80).reverse();
  view.innerHTML = UI.pageHead("التسليم والمرتجعات", "لا يتم التسليم قبل سداد المقدم أو كامل القيمة، ولمن ليس عليه متأخرات")
    + `<div class="flex flex-wrap items-center gap-3 mb-4">${searchBox("qDel", Q.del, "ابحث برقم الموظف أو اسمه")}
      <div class="flex gap-2">${[["", "الكل"], ["pending", "بانتظار التسليم"]].map(f => `<button class="chip" data-act="delF" data-id="${f[0]}" aria-pressed="${(Q.delF || "") === f[0]}">${f[1]}</button>`).join("")}</div></div>
    <div id="delList">${deliveryList()}</div><div class="h-5"></div>`
    + UI.section(`${ic("file-text", "text-brand-600")} مستندات التسليم والمرتجعات`, "آخر 80 مستند في المرحلة", UI.table([
      { t: "المستند", v: x => `<b class="num">${esc(x.Printed_Receipt_No)}</b>` },
      { t: "النوع", v: x => x.Doc_Type === "EMP_DELIVERY" ? pill("", "تسليم", "green") : x.Doc_Type === "EMP_RETURN" ? pill("", "مرتجع موظف", "amber") : pill("", "مرتجع للمكتبة", "blue") },
      { t: "الطرف", v: "Party_ID" }, { t: "الكتاب", v: x => esc(bookName(b, x.Book_ID)) }, { t: "العدد", cls: "num", v: x => fmt(x.Qty) }, { t: "القيمة", cls: "num", v: x => fmt(x.Total_Amount_Impact) },
      { t: "التاريخ", cls: "num", v: x => esc(dt(x.Trans_Date)) }, { t: "المستلم / السبب", v: x => esc(x.Received_By || x.Return_Reason) },
      { t: "", actions: true, v: x => `<button class="btn btn-ghost btn-xs" data-act="printDoc" data-id="${esc(x.Printed_Receipt_No)}">${ic("printer")} طباعة</button>` }
    ], docs, { maxH: 460, emptyIcon: "file-text", empty: "لا مستندات بعد" }));
});
on("qDel", v => { Q.del = v.trim(); rerenderList("delList", deliveryList); });
on("delF", v => { Q.delF = v; Shell.rerender(); });
on("deliver", async id => {
  const { e } = maps();
  const v = await UI.form({ title: "تسليم الكتب", sub: `${empName(e, id)} (${id})`, intro: "يصدر إذن تسليم واحد بكل الكتب المخصصة غير المُسلَّمة.",
    fields: [{ name: "by", label: "المستلم (إن لم يكن الموظف)", placeholder: "الاسم وصلة القرابة" }], ok: "تسليم وطباعة الإذن", tone: "success", icon: "check-check" });
  if (!v) return;
  let r = await call("EXECUTE_BOOK_DELIVERY", { empId: id, phaseId: APP.phaseId, receivedBy: v.by }, { block: true });
  if (!r.success && APP.user.role === "Admin" && /المقدم|متأخرة/.test(r.message)) {
    const f = await UI.form({ title: "تسليم استثنائي", tone: "danger", intro: esc(r.message), fields: [{ name: "reason", label: "سبب التجاوز (يُسجَّل باسمك)", required: true }], ok: "تسليم استثنائي" });
    if (!f) return;
    r = await call("EXECUTE_BOOK_DELIVERY", { empId: id, phaseId: APP.phaseId, receivedBy: v.by, forceReason: f.reason }, { block: true });
  }
  toast(r.message, r.success ? "success" : "danger");
  if (r.success) { await Admin.load(); printDoc(r.receiptNo); }
});
on("cancelUnd", async id => {
  const i = A().resItems.find(x => x.Res_Item_ID === id), mx = n(i.Allocated_Qty) - n(i.Delivered_Qty);
  const v = await UI.form({ title: "تنازل / رفض استلام", fields: [{ name: "q", label: `عدد النسخ (حتى ${mx})`, type: "number", value: mx, min: 1, max: mx, required: true }, { name: "reason", label: "السبب", value: "رفض الاستلام", required: true }], ok: "تأكيد", tone: "danger" });
  if (v) await act("CANCEL_UNDELIVERED_QTY", { resItemId: id, qty: v.q, reason: v.reason });
});
on("empReturn", async id => {
  const v = await UI.form({ title: "مرتجع من موظف", fields: [{ name: "q", label: "عدد النسخ", type: "number", value: 1, min: 1, cols: 1, required: true }, { name: "cond", label: "حالة الكتاب", type: "seg", value: "OK", cols: 1, options: [["OK", "سليم"], ["DAMAGED", "تالف"]] }, { name: "reason", label: "سبب الإرجاع", value: "مكرر / خطأ في الصف", required: true }], ok: "تسجيل المرتجع" });
  if (!v) return;
  const payload = { returnType: "EMP_RETURN", resItemId: id, qty: v.q, reason: v.reason, condition: v.cond };
  const r = await call("RECORD_BOOK_RETURN", payload, { block: true });
  if (!r.success && APP.user.role === "Admin" && /المدير/.test(r.message)) {
    const f = await UI.form({ title: "موافقة استثنائية", intro: esc(r.message), fields: [{ name: "reason", label: "سبب الموافقة", required: true }], ok: "موافقة" });
    if (f) await act("RECORD_BOOK_RETURN", Object.assign(payload, { forceReason: f.reason }));
    return;
  }
  toast(r.message, r.success ? "success" : "danger"); if (r.success) await Admin.load();
});
function printDoc(no) {
  const d = A(), { e, b } = maps(), lines = d.deliveryReturns.filter(x => x.Printed_Receipt_No === no); if (!lines.length) return;
  const f = lines[0], title = f.Doc_Type === "EMP_DELIVERY" ? "إذن تسليم كتب" : "إذن ارتجاع";
  openPrint(title, `<h1 style="text-align:center">${title} رقم ${esc(no)}</h1><p>الموظف: <b>${esc(empName(e, f.Party_ID))}</b> (${esc(f.Party_ID)}) · التاريخ: ${esc(f.Trans_Date)} · المرحلة: ${esc(f.Phase_ID)}</p>
    <table><tr><th>الكتاب</th><th>العدد</th><th>سعر النسخة</th><th>القيمة</th></tr>${lines.map(l => `<tr><td>${esc(bookName(b, l.Book_ID))}</td><td>${l.Qty}</td><td>${fmt(l.Unit_Price_Applied)}</td><td>${fmt(Math.abs(n(l.Total_Amount_Impact)))}</td></tr>`).join("")}</table>
    <p>المستلم: ${esc(f.Received_By || "")} · المسلِّم: ${esc(f.Handled_By)}</p><div style="display:flex;justify-content:space-between;margin-top:50px"><div>توقيع المستلم: ..................</div><div>توقيع أمين المخزن: ..................</div></div>`);
}
on("printDoc", id => printDoc(id));

// ============================================================ التحصيل والفواتير
function finList() {
  const d = A(), { e } = maps(), q = (Q.fin || "").toLowerCase(), f = Q.finF || "";
  const invs = d.empInvoices.filter(i => i.Phase_ID === APP.phaseId && (!q || (i.Emp_ID + empName(e, i.Emp_ID)).toLowerCase().includes(q))
    && (!f || (f === "due" ? n(i.Remaining_Balance) > 0 : f === "down" ? n(i.Total_Paid_Amount) < n(i.Down_Payment_Required) : f === "credit" ? n(i.Credit_Balance) > 0 : i.Invoice_Status === f)));
  return UI.table([
    { t: "الموظف", v: i => `<div class="flex items-center gap-2.5">${UI.avatar(empName(e, i.Emp_ID), "w-9 h-9 text-xs")}<div><div class="font-semibold text-slate-900">${esc(empName(e, i.Emp_ID))}</div><div class="text-[11.5px] text-slate-400 num">${esc(i.Emp_ID)}</div></div></div>` },
    { t: "الصافي", cls: "num", v: i => `<b>${fmt(i.Net_Final_Invoice_Amount)}</b>` }, { t: "المقدم", cls: "num", v: i => fmt(i.Down_Payment_Required) }, { t: "المسدد", cls: "num", v: i => `<span class="text-emerald-600">${fmt(i.Total_Paid_Amount)}</span>` },
    { t: "المتبقي", cls: "num", v: i => `<b class="${n(i.Remaining_Balance) ? "text-rose-600" : "text-slate-400"}">${fmt(i.Remaining_Balance)}</b>` + (n(i.Credit_Balance) ? `<div class="text-emerald-600 text-[11px]">له ${fmt(i.Credit_Balance)}</div>` : "") },
    { t: "الخطة", v: i => esc(ar(i.Payment_Plan_Type)) + (n(i.Installments_Count) ? ` · ${i.Installments_Count}` : "") }, { t: "الحالة", v: i => pill(i.Invoice_Status) },
    { t: "", actions: true, v: i => (n(i.Remaining_Balance) > 0 && can("RECORD_EMPLOYEE_PAYMENT") ? `<button class="btn btn-primary btn-xs" data-act="collect" data-id="${esc(i.Emp_Inv_ID)}">${ic("hand-coins")} تحصيل</button>` : "")
      + (n(i.Credit_Balance) && can("REFUND_EMPLOYEE_CREDIT") ? `<button class="btn btn-outline btn-xs" data-act="refund" data-id="${esc(i.Emp_Inv_ID)}">${ic("undo-2")} رد الرصيد</button>` : "")
      + (can("CUSTOMIZE_EMP_INSTALLMENTS") ? `<button class="btn btn-ghost btn-xs" data-act="changePlan" data-id="${esc(i.Res_ID)}">${ic("calendar-range")} الخطة</button>` : "") }
  ], invs, { maxH: 680, emptyIcon: "receipt", empty: "لا فواتير", emptySub: "تصدر فواتير الموظفين بعد تشغيل التوزيع." });
}
Router.add("/a/collect", view => {
  if (noPhase(view)) return;
  const invs = A().empInvoices.filter(i => i.Phase_ID === APP.phaseId);
  const billed = sum(invs, "Net_Final_Invoice_Amount"), paid = sum(invs, "Total_Paid_Amount");
  view.innerHTML = UI.pageHead("التحصيل والفواتير", "تحصيل المقدمات والأقساط وإصدار الإيصالات")
    + `<div class="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-4">${UI.kpi("فواتير المرحلة", money(billed), { icon: "receipt", tone: "brand", foot: invs.length + " فاتورة" })}${UI.kpi("المحصَّل", money(paid), { icon: "circle-check", tone: "green", pct: billed ? paid / billed * 100 : 0 })}${UI.kpi("المتبقي", money(sum(invs, "Remaining_Balance")), { icon: "hourglass", tone: "amber" })}${UI.kpi("لم يسددوا المقدم", fmt(invs.filter(i => n(i.Total_Paid_Amount) < n(i.Down_Payment_Required)).length), { icon: "circle-alert", tone: "red" })}</div>
    <section class="card card-pad"><div class="flex flex-wrap items-center gap-3 mb-4">${searchBox("qFin", Q.fin, "بحث بالموظف")}
      <div class="scroll-x !mx-0 !px-0">${[["", "الكل"], ["down", "لم يسدد المقدم"], ["due", "عليه متبقٍ"], ["Overdue", "متأخر"], ["credit", "له رصيد"], ["Paid_In_Full", "مسدد بالكامل"]].map(f => `<button class="chip !h-9" data-act="finF" data-id="${f[0]}" aria-pressed="${(Q.finF || "") === f[0]}">${f[1]}</button>`).join("")}</div></div>
      <div id="finList">${finList()}</div></section>`;
});
on("qFin", v => { Q.fin = v.trim(); rerenderList("finList", finList); });
on("finF", v => { Q.finF = v; Shell.rerender(); });
on("collect", async id => {
  const i = A().empInvoices.find(x => x.Emp_Inv_ID === id), { e } = maps();
  const dueDown = Math.max(0, n(i.Down_Payment_Required) - n(i.Total_Paid_Amount));
  const v = await UI.form({ title: "تحصيل", sub: `${empName(e, i.Emp_ID)} · ${id}`,
    fields: [{ name: "_s", type: "html", html: `<div class="grid grid-cols-3 gap-2">${UI.stat("الصافي", fmt(i.Net_Final_Invoice_Amount))}${UI.stat("المسدد", fmt(i.Total_Paid_Amount))}${UI.stat("المتبقي", `<span class="text-rose-600">${fmt(i.Remaining_Balance)}</span>`)}</div>` },
      { name: "amount", label: dueDown ? `المبلغ (المقدم المتبقي ${fmt(dueDown)})` : "المبلغ", type: "number", value: dueDown || n(i.Remaining_Balance), required: true },
      { name: "method", label: "الوسيلة", type: "seg", value: "CASH", options: [["CASH", "نقدي"], ["INSTAPAY", "إنستاباي"], ["WALLET", "محفظة"], ["PAYROLL", "مرتب"]] },
      { name: "ref", label: "رقم المرجع / التحويل", placeholder: "إلزامي للتحويلات" }], ok: "تحصيل وطباعة الإيصال", icon: "hand-coins" });
  if (!v) return;
  const r = await call("RECORD_EMPLOYEE_PAYMENT", { empInvId: id, amount: v.amount, paymentMethod: v.method, transactionRef: v.ref }, { block: true });
  toast(r.message, r.success ? "success" : "danger");
  if (r.success) { await Admin.load(); printReceipt(r.receiptNo); }
});
on("refund", id => { const i = A().empInvoices.find(x => x.Emp_Inv_ID === id); return act("REFUND_EMPLOYEE_CREDIT", { empInvId: id }, { title: "رد رصيد", message: `رد ${moneyTxt(i.Credit_Balance)} للموظف وتسجيل إيصال رد؟`, ok: "رد الرصيد" }); });
on("changePlan", async resId => {
  const v = await UI.form({ title: "تعديل خطة السداد", intro: "يُعاد بناء جدول الأقساط للمبلغ المتبقي.",
    fields: [{ name: "m", label: "طريقة السداد", type: "seg", value: "INSTALLMENT", options: [["INSTALLMENT", "تقسيط"], ["CASH", "دفعة واحدة"]] },
      { name: "down", label: "المقدم (ج.م)", type: "number", value: 0, cols: 1 }, { name: "cnt", label: "عدد الأقساط", type: "number", value: 3, min: 1, cols: 1 }], ok: "تطبيق" });
  if (!v) return;
  const inst = v.m === "INSTALLMENT";
  await act("CUSTOMIZE_EMP_INSTALLMENTS", { resId, paymentMethod: v.m, downPaymentType: "FIXED", downPaymentInput: inst ? v.down : 0, installmentCount: inst ? v.cnt : 1 });
});
function printReceipt(no) {
  const p = A().empPayments.find(x => x.Receipt_No === no); if (!p) return;
  const { e } = maps(), inv = A().empInvoices.find(i => i.Emp_Inv_ID === p.Emp_Inv_ID) || {};
  openPrint("إيصال", `<h1 style="text-align:center">إيصال ${n(p.Amount) < 0 ? "رد" : "استلام نقدية"} رقم ${esc(no)}</h1><table>
    <tr><th>الموظف</th><td>${esc(empName(e, p.Emp_ID))} (${esc(p.Emp_ID)})</td></tr><tr><th>المبلغ</th><td><b>${fmt(Math.abs(n(p.Amount)))} ج.م</b></td></tr>
    <tr><th>الوسيلة / المرجع</th><td>${esc(ar(p.Payment_Method))} / ${esc(p.Transaction_Ref)}</td></tr><tr><th>التاريخ</th><td>${esc(p.Payment_Date)}</td></tr>
    <tr><th>الفاتورة</th><td>${esc(p.Emp_Inv_ID)} · الصافي ${fmt(inv.Net_Final_Invoice_Amount)} · المتبقي بعد السداد ${fmt(inv.Remaining_Balance)}</td></tr></table>
    <div style="display:flex;justify-content:space-between;margin-top:50px"><div>المحصِّل: ${esc(p.Collected_By)} ..............</div><div>توقيع الموظف: ..............</div></div>`);
}

// ============================================================ الإيصالات والخزينة
Router.add("/a/cash", view => {
  const d = A(), { e } = maps(), dayV = Q.cashDay || new Date().toISOString().slice(0, 10);
  const pays = d.empPayments.filter(p => !APP.phaseId || String(p.Emp_Inv_ID || "").indexOf("-" + APP.phaseId + "-") > 0).slice().reverse();
  const byDay = {}; d.empPayments.filter(p => !isTrue(p.Is_Voided) && day(p.Payment_Date) === dayV).forEach(p => byDay[p.Payment_Method] = (byDay[p.Payment_Method] || 0) + n(p.Amount));
  view.innerHTML = UI.pageHead("الإيصالات والخزينة", "كل إيصال مُرقَّم تسلسلياً، والإقفال اليومي يطابق المنظومة مع الفعلي")
  + `<div class="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_380px] items-start">
    ${UI.section(`${ic("receipt", "text-brand-600")} الإيصالات`, "", UI.table([
      { t: "الإيصال", v: p => `<b class="num">${esc(p.Receipt_No)}</b><div class="text-[11px] text-slate-400 num">${esc(dt(p.Payment_Date))}</div>` },
      { t: "الموظف", v: p => esc(empName(e, p.Emp_ID)) }, { t: "المبلغ", cls: "num", v: p => `<b class="${n(p.Amount) < 0 ? "text-sky-600" : "text-emerald-600"}">${fmt(p.Amount)}</b>` },
      { t: "الوسيلة", v: p => esc(ar(p.Payment_Method)) + (p.Transaction_Ref ? `<div class="text-[11px] text-slate-400">${esc(p.Transaction_Ref)}</div>` : "") }, { t: "المحصِّل", v: "Collected_By" },
      { t: "", actions: true, v: p => isTrue(p.Is_Voided) ? pill("", "ملغى: " + (p.Void_Reason || ""), "red") : `<button class="btn btn-ghost btn-xs" data-act="printRcpt" data-id="${esc(p.Receipt_No)}">${ic("printer")} طباعة</button>` + (can("VOID_EMPLOYEE_PAYMENT") ? `<button class="btn btn-ghost btn-xs text-rose-600" data-act="voidRcpt" data-id="${esc(p.Receipt_No)}">${ic("ban")} إلغاء</button>` : "") }
    ], pays, { maxH: 700, emptyIcon: "receipt", empty: "لا إيصالات" }))}
    <div class="space-y-4">
      ${UI.section(`${ic("calendar-check", "text-brand-600")} إقفال الخزينة اليومي`, "", `
        <label class="label">اليوم</label><input type="date" class="input mb-3" value="${dayV}" data-change="cashDay">
        <div class="rounded-2xl bg-brand-50 p-3.5 mb-3"><div class="text-[12px] font-semibold text-brand-700 mb-2">حسب المنظومة</div>${Object.keys(byDay).length ? Object.keys(byDay).map(k => `<div class="flex justify-between text-[13.5px] py-0.5"><span>${ar(k)}</span><b class="num">${moneyTxt(byDay[k])}</b></div>`).join("") : `<div class="text-sm text-slate-500">لا تحصيلات في هذا اليوم</div>`}</div>
        ${can("CLOSE_CASH_DAY") ? `<button class="btn btn-dark w-full" data-act="closeDay">${ic("lock")} إقفال اليوم</button>` : ""}`)}
      ${UI.section(`${ic("list-checks", "text-brand-600")} آخر الإقفالات`, "", UI.table([{ t: "اليوم", v: c => esc(c.Closing_Date) }, { t: "الوسيلة", v: c => esc(ar(c.Payment_Method)) }, { t: "المنظومة", cls: "num", v: c => fmt(c.System_Amount) }, { t: "الفعلي", cls: "num", v: c => fmt(c.Counted_Amount) }, { t: "الفرق", cls: "num", v: c => `<b class="${n(c.Difference) ? "text-rose-600" : "text-emerald-600"}">${fmt(c.Difference)}</b>` }], d.cashClosings.slice(-12).reverse(), { cardsOnMobile: false, empty: "لا إقفالات بعد", emptyIcon: "lock" }))}
    </div></div>`;
});
on("cashDay", v => { Q.cashDay = v; Shell.rerender(); });
on("printRcpt", id => printReceipt(id));
on("voidRcpt", async no => {
  const v = await UI.form({ title: "إلغاء إيصال " + no, tone: "danger", intro: "الإلغاء يعكس أثر الإيصال على الفاتورة والأقساط، ولا يُسمح بعد إقفال اليوم.", fields: [{ name: "reason", label: "السبب", required: true }], ok: "إلغاء الإيصال" });
  if (v) await act("VOID_EMPLOYEE_PAYMENT", { receiptNo: no, reason: v.reason });
});
on("closeDay", async () => {
  const v = await UI.form({ title: "إقفال الخزينة", sub: Q.cashDay || new Date().toISOString().slice(0, 10), intro: "أدخل المبالغ الفعلية؛ يُسجَّل الفرق تلقائياً. الإقفال نهائي ويمنع إلغاء إيصالات هذا اليوم.",
    fields: [{ name: "CASH", label: "النقدية الفعلية بالخزينة", type: "number", cols: 1 }, { name: "WALLET", label: "وارد المحفظة اليوم", type: "number", cols: 1 }, { name: "INSTAPAY", label: "وارد إنستاباي اليوم", type: "number", cols: 1 }], ok: "إقفال اليوم", tone: "dark", icon: "lock" });
  if (!v) return;
  const counted = {}; Object.keys(v).forEach(k => { if (v[k] !== "") counted[k] = v[k]; });
  await act("CLOSE_CASH_DAY", { date: Q.cashDay || new Date().toISOString().slice(0, 10), counted });
});

// ============================================================ حساب المكتبة
Router.add("/a/supplier", view => {
  const d = A(), { s, b } = maps(), bal = supplierBalances();
  let run = 0;
  view.innerHTML = UI.pageHead("حساب المكتبة", "الفواتير والمطالبات والمرتجعات والمدفوعات",
    lockedBtn("RECORD_BOOK_RETURN", `<button class="btn btn-outline btn-sm" data-act="supReturn">${ic("undo-2")} إرجاع كتب للمكتبة</button>`) + lockedBtn("RECORD_SUPPLIER_PAYMENT", `<button class="btn btn-primary btn-sm" data-act="paySup">${ic("landmark")} دفعة للمكتبة</button>`))
  + `<div class="grid gap-3 sm:gap-4 md:grid-cols-2 mb-4">${Object.keys(bal).length ? Object.keys(bal).map(k => { const x = bal[k], due = x.inv - x.claim - x.ret - x.paid;
      return `<article class="card card-pad"><div class="flex items-center justify-between"><h3 class="font-bold text-slate-900 flex items-center gap-2">${ic("store", "text-brand-600")} ${esc((s[k] || {}).Supplier_Name || k)}</h3><div class="text-left"><div class="text-[11px] text-slate-500">المستحق لها</div><div class="text-xl font-bold num ${due > 0 ? "text-rose-600" : "text-emerald-600"}">${fmt(due)}</div></div></div>
      <div class="grid grid-cols-4 gap-2 mt-3">${UI.stat("فواتير", fmt(x.inv))}${UI.stat("تالف", fmt(x.claim))}${UI.stat("مرتجعات", fmt(x.ret))}${UI.stat("مدفوع", fmt(x.paid))}</div></article>`; }).join("") : `<div class="card md:col-span-2">${UI.empty("landmark", "لا حركات على حساب المكتبة بعد")}</div>`}</div>`
  + UI.section(`${ic("file-text", "text-brand-600")} كشف الحساب`, "", UI.table([
    { t: "التاريخ", cls: "num", v: l => esc(day(l.Trans_Date)) }, { t: "المكتبة", v: l => esc((s[l.Supplier_ID] || {}).Supplier_Name || l.Supplier_ID) }, { t: "البيان", v: "Notes" }, { t: "المرجع", v: "Document_Ref" },
    { t: "مدين", cls: "num", v: l => n(l.Debit_Amount) ? fmt(l.Debit_Amount) : "" }, { t: "دائن", cls: "num", v: l => n(l.Credit_Amount) ? fmt(l.Credit_Amount) : "" }, { t: "الرصيد", cls: "num", v: l => `<b>${fmt(l._bal)}</b>` }
  ], d.supLedger.map(l => { run += n(l.Credit_Amount) - n(l.Debit_Amount); return Object.assign({}, l, { _bal: run }); }).reverse(), { maxH: 560, emptyIcon: "file-text", empty: "لا حركات" }));
});
on("paySup", async () => {
  const v = await UI.form({ title: "دفعة للمكتبة", fields: [
    { name: "supplierId", label: "المكتبة", type: "select", options: A().suppliers.map(s => [s.Supplier_ID, s.Supplier_Name]) },
    { name: "amount", label: "المبلغ", type: "number", required: true, cols: 1 }, { name: "channel", label: "الوسيلة", type: "select", cols: 1, value: "نقدي", options: [["نقدي", "نقدي"], ["تحويل بنكي", "تحويل بنكي"], ["إنستاباي", "إنستاباي"], ["شيك", "شيك"]] },
    { name: "docRef", label: "رقم إيصال المكتبة / التحويل", required: true }, { name: "allowAdvance", label: "دفعة مقدمة (أكبر من المستحق)", type: "check" }], ok: "تسجيل الدفعة", icon: "landmark" });
  if (v) await act("RECORD_SUPPLIER_PAYMENT", Object.assign(v, { phaseId: APP.phaseId }));
});
on("supReturn", async () => {
  const st = A().stockMap || {};
  const v = await UI.form({ title: "إرجاع كتب للمكتبة", intro: "من الرصيد الحر فقط (غير المخصص لموظفين).", fields: [
    { name: "bookId", label: "الكتاب", type: "select", options: A().books.filter(b => st[b.Book_ID] && st[b.Book_ID].free > 0).map(b => [b.Book_ID, `${b.Book_Name} — حر ${st[b.Book_ID].free}`]) },
    { name: "qty", label: "العدد", type: "number", min: 1, required: true }], ok: "تسجيل إذن الارتجاع", icon: "undo-2" });
  if (v) { if (!v.bookId) return toast("لا يوجد رصيد حر للإرجاع", "warning"); await act("RECORD_BOOK_RETURN", { returnType: "SUPPLIER_RETURN", bookId: v.bookId, qty: v.qty, phaseId: APP.phaseId }); }
});

// ============================================================ المصروفات والمخزن
Router.add("/a/expenses", view => {
  const d = A(), { b } = maps(), st = d.stockMap || {};
  const cats = {}; d.expenses.forEach(x => cats[x.Expense_Category] = (cats[x.Expense_Category] || 0) + n(x.Amount));
  const stock = Object.keys(st).filter(k => st[k].onHand).map(k => Object.assign({ id: k }, st[k]));
  view.innerHTML = UI.pageHead("المصروفات والمخزن", "مصروفات المبادرة وأرصدة الكتب وتسويات الجرد",
    lockedBtn("RECORD_STOCK_ADJUSTMENT", `<button class="btn btn-outline btn-sm" data-act="adjStock">${ic("scale")} تسوية جرد</button>`) + lockedBtn("RECORD_INITIATIVE_EXPENSE", `<button class="btn btn-primary btn-sm" data-act="addExp">${ic("plus")} مصروف جديد</button>`))
  + `<div class="grid gap-4 sm:gap-6 lg:grid-cols-[360px_1fr] items-start">
    ${UI.section(`${ic("chart-pie", "text-brand-600")} المصروفات حسب البند`, `الإجمالي ${moneyTxt(sum(d.expenses, "Amount"))}`, Object.keys(cats).length ? UI.bars(Object.keys(cats).map(k => ({ label: k, value: cats[k], tone: "bg-gold-400" })), v => moneyTxt(v)) : UI.empty("coins", "لا مصروفات"))}
    ${UI.section(`${ic("coins", "text-brand-600")} سجل المصروفات`, "", UI.table([{ t: "الرقم", v: x => `<b class="num">${esc(x.Expense_ID)}</b>` }, { t: "التاريخ", cls: "num", v: x => esc(day(x.Expense_Date)) }, { t: "البند", v: "Expense_Category" }, { t: "المستفيد", v: "Beneficiary_Name" }, { t: "الإيصال", v: "Receipt_Doc_No" }, { t: "القيمة", cls: "num", v: x => `<b>${fmt(x.Amount)}</b>` }], d.expenses.slice().reverse(), { maxH: 420, emptyIcon: "coins", empty: "لا مصروفات" }))}
  </div><div class="h-4"></div>`
  + UI.section(`${ic("boxes", "text-brand-600")} أرصدة المخزن`, "", UI.table([{ t: "الكتاب", v: x => `<b>${esc(bookName(b, x.id))}</b>` }, { t: "بالمخزن", cls: "num", v: x => fmt(x.onHand) }, { t: "مخصص لم يُسلَّم", cls: "num", v: x => fmt(x.reserved) }, { t: "حر", cls: "num", v: x => `<b class="text-brand-800">${fmt(x.free)}</b>` }, { t: "متوسط التكلفة", cls: "num", v: x => fmt(x.avgCost) }, { t: "القيمة", cls: "num", v: x => fmt(x.onHand * x.avgCost) }], stock, { maxH: 460, emptyIcon: "boxes", empty: "المخزن فارغ" }));
});
on("addExp", async () => {
  const v = await UI.form({ title: "مصروف جديد", fields: [
    { name: "category", label: "البند", type: "select", options: ["مصاريف شحن ونقل", "مصاريف تحميل وتنزيل ومشال", "مصاريف تعبئة وتغليف", "أجور عمال ومكافآت تنظيم", "أخرى"].map(x => [x, x]) },
    { name: "amount", label: "المبلغ", type: "number", required: true, cols: 1 }, { name: "beneficiary", label: "المستفيد", cols: 1, required: true },
    { name: "docNo", label: "رقم الإيصال", cols: 1 }, { name: "notes", label: "ملاحظات", cols: 1 }], ok: "تسجيل المصروف", icon: "coins" });
  if (v) await act("RECORD_INITIATIVE_EXPENSE", Object.assign(v, { phaseId: APP.phaseId }));
});
on("adjStock", async () => {
  const v = await UI.form({ title: "تسوية جرد المخزن", intro: "موجب للزيادة وسالب للعجز. يُخصم العجز في نتيجة المبادرة.", fields: [
    { name: "bookId", label: "الكتاب", type: "select", options: A().books.map(b => [b.Book_ID, `${b.Book_ID} - ${b.Book_Name}`]) },
    { name: "qty", label: "الكمية (±)", type: "number", required: true, cols: 1 }, { name: "reason", label: "رقم محضر الجرد والسبب", required: true, cols: 1 }], ok: "تسجيل التسوية" });
  if (v) await act("RECORD_STOCK_ADJUSTMENT", Object.assign(v, { phaseId: APP.phaseId }));
});
