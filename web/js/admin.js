/* ============================================================================
 * لوحة الإدارة
 * ========================================================================== */
"use strict";
// قوائم دور النشر والمواد حسب الشهرة (المعاصر، الأضواء، سلاح التلميذ... / عربي، إنجليزي، رياضيات...)
const POPULAR_PUBLISHERS = [
  "المعاصر", "الأضواء", "سلاح التلميذ", "الامتحان", "بوني", "سندباد",
  "الشاطر", "الباهر", "قطر الندى", "بيت باي بيت", "ستيب أهيد", "جيم",
  "برافو", "التفوق", "الوافي", "نيوتن", "مندليف", "المرشد", "الإبداع",
  "كيان", "الفايز", "الموسوعة", "النفيس", "الوسام", "نور البيان",
  "التأسيس السليم", "الأستاذ", "المعلم", "البيان", "الأبرار", "الميسر",
  "ترافيللر", "جينيال", "ستار", "لافي أليكس", "لو اكسلانس", "ماي دريم", "ميرسي"
];

const POPULAR_SUBJECTS = [
  "عربي", "نحو", "نحو وصرف", "بلاغة", "إنجليزي", "رياضيات", "ماث",
  "رياضيات بحتة", "رياضيات تطبيقية", "رياضيات أدبي", "إحصاء",
  "علوم", "ساينس", "علوم متكاملة", "فيزياء", "كيمياء", "أحياء",
  "دراسات", "تاريخ", "جغرافيا", "فلسفة ومنطق", "علم نفس",
  "دين", "فقه شافعي", "تفسير", "حديث", "توحيد", "أصول دين",
  "حاسب آلي", "تكنولوجيا", "أي سي تي", "ديسكفري", "مهارات", "مهارات مهنية",
  "فرنساوي", "ألماني"
];

function normArText(s) {
  return String(s || "").trim().replace(/[إأآا]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, " ").toLowerCase();
}
const PUB_POP_MAP = {};
POPULAR_PUBLISHERS.forEach((p, i) => { PUB_POP_MAP[normArText(p)] = i; });
const SUB_POP_MAP = {};
POPULAR_SUBJECTS.forEach((s, i) => { SUB_POP_MAP[normArText(s)] = i; });

function publisherPopularityRank(name) {
  const norm = normArText(name);
  return PUB_POP_MAP[norm] !== undefined ? PUB_POP_MAP[norm] : 9999;
}
function subjectPopularityRank(name) {
  const norm = normArText(name);
  return SUB_POP_MAP[norm] !== undefined ? SUB_POP_MAP[norm] : 9999;
}

function bookSortComparator(a, b, catalog) {
  const pA = String(a.Publisher || "").trim(), pB = String(b.Publisher || "").trim();
  const rPA = publisherPopularityRank(pA), rPB = publisherPopularityRank(pB);
  if (rPA !== rPB) return rPA - rPB;
  const pubCmp = pA.localeCompare(pB, "ar");
  if (pubCmp !== 0) return pubCmp;

  const sA = String(a.Subject || "").trim(), sB = String(b.Subject || "").trim();
  const rSA = subjectPopularityRank(sA), rSB = subjectPopularityRank(sB);
  if (rSA !== rSB) return rSA - rSB;
  const subCmp = sA.localeCompare(sB, "ar");
  if (subCmp !== 0) return subCmp;

  const cat = catalog || (typeof A === "function" && A() && A().catalog) || {};
  const gList = cat.grades || [];
  const iA = gList.findIndex(g => g.label === a.Grade || g.name === a.Grade);
  const iB = gList.findIndex(g => g.label === b.Grade || g.name === b.Grade);
  const rA = iA >= 0 ? iA : 999, rB = iB >= 0 ? iB : 999;
  if (rA !== rB) return rA - rB;
  const gradeCmp = String(a.Grade || "").localeCompare(String(b.Grade || ""), "ar");
  if (gradeCmp !== 0) return gradeCmp;

  return String(a.Book_ID || "").localeCompare(String(b.Book_ID || ""), undefined, { numeric: true, sensitivity: "base" });
}

const Admin = {
  async load() {
    const r = await call("GET_ADMIN_DASHBOARD_DATA");
    if (!r.success) { toast(r.message, "danger"); return; }
    (r.books || []).forEach(b => {
      if (n(b.Cover_Price) > 0) {
        const first = r2(n(b.Cover_Price) * (1 - n(b.Supplier_Discount_Pct) / 100));
        b.Initial_Purchase_Price = first;
        b.Volume_Discount_Share_Pct = 0;
        b.Standard_Net_Cost = first;
      } else {
        b.Volume_Discount_Share_Pct = 0;
      }
    });
    (r.books || []).sort((a, b) => bookSortComparator(a, b, r.catalog));
    APP.adm = r; store.set("cache", { t: "ADMIN", d: r, p: APP.phaseId });
    if (r.brand) Brand.set(r.brand);
    if (!APP.phaseId || !r.phases.find(p => p.Phase_ID === APP.phaseId)) {
      const op = r.phases.filter(p => p.Phase_Status !== "Completed");
      APP.phaseId = (op[op.length - 1] || r.phases[r.phases.length - 1] || {}).Phase_ID;
    }
    Shell.rerender();
    const ep = $("#epBody"); if (ep && Q.epId) ep.innerHTML = epBody(Q.epId); // ملف موظف مفتوح يتحدث بعد أي عملية
    Notif.badge();
  }
};
const A = () => APP.adm;
const phaseObj = () => A().phases.find(p => p.Phase_ID === APP.phaseId) || {};
const maps = () => ({ e: by(A().employees, "Emp_ID"), b: by(A().books, "Book_ID"), s: by(A().suppliers, "Supplier_ID") });
const phaseItems = () => A().resItems.filter(i => i.Phase_ID === APP.phaseId && !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward");
const empName = (e, id) => (e[id] || {}).Full_Name || id;
const bookName = (b, id) => (b[id] || {}).Book_Name || id;
/** «الناشر · المادة · الصف» للكتاب في القوائم */
const bookMeta = (b, id) => { const x = b[id] || {}, nm = String(x.Book_Name || ""); return [x.Publisher, x.Subject, x.Book_Part, Doc.shortGrade(x.Grade)].filter(v => v && !nm.includes(v)).join(" · "); };
const bookSub = (b, id, extra) => `<div class="text-[11.5px] text-slate-500 truncate"><span class="num text-brand-700 font-semibold">${esc(id)}</span>${bookMeta(b, id) ? " · " + esc(bookMeta(b, id)) : ""}${extra || ""}</div>`;
const noPhase = view => { if (APP.phaseId) return false; view.innerHTML = UI.empty("calendar-range", "لا توجد مراحل بعد", "ابدأ بإنشاء أول مرحلة حجز.", can("SAVE_PHASE") ? `<button class="btn btn-primary mt-5" data-act="phaseForm">${ic("plus")} مرحلة جديدة</button>` : ""); return true; };
const lockedBtn = (action, html) => can(action) ? html : "";
const searchBox = (act, val, ph) => `<div class="input-icon w-full sm:w-72">${ic("search")}<input type="search" class="input input-sm !h-10" placeholder="${esc(ph || "بحث")}" value="${esc(val || "")}" data-input="${act}"></div>`;
const Q = {};
/** اسم الموظف كرابط يفتح ملفه */
const empLink = (id, name) => `<button class="text-right hover:text-brand-700 hover:underline" data-act="empProfile" data-id="${esc(id)}">${esc(name || id)}</button>`;   // نصوص البحث لكل صفحة
const rerenderList = (key, fn) => { const el = $("#" + key); if (el) el.innerHTML = fn(); };

/* ---------- تغيّر الحجوزات بعد تجميد طلب التوريد ----------
   نقارن الطلب الحالي لكل كتاب في المرحلة بما جُمِّد في طلب التوريد، ونرصد الموظفين الذين عدّلوا بعد التجميد. */
function poDrift(phaseId) {
  const d = A(), snaps = d.poSnapshots.filter(p => p.Phase_ID === phaseId);
  if (!snaps.length) return null;
  const frozenAt = snaps.map(p => String(p.Frozen_At || "")).sort().pop();
  const frozen = {}; snaps.forEach(p => { frozen[p.Book_ID] = (frozen[p.Book_ID] || 0) + n(p.Total_Requested_Qty); });
  const now = {}; d.resItems.filter(i => i.Phase_ID === phaseId && !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward")
    .forEach(i => { now[i.Book_ID] = (now[i.Book_ID] || 0) + Math.max(0, n(i.Requested_Qty) - n(i.Allocated_Qty)); });
  const rows = [...new Set([...Object.keys(frozen), ...Object.keys(now)])].map(k => ({ id: k, frozen: frozen[k] || 0, now: now[k] || 0, diff: (now[k] || 0) - (frozen[k] || 0) })).filter(r => r.diff !== 0)
    .sort((a, b) => b.diff - a.diff);
  const changed = d.resHeaders.filter(h => h.Phase_ID === phaseId && String(h.Last_Modified_At || "").slice(0, 19) > frozenAt.slice(0, 19));
  const hasInv = d.supInvHeaders.some(h => h.Phase_ID === phaseId);
  return { frozenAt, rows, changed, more: rows.filter(r => r.diff > 0).reduce((s, r) => s + r.diff, 0), less: rows.filter(r => r.diff < 0).reduce((s, r) => s - r.diff, 0), hasInv };
}
function poDriftBox(dr) {
  if (!dr || (!dr.rows.length && !dr.changed.length)) return "";
  const { b, e } = maps();
  return `<section class="card mb-4 ring-2 ring-amber-300"><div class="px-4 sm:px-5 pt-4 pb-3 flex flex-wrap items-start justify-between gap-3">
    <div><h2 class="card-title text-amber-800">${ic("triangle-alert", "text-amber-500")} تغيّرت الحجوزات بعد تجميد طلب التوريد</h2>
      <p class="card-sub">جُمِّد في <span class="num">${esc(dt(dr.frozenAt))}</span> · عدّل بعده ${fmt(dr.changed.length)} موظف${dr.more ? ` · زيادة <b class="text-rose-600">${fmt(dr.more)}</b> نسخة` : ""}${dr.less ? ` · نقص <b class="text-emerald-600">${fmt(dr.less)}</b> نسخة` : ""}</p></div>
    ${!dr.hasInv && can("GENERATE_PO_SNAPSHOT") ? `<button class="btn btn-gold btn-sm" data-act="freezePO">${ic("refresh-cw")} أعد تجميد الحصر</button>` : `<span class="text-[12px] text-amber-700 max-w-xs">استُلمت فاتورة على المرحلة: اطلب الزيادة من المكتبة كتوريد إضافي، أو تُوزَّع بالأسبقية من المتاح.</span>`}</div>
    <div class="px-4 sm:px-5 pb-4 grid gap-4 lg:grid-cols-2">
      <div>${dr.rows.length ? UI.table([{ t: "الكتاب", v: r => `<b>${esc(bookName(b, r.id))}</b><div class="text-[11px] text-slate-400 num">${esc(r.id)}</div>` }, { t: "في الطلب", cls: "num", v: r => fmt(r.frozen) }, { t: "الآن", cls: "num", v: r => fmt(r.now) },
        { t: "الفرق", cls: "num", v: r => `<b class="${r.diff > 0 ? "text-rose-600" : "text-emerald-600"}">${r.diff > 0 ? "+" : ""}${fmt(r.diff)}</b>` }], dr.rows, { maxH: 260, cardsOnMobile: false }) : `<div class="text-sm text-slate-500">لا فرق في الكميات (تغيّر توزيع الكتب بين الموظفين فقط).</div>`}</div>
      <div><div class="label">الموظفون الذين عدّلوا بعد التجميد</div>${dr.changed.length ? `<ul class="divide-y divide-slate-100 max-h-[260px] overflow-auto">${dr.changed.map(h => `<li class="flex items-center justify-between gap-2 py-2 text-[13px]"><span>${empLink(h.Emp_ID, empName(e, h.Emp_ID))}${h.Res_Status === "Cancelled" ? ` ${pill("", "ألغى", "red")}` : ""}</span><span class="text-[11.5px] text-slate-400 num">${esc(dt(h.Last_Modified_At))}</span></li>`).join("")}</ul>` : `<div class="text-sm text-slate-500">—</div>`}</div>
    </div></section>`;
}

// ============================================================ لوحة القيادة
const FLOW = [["Open", "الحجز", "calendar-check"], ["Closed", "إغلاق الحجز", "lock"], ["Ordered", "طلب التوريد", "clipboard-list"], ["Receiving", "الاستلام والجرد", "truck"], ["Delivering", "التوزيع والتسليم", "package-check"], ["Completed", "الإغلاق", "circle-check"]];
const NEXT = {
  Draft: ["افتح الحجز للموظفين", "SET_PHASE_STATUS", "Open"], Scheduled: ["الحجز سيبدأ تلقائياً في موعده", null], Open: ["أغلق الحجز ثم جمّد الحصر", "SET_PHASE_STATUS", "Closed"],
  Closed: ["جمّد الحصر وأرسل طلب التوريد", "go", "/a/po"], Ordered: ["أدخل فاتورة المكتبة ونتيجة الجرد", "go", "/a/receive"], Receiving: ["شغّل التوزيع بالأسبقية", "go", "/a/alloc"],
  Delivering: ["سلّم الكتب وحصّل المقدمات", "go", "/a/dday"], Completed: ["المرحلة مكتملة — راجع التصفية", "go", "/a/reports"]
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
    ${j.ok ? pillTxt("سليمة", "green") : pillTxt("تحتاج مراجعة", "red")}${k === "SYNC_MEMBERS" ? syncBtn("btn-xs") : ""}</li>`; }).join("")}</ul>`;
}
/** مزامنة يدوية للموظفين من MyNekaba (مدير المنظومة فقط؛ الخادم يتحقق أيضاً) */
const syncBtn = cls => APP.user && APP.user.role === "Admin" ? `<button class="btn btn-outline ${cls}" data-act="syncNow" title="مزامنة الموظفين الآن من MyNekaba">${ic("refresh-cw")}<span class="${cls === "btn-xs" ? "hidden sm:inline" : ""}">مزامنة الآن</span></button>` : "";
on("syncNow", async () => {
  if (!await UI.confirm({ title: "مزامنة الموظفين", message: "جلب أحدث بيانات الأعضاء من MyNekaba الآن (إضافة الجدد وتحديث بيانات الموجودين). لا تُحذف حجوزات أو فواتير.", ok: "مزامنة" })) return;
  const r = await call("SYNC_MEMBERS", {}, { block: true });
  toast(r.message || (r.success ? "تمت المزامنة." : "تعذرت المزامنة."), r.success ? "success" : "danger");
  if (r.success) { await Admin.load(); loadHealth(); }
});
const pillTxt = (t, c) => `<span class="text-[11.5px] font-bold rounded-full px-2.5 py-1 ${c === "green" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}">${t}</span>`;
on("goPricing", () => { Q.bookF = { st: "Pricing" }; Router.go("/a/books"); });
function overviewSections() {
  return `<div class="grid gap-4 sm:gap-6 lg:grid-cols-2 mt-4 sm:mt-6">
    ${UI.section(`${ic("badge-check", "text-brand-600")} جاهزية الأسعار`, "نسبة الكتب المسعّرة في كل مرحلة دراسية", pricingByStage(), can("SAVE_BOOK") ? `<a href="#/a/books" data-act="goPricing" class="btn btn-ghost btn-sm">الكتب ${ic("chevron-left")}</a>` : "")}
    ${UI.section(`${ic("activity", "text-brand-600")} صحة المنظومة`, "المهام الليلية خلال آخر 26 ساعة", healthBox())}
  </div>
  <div class="mt-4 sm:mt-6">${UI.section(`${ic("megaphone", "text-brand-600")} الإعلانات للموظفين`, "إشعارات الموظفين: أخبار المرحلة ومواعيد الحجز والتسليم — تظهر في رئيسيته وجرس الإشعارات", annList(), lockedBtn("POST_ANNOUNCEMENT", `<button class="btn btn-primary btn-sm" data-act="annNew">${ic("plus")} إعلان جديد</button>`))}</div>`;
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
  const drift = poDrift(APP.phaseId);
  if (drift && (drift.rows.length || drift.changed.length)) alerts.unshift(["triangle-alert", "red", `تغيّرت الحجوزات بعد طلب التوريد`, `${fmt(drift.changed.length)} موظف عدّل${drift.more ? ` · زيادة ${fmt(drift.more)} نسخة تحتاج توريداً` : ""}${drift.less ? ` · نقص ${fmt(drift.less)}` : ""}`, "/a/po"]);
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
  const top = Object.keys(agg).sort((x, y) => agg[y] - agg[x]).slice(0, 6).map((k, i) => ({ label: bookName(b, k), value: agg[k], act: "bookRes", id: k, tone: i === 0 ? "bg-gradient-to-l from-brand-500 to-brand-700" : "bg-brand-400/80" }));
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

  ${todayStrip()}${readinessBox()}${pricingPriority()}${watchBox()}
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
    ${UI.section(`${ic("receipt", "text-brand-600")} آخر الإيصالات`, "", recent.length ? `<ul class="divide-y divide-slate-100">${recent.map(p => `<li class="flex items-center gap-3 py-2.5">${UI.avatar(empName(e, p.Emp_ID), "w-9 h-9 text-xs")}<div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px] truncate">${empLink(p.Emp_ID, empName(e, p.Emp_ID))}</div><div class="text-[11.5px] text-slate-400 num">${esc(p.Receipt_No)} · ${esc(ar(p.Payment_Method))} · ${esc(dt(p.Payment_Date))}</div></div><div class="font-bold num text-emerald-600">${fmt(p.Amount)}</div></li>`).join("")}</ul>` : UI.empty("receipt", "لا إيصالات بعد"), `<a href="#/a/cash" class="btn btn-ghost btn-sm">الكل ${ic("chevron-left")}</a>`)}
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
  const cover = n(f.coverPrice), sd = n(f.supplierDiscountPct);
  const ed = f.empDiscountPct === "" || f.empDiscountPct === undefined ? n(A().settingsMap.UNIFIED_EMP_DISCOUNT_PCT) : n(f.empDiscountPct);
  const first = r2(cover * (1 - sd / 100)), cost = first, emp = ceil(cover * (1 - ed / 100));
  return { first, cost, emp, margin: r2(emp - cost), sd, ed };
}
/** عدد الحاجزين والنسخ لكل كتاب في المرحلة المختارة */
function resCount() {
  const m = {}, seen = {};
  if (APP.phaseId) phaseItems().forEach(i => { const c = m[i.Book_ID] = m[i.Book_ID] || { p: 0, q: 0 }; c.q += n(i.Requested_Qty); const k = i.Book_ID + "|" + i.Emp_ID; if (!seen[k]) { seen[k] = 1; c.p++; } });
  return m;
}
/** نافذة الحاجزين لكتاب خلال المرحلة المختارة، بترتيب الأسبقية */
function bookResRows(bookId) {
  const { e } = maps(), q = (Q.bookRes || "").toLowerCase();
  return phaseItems().filter(i => i.Book_ID === bookId).sort((a, b) => String(a.Priority_Timestamp).localeCompare(String(b.Priority_Timestamp)))
    .map((i, k) => ({ i, k: k + 1, emp: e[i.Emp_ID] || {} }))
    .filter(r => !q || (String(r.emp.Full_Name || "") + r.i.Emp_ID + (r.emp.Department || "")).toLowerCase().includes(q));
}
function bookResList(bookId) {
  const rows = bookResRows(bookId);
  if (!rows.length) return UI.empty("users", Q.bookRes ? "لا نتائج للبحث" : "لا يوجد حاجزون لهذا الكتاب", Q.bookRes ? "" : "في المرحلة المختارة.");
  return `<ul class="divide-y divide-slate-100">${rows.map(({ i, k, emp }) => { const w = Math.max(0, n(i.Requested_Qty) - Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)));
    return `<li class="flex items-center gap-3 py-2.5"><span class="w-7 text-center text-xs font-bold text-slate-400 num">${k}</span>${UI.avatar(emp.Full_Name || i.Emp_ID, "w-9 h-9 text-xs")}
    <div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px] truncate">${empLink(i.Emp_ID, emp.Full_Name || i.Emp_ID)}</div><div class="text-[11.5px] text-slate-400 truncate"><span class="num">${esc(i.Emp_ID)}</span>${emp.Department ? " · " + esc(emp.Department) : ""}${emp.Mobile ? ` · <a class="num text-brand-700" href="tel:${esc(emp.Mobile)}">${esc(emp.Mobile)}</a>` : ""}</div></div>
    <div class="text-left shrink-0"><div class="font-bold num">${fmt(i.Requested_Qty)} <span class="text-[11px] font-normal text-slate-400">نسخة</span></div>${w ? `<span class="text-[11px] text-amber-600 font-semibold">انتظار ${fmt(w)}</span>` : n(i.Delivered_Qty) ? `<span class="text-[11px] text-emerald-600 font-semibold">سُلّم ${fmt(i.Delivered_Qty)}</span>` : n(i.Allocated_Qty) ? `<span class="text-[11px] text-sky-600 font-semibold">مخصص ${fmt(i.Allocated_Qty)}</span>` : ""}</div></li>`; }).join("")}</ul>`;
}
on("bookRes", id => {
  const { b } = maps(), bk = b[id] || {}; Q.bookRes = ""; Q.bookResId = id;
  if (!APP.phaseId) { toast("لا توجد مرحلة حجز بعد.", "info"); return; }
  const all = phaseItems().filter(i => i.Book_ID === id);
  const req = sum(all, "Requested_Qty"), al = sum(all, "Allocated_Qty"), dl = sum(all, "Delivered_Qty");
  const wait = all.reduce((s, i) => s + Math.max(0, n(i.Requested_Qty) - Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty))), 0);
  UI.open(`<div class="grid grid-cols-4 gap-2 mb-3">${UI.stat("الحاجزون", fmt(new Set(all.map(i => i.Emp_ID)).size))}${UI.stat("محجوز", fmt(req))}${UI.stat("مُسلَّم", fmt(dl))}${UI.stat("انتظار", fmt(wait), wait ? "!bg-amber-50" : "")}</div>
    ${all.length > 6 ? `<div class="mb-2">${searchBox("qBookRes", "", "بحث بالاسم أو الرقم أو جهة العمل")}</div>` : ""}
    <div class="text-[11.5px] text-slate-400 mb-1">بترتيب الأسبقية في الحجز${al ? ` · مخصص ${fmt(al)}` : ""}</div><div id="bookResList">${bookResList(id)}</div>`,
    { title: esc(bk.Book_Name || id), sub: `${esc(id)} · ${esc(bk.Grade || "")} · ${esc(phaseObj().Phase_Name || "")}`, wide: true,
      footer: all.length ? `<button class="btn btn-outline btn-sm w-full sm:w-auto" data-act="exportBookRes" data-id="${esc(id)}">${ic("download")} تصدير القائمة</button>` : "" });
});
on("qBookRes", v => { Q.bookRes = v.trim(); rerenderList("bookResList", () => bookResList(Q.bookResId)); });
on("exportBookRes", id => { const { b } = maps(); exportCSV("حاجزو " + ((b[id] || {}).Book_Name || id), ["الأسبقية", "رقم الموظف", "الاسم", "جهة العمل", "الموبايل", "محجوز", "مخصص", "مُسلَّم"], (Q.bookRes = "", bookResRows(id)).map(({ i, k, emp }) => [k, i.Emp_ID, emp.Full_Name, emp.Department, emp.Mobile, i.Requested_Qty, i.Allocated_Qty, i.Delivered_Qty])); });

// حالة واجهة جدول الكتب الاحترافية: التعديل المباشر بالجدول + لوحة الإدخال السريع + الفلاتر
const BK_UI = {
  inlineMode: false,
  editingRow: null,
  dirty: {}, // { bookId: { coverPrice, supplierDiscountPct, empDiscountPct, bookStatus } }
  quickOpen: false,
  openDropdown: null, // المفتاح المفتوح حالياً للقائمة المنسدلة: "pub" | "sub" | "grade" | "type" | "st"
  msSearch: {},       // نص البحث الداخلي داخل القائمة المنسدلة
  qForm: { mode: "single", stage: "", grade: "4 ابتدائي", publisher: "", subject: "", bookPart: "شرح", schoolTypes: "حكومي", coverPrice: "", supplierDiscountPct: "" }
};

function getFilterArr(f, key) {
  if (!f || f[key] === undefined || f[key] === null) return [];
  if (Array.isArray(f[key])) return f[key].map(v => String(v).trim()).filter(Boolean);
  const s = String(f[key]).trim();
  return s ? s.split(/[,|]/).map(x => x.trim()).filter(Boolean) : [];
}

function getBookFilterScope(excludeKey) {
  const d = A(), f = Q.bookF || {}, q = (Q.books || "").trim().toLowerCase();
  const stages = getFilterArr(f, "stage");
  const grades = getFilterArr(f, "grade");
  const pubs = getFilterArr(f, "pub");
  const subs = getFilterArr(f, "sub");
  const types = getFilterArr(f, "type");
  const sts = getFilterArr(f, "st");

  return (d.books || []).filter(x => {
    if (excludeKey !== "q" && q) {
      const hay = (x.Book_ID + " " + x.Book_Name + " " + x.Grade + " " + x.Stage + " " + x.Subject + " " + x.Publisher + " " + (x.Book_Part || "")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (excludeKey !== "stage" && stages.length > 0 && !stages.includes(x.Stage)) return false;
    if (excludeKey !== "grade" && grades.length > 0 && !grades.includes(x.Grade)) return false;
    if (excludeKey !== "pub" && pubs.length > 0 && !pubs.includes(x.Publisher)) return false;
    if (excludeKey !== "sub" && subs.length > 0 && !subs.includes(x.Subject)) return false;
    if (excludeKey !== "type" && types.length > 0) {
      const bTypes = String(x.School_Types || "").split(/[,،]/).map(s => s.trim());
      if (!types.some(t => bTypes.includes(t))) return false;
    }
    if (excludeKey !== "st" && sts.length > 0 && !sts.includes(x.Book_Status)) return false;
    return true;
  });
}

function filteredBooksList() {
  return getBookFilterScope(null).sort(bookSortComparator);
}

function validateBookFilters() {
  const f = Q.bookF;
  if (!f) return;
  const scopePub = getBookFilterScope("pub");
  const scopeStage = getBookFilterScope("stage");
  const scopeGrade = getBookFilterScope("grade");
  const scopeSub = getBookFilterScope("sub");
  const scopeType = getBookFilterScope("type");
  const scopeSt = getBookFilterScope("st");

  if (f.pub !== undefined) {
    const arr = getFilterArr(f, "pub").filter(p => scopePub.some(b => b.Publisher === p));
    f.pub = arr;
  }
  if (f.stage !== undefined) {
    const arr = getFilterArr(f, "stage").filter(st => scopeStage.some(b => b.Stage === st));
    f.stage = arr;
  }
  if (f.grade !== undefined) {
    const arr = getFilterArr(f, "grade").filter(g => scopeGrade.some(b => b.Grade === g));
    f.grade = arr;
  }
  if (f.sub !== undefined) {
    const arr = getFilterArr(f, "sub").filter(s => scopeSub.some(b => b.Subject === s));
    f.sub = arr;
  }
  if (f.type !== undefined) {
    const arr = getFilterArr(f, "type").filter(t => scopeType.some(b => String(b.School_Types || "").split(/[,،]/).map(s => s.trim()).includes(t)));
    f.type = arr;
  }
  if (f.st !== undefined) {
    const arr = getFilterArr(f, "st").filter(st => scopeSt.some(b => b.Book_Status === st));
    f.st = arr;
  }
}

function rowDraftOf(x) {
  const dr = BK_UI.dirty[x.Book_ID];
  return {
    coverPrice: dr && dr.coverPrice !== undefined ? dr.coverPrice : (x.Book_Status === "Pricing" && !n(x.Cover_Price) ? "" : x.Cover_Price),
    supplierDiscountPct: dr && dr.supplierDiscountPct !== undefined ? dr.supplierDiscountPct : x.Supplier_Discount_Pct,
    empDiscountPct: dr && dr.empDiscountPct !== undefined ? dr.empDiscountPct : (x.Emp_Discount_Pct === undefined ? "" : x.Emp_Discount_Pct),
    bookStatus: dr && dr.bookStatus !== undefined ? dr.bookStatus : x.Book_Status
  };
}

function booksTable() {
  const d = A(), st = d.stockMap || {}, q = (Q.books || "").toLowerCase();
  const list = filteredBooksList();
  const rcMap = resCount();
  const canEdit = can("SAVE_BOOK");
  const dirtyIds = Object.keys(BK_UI.dirty);

  const stageTone = stg => /أطفال/.test(stg) ? "bg-amber-50 text-amber-800 ring-amber-200" : /ابتدائ/.test(stg) ? "bg-brand-50 text-brand-800 ring-brand-200" : /إعداد/.test(stg) ? "bg-sky-50 text-sky-800 ring-sky-200" : /ثانو/.test(stg) ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-700 ring-slate-200";

  // شريط حفظ التعديلات المباشرة داخل الجدول
  const dirtyBanner = dirtyIds.length ? `
    <div id="bkDirtyBar" class="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50/90 ring-1 ring-amber-300 px-4 py-2.5 text-sm shadow-xs">
      <div class="flex items-center gap-2 text-amber-900 font-semibold">
        <span class="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold num text-xs">${dirtyIds.length}</span>
        <span>لديك تعديلات مباشرة غير محفوظة في الجدول على <b>${dirtyIds.length}</b> كتاب</span>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" class="btn btn-primary btn-xs" data-act="bkSaveAllInline">${ic("check")} حفظ كل التعديلات (${dirtyIds.length})</button>
        <button type="button" class="btn btn-outline btn-xs" data-act="bkDiscardInline">${ic("x")} تراجع</button>
      </div>
    </div>` : "";

  // حساب إجماليات ومتوسطات صف التذييل
  const priced = list.filter(x => x.Book_Status !== "Pricing" && n(x.Cover_Price) > 0);
  const totResP = list.reduce((s, x) => s + (rcMap[x.Book_ID] ? rcMap[x.Book_ID].p : 0), 0);
  const totResQ = list.reduce((s, x) => s + (rcMap[x.Book_ID] ? rcMap[x.Book_ID].q : 0), 0);
  const avgCover = priced.length ? r2(sum(priced, "Cover_Price") / priced.length) : 0;
  const avgCost = priced.length ? r2(sum(priced, "Standard_Net_Cost") / priced.length) : 0;
  const avgEmp = priced.length ? r2(sum(priced, "Emp_Selling_Price") / priced.length) : 0;
  const avgMargin = r2(avgEmp - avgCost);
  const totOnHand = list.reduce((s, x) => s + n(st[x.Book_ID] ? st[x.Book_ID].onHand : 0), 0);
  const totFree = list.reduce((s, x) => s + n(st[x.Book_ID] ? st[x.Book_ID].free : 0), 0);

  const footHtml = list.length ? `<tr>
    <td class="text-slate-600 whitespace-nowrap">الإجمالي (${fmt(list.length)})</td>
    <td class="text-xs text-slate-500">كتب مطابقة (${fmt(priced.length)} مسعّر)</td>
    <td class="text-xs text-slate-500">—</td>
    <td class="text-xs text-slate-500">—</td>
    <td class="num text-center whitespace-nowrap">${totResQ ? `${fmt(totResP)} | ${fmt(totResQ)} ن` : "0"}</td>
    <td class="num text-center text-slate-700" title="متوسط سعر الغلاف">${avgCover ? fmt(avgCover) : "—"}</td>
    <td class="num text-center text-slate-500">—</td>
    <td class="num text-center text-slate-700" title="متوسط صافي التكلفة">${avgCost ? fmt(avgCost) : "—"}</td>
    <td class="num text-center text-brand-800" title="متوسط سعر الموظف">${avgEmp ? fmt(avgEmp) : "—"}</td>
    <td class="num text-center ${avgMargin < 0 ? "text-rose-600" : "text-emerald-700"}" title="متوسط الهامش">${priced.length ? fmt(avgMargin) : "—"}</td>
    <td class="num text-center whitespace-nowrap">${fmt(totOnHand)} / ${fmt(totFree)}</td>
    <td class="col-act"></td>
  </tr>` : "";

  const tbl = UI.table([
    { t: "الكود", cls: "w-20 whitespace-nowrap", v: x => `<span class="inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-[11.5px] font-bold num ring-1 ${stageTone(x.Stage || "")}">${esc(x.Book_ID)}</span>` },
    { t: "الكتاب · الناشر · المادة", v: x => `<div class="flex items-center gap-2">${coverThumb(x)}<div class="min-w-0 flex-1">
      <button class="text-right font-bold text-slate-900 hover:text-brand-700 hover:underline leading-snug block truncate max-w-[230px]" data-act="bookRes" data-id="${esc(x.Book_ID)}" title="${esc(x.Book_Name)}">${esc(x.Book_Name)}</button>
      <div class="flex flex-wrap items-center gap-1 mt-0.5">
        <span class="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 text-[10.5px] font-semibold">${esc(x.Publisher || "—")}</span>
        <span class="inline-flex items-center rounded-md bg-brand-50/70 text-brand-800 px-1.5 py-0.5 text-[10.5px] font-semibold">${esc(x.Subject || "—")}</span>
        ${x.Book_Part ? `<span class="inline-flex items-center rounded-md bg-amber-50 text-amber-800 px-1.5 py-0.5 text-[10px] font-semibold">${esc(x.Book_Part)}</span>` : ""}
      </div>
    </div></div>` },
    { t: "الصف والمدرسة", cls: "whitespace-nowrap", v: x => `<div class="leading-tight">
      <div class="font-bold text-slate-800 text-xs">${esc(x.Grade)}</div>
      <div class="flex items-center gap-1 mt-0.5">
        <span class="text-[10px] text-slate-400">${esc((x.Stage || "").replace("المرحلة ", ""))}</span>
        <span class="inline-flex items-center rounded ring-1 ring-slate-200 bg-white px-1 py-0 text-[10px] font-semibold text-slate-600">${esc(x.School_Types || "حكومي")}</span>
      </div>
    </div>` },
    { t: "الحالة", cls: "whitespace-nowrap", v: x => {
      const inEd = canEdit && (BK_UI.inlineMode || BK_UI.editingRow === x.Book_ID);
      const dr = rowDraftOf(x);
      if (inEd) {
        return `<select class="tbl-sel" data-bk-inline="${esc(x.Book_ID)}" data-f="bookStatus">
          ${[["Available", "متاح"], ["Pricing", "جاري التسعير"], ["Not_Yet_Printed", "لم يُطبع بعد"], ["Suspended", "موقوف"], ["Discontinued", "ملغى"]].map(o => `<option value="${o[0]}" ${dr.bookStatus === o[0] ? "selected" : ""}>${o[1]}</option>`).join("")}
        </select>`;
      }
      return pill(x.Book_Status);
    } },
    { t: "الحاجزون", cls: "num text-center whitespace-nowrap", v: x => { const c = rcMap[x.Book_ID]; return c ? `<button class="inline-flex items-center gap-1 rounded-lg bg-brand-50/70 hover:bg-brand-100 text-brand-800 px-1.5 py-0.5 text-[11.5px] font-bold transition" data-act="bookRes" data-id="${esc(x.Book_ID)}" title="${fmt(c.p)} حاجز · ${fmt(c.q)} نسخة">${ic("users", "!w-3 !h-3")} ${fmt(c.p)} <span class="text-slate-300 font-normal">|</span> ${fmt(c.q)}</button>` : `<span class="text-slate-300">0</span>`; } },
    { t: "الغلاف", cls: "num text-center whitespace-nowrap", v: x => {
      const inEd = canEdit && (BK_UI.inlineMode || BK_UI.editingRow === x.Book_ID);
      const dr = rowDraftOf(x);
      if (inEd) {
        return `<input type="number" step="any" inputmode="decimal" class="tbl-inp" data-bk-inline="${esc(x.Book_ID)}" data-f="coverPrice" value="${esc(dr.coverPrice)}" placeholder="الغلاف">`;
      }
      return x.Book_Status === "Pricing" && !n(x.Cover_Price)
        ? `<button type="button" class="inline-flex items-center gap-1 rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-1.5 py-0.5 text-[11px] font-semibold hover:bg-amber-100 transition" ${canEdit ? `data-act="bkQuickRow" data-id="${esc(x.Book_ID)}" title="اضغط لإدخال السعر فوراً"` : ""}>تسعير ${canEdit ? ic("pencil", "!w-3 !h-3") : ""}</button>`
        : `<button type="button" class="font-bold text-slate-800 hover:text-brand-700 transition inline-flex items-center gap-0.5" ${canEdit ? `data-act="bkQuickRow" data-id="${esc(x.Book_ID)}" title="اضغط للتعديل السريع بالجدول"` : ""}>${fmt(x.Cover_Price)}</button>`;
    } },
    { t: "خصم%", cls: "num text-center whitespace-nowrap", v: x => {
      const inEd = canEdit && (BK_UI.inlineMode || BK_UI.editingRow === x.Book_ID);
      const dr = rowDraftOf(x);
      if (inEd) {
        return `<div class="inline-flex items-center gap-0.5"><input type="number" step="any" inputmode="decimal" class="tbl-inp !w-14" data-bk-inline="${esc(x.Book_ID)}" data-f="supplierDiscountPct" value="${esc(dr.supplierDiscountPct)}" placeholder="%"></div>`;
      }
      return `<span class="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11.5px] font-semibold text-slate-700">${fmt(x.Supplier_Discount_Pct)}%</span>`;
    } },
    { t: "التكلفة", cls: "num text-center whitespace-nowrap", v: x => {
      const dr = rowDraftOf(x);
      const p = bookPrice(dr);
      const cost = BK_UI.dirty[x.Book_ID] ? p.cost : n(x.Standard_Net_Cost);
      return `<span data-bk-cost="${esc(x.Book_ID)}" class="font-semibold text-slate-700">${fmt(cost)}</span>`;
    } },
    { t: "للموظف", cls: "num text-center whitespace-nowrap", v: x => {
      const dr = rowDraftOf(x);
      const p = bookPrice(dr);
      const emp = BK_UI.dirty[x.Book_ID] ? p.emp : n(x.Emp_Selling_Price);
      return `<b data-bk-emp="${esc(x.Book_ID)}" class="inline-flex items-center justify-center rounded-lg bg-brand-50 text-brand-900 px-2 py-0.5 font-bold">${fmt(emp)}</b>`;
    } },
    { t: "الهامش", cls: "num text-center whitespace-nowrap", v: x => {
      const dr = rowDraftOf(x);
      const p = bookPrice(dr);
      const m = BK_UI.dirty[x.Book_ID] ? p.margin : r2(n(x.Emp_Selling_Price) - n(x.Standard_Net_Cost));
      return `<span data-bk-margin="${esc(x.Book_ID)}" class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11.5px] font-bold ${m < 0 ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200" : "bg-emerald-50 text-emerald-700"}">${fmt(m)}</span>`;
    } },
    { t: "المخزن", cls: "num text-center whitespace-nowrap", v: x => {
      const oh = st[x.Book_ID] ? st[x.Book_ID].onHand : 0, fr = st[x.Book_ID] ? st[x.Book_ID].free : 0;
      return `<span class="text-xs font-semibold ${oh > 0 ? "text-slate-800" : "text-slate-400"}">${fmt(oh)}<span class="text-slate-300 mx-0.5">/</span><span class="${fr > 0 ? "text-emerald-700 font-bold" : ""}">${fmt(fr)}</span></span>`;
    } },
    { t: "إجراءات", actions: true, cls: "w-28", v: x => {
      const hasUse = !!(rcMap[x.Book_ID] || (st[x.Book_ID] && st[x.Book_ID].onHand));
      const isRowEd = BK_UI.editingRow === x.Book_ID || !!BK_UI.dirty[x.Book_ID];
      return `<div class="inline-flex items-center justify-center gap-1">
        ${canEdit && isRowEd ? `<button type="button" class="act-ic act-ic-save" data-act="bkSaveRow" data-id="${esc(x.Book_ID)}" title="حفظ التعديل السريع لهذا الكتاب" aria-label="حفظ">${ic("check")}</button>` : ""}
        ${canEdit && !BK_UI.inlineMode && !isRowEd ? `<button type="button" class="act-ic act-ic-brand" data-act="bkQuickRow" data-id="${esc(x.Book_ID)}" title="تعديل السعر والخصم مباشرة بالجدول" aria-label="تعديل السعر بالجدول">${ic("sliders-horizontal")}</button>` : ""}
        ${canEdit ? `<button type="button" class="act-ic act-ic-edit" data-act="bookForm" data-id="${esc(x.Book_ID)}" title="تعديل بيانات الكتاب" aria-label="تعديل">${ic("pencil")}</button>
        <button type="button" class="act-ic act-ic-copy" data-act="bookClone" data-id="${esc(x.Book_ID)}" title="نسخ الكتاب لصف دراسي آخر أو سلسلة بكود جديد" aria-label="نسخ لصف">${ic("copy")}</button>` : ""}
        ${!hasUse && can("DELETE_BOOK") ? `<button type="button" class="act-ic act-ic-del" data-act="bookDel" data-id="${esc(x.Book_ID)}" title="حذف الكتاب" aria-label="حذف">${ic("trash-2")}</button>` : ""}
      </div>`;
    } }
  ], list, {
    maxH: 660,
    foot: footHtml,
    rowCls: x => BK_UI.dirty[x.Book_ID] ? "row-dirty" : (n(x.Emp_Selling_Price) < n(x.Standard_Net_Cost) && x.Book_Status !== "Pricing" ? "row-loss" : ""),
    rowAttr: x => `data-book-row="${esc(x.Book_ID)}"`,
    emptyIcon: "library-big",
    empty: q ? "لا نتائج مطابقة للبحث أو الفلتر" : "الكتالوج فارغ",
    emptySub: q ? "جرّب تغيير المرحلة أو مسح الفلاتر." : "أضف الكتب من لوحة الإدخال السريع أعلاه أو من استوديو الإضافة."
  });
  return dirtyBanner + tbl;
}

/** لوحة الإدخال السريع المدمجة أعلى جدول الكتب (إضافة كتاب أو سلسلة كاملة في ثوانٍ بدون نوافذ منبثقة) */
function quickBookEntryBarHTML() {
  if (!can("SAVE_BOOK") || !BK_UI.quickOpen) return "";
  const d = A(), c = d.catalog || {}, qf = BK_UI.qForm;
  const grades = c.grades || [];
  const pubs = (c.publishers || []).slice().sort((a, b) => {
    const ra = publisherPopularityRank(a), rb = publisherPopularityRank(b);
    return ra !== rb ? ra - rb : a.localeCompare(b, "ar");
  });
  const subs = (c.subjects || []).slice().sort((a, b) => {
    const ra = subjectPopularityRank(a), rb = subjectPopularityRank(b);
    return ra !== rb ? ra - rb : a.localeCompare(b, "ar");
  });
  const parts = c.parts || [];
  if (!qf.publisher && pubs[0]) qf.publisher = pubs[0];
  if (!qf.subject && subs[0]) qf.subject = subs[0];
  if (qf.supplierDiscountPct === "" && d.suppliers[0] && d.suppliers[0].Default_Discount_Pct !== undefined) qf.supplierDiscountPct = d.suppliers[0].Default_Discount_Pct;
  const p = bookPrice(qf);
  const autoName = previewBookName(qf.publisher, qf.subject, qf.bookPart, qf.schoolTypes);
  const gObj = grades.find(g => g.label === qf.grade);
  const nextCode = qf.mode === "series" && qf.stage
    ? grades.filter(g => g.stage === qf.stage).map(g => g.code).join("، ")
    : (gObj ? nextCodePreview(gObj.code, d.books) : "تلقائي");

  return `
    <div id="quickBookPanel" class="mb-4 rounded-2xl bg-gradient-to-b from-brand-50/70 via-white to-white ring-1 ring-brand-200 p-4 shadow-soft">
      <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200/80">
        <div class="flex items-center gap-2.5">
          <span class="w-9 h-9 rounded-xl bg-brand-700 text-white flex items-center justify-center shadow-xs">${ic("zap" in (window.ICONS || {}) ? "zap" : "plus")}</span>
          <div>
            <h3 class="font-bold text-slate-900 text-sm">لوحة الإدخال السريع للكتب والسلاسل</h3>
            <p class="text-[11.5px] text-slate-500">أدخل الكتاب أو السلسلة مباشرة في خطوة واحدة، أو اضغط «إضافة +» بجانب أي قائمة لإضافة دار نشر أو مادة جديدة</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[11.5px] text-slate-500 font-semibold ml-1">تحديد سريع:</span>
          <button type="button" class="qchip ${qf.mode === "single" ? "active" : ""}" data-act="qbMode" data-id="single">كتاب لصف واحد</button>
          <button type="button" class="qchip ${qf.mode === "series" && qf.stage === "المرحلة الابتدائية" ? "active" : ""}" data-act="qbSeries" data-id="المرحلة الابتدائية">سلسلة الابتدائي (1–6)</button>
          <button type="button" class="qchip ${qf.mode === "series" && qf.stage === "المرحلة الإعدادية" ? "active" : ""}" data-act="qbSeries" data-id="المرحلة الإعدادية">سلسلة الإعدادي (1–3)</button>
          <button type="button" class="qchip ${qf.mode === "series" && qf.stage === "المرحلة الثانوية" ? "active" : ""}" data-act="qbSeries" data-id="المرحلة الثانوية">سلسلة الثانوي (1–3)</button>
          <button type="button" class="qchip ${qf.mode === "series" && qf.stage === "رياض الأطفال" ? "active" : ""}" data-act="qbSeries" data-id="رياض الأطفال">رياض الأطفال</button>
          <button type="button" class="icon-btn w-8 h-8 text-slate-400 hover:text-slate-700" data-act="toggleQuickEntry" title="طي لوحة الإدخال السريع">${ic("x")}</button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5 items-end">
        <div>
          <label class="label !text-[11.5px]">${qf.mode === "series" ? "المرحلة (سلسلة كاملة)" : "الصف الدراسي"}</label>
          ${qf.mode === "series"
            ? `<select class="input !h-10 !text-xs font-bold text-brand-800 bg-brand-50/40" data-change="qbField" data-k="stage">
                ${["المرحلة الابتدائية", "المرحلة الإعدادية", "المرحلة الثانوية", "رياض الأطفال"].map(st => `<option value="${esc(st)}" ${qf.stage === st ? "selected" : ""}>كل صفوف ${esc(st)} (${grades.filter(g => g.stage === st).length} صفوف)</option>`).join("")}
              </select>`
            : `<select class="input !h-10 !text-xs font-semibold" data-change="qbField" data-k="grade">
                ${grades.map(g => `<option value="${esc(g.label)}" ${qf.grade === g.label ? "selected" : ""}>${esc(g.label)} (${esc(g.code)})</option>`).join("")}
              </select>`}
        </div>
        <div>
          <div class="flex items-center justify-between"><label class="label !text-[11.5px]">دار النشر</label><button type="button" class="text-[11px] font-bold text-brand-700 hover:underline" data-act="catalogMgr" data-id="publishers">+ جديد</button></div>
          <select class="input !h-10 !text-xs font-semibold" data-change="qbField" data-k="publisher">
            ${pubs.map(pub => `<option value="${esc(pub)}" ${qf.publisher === pub ? "selected" : ""}>${esc(pub)}</option>`).join("")}
          </select>
        </div>
        <div>
          <div class="flex items-center justify-between"><label class="label !text-[11.5px]">المادة الدراسية</label><button type="button" class="text-[11px] font-bold text-brand-700 hover:underline" data-act="catalogMgr" data-id="subjects">+ جديد</button></div>
          <select class="input !h-10 !text-xs font-semibold" data-change="qbField" data-k="subject">
            ${subs.map(sub => `<option value="${esc(sub)}" ${qf.subject === sub ? "selected" : ""}>${esc(sub)}</option>`).join("")}
          </select>
        </div>
        <div>
          <div class="flex items-center justify-between"><label class="label !text-[11.5px]">جزء الكتاب</label><button type="button" class="text-[11px] font-bold text-brand-700 hover:underline" data-act="catalogMgr" data-id="parts">+ جديد</button></div>
          <select class="input !h-10 !text-xs" data-change="qbField" data-k="bookPart">
            <option value="" ${!qf.bookPart ? "selected" : ""}>كتاب كامل (بلا جزء)</option>
            ${parts.map(pt => `<option value="${esc(pt)}" ${qf.bookPart === pt ? "selected" : ""}>${esc(pt)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="label !text-[11.5px]">نوع المدرسة</label>
          <select class="input !h-10 !text-xs" data-change="qbField" data-k="schoolTypes">
            ${typeCombos(c.schoolTypes || []).map(op => `<option value="${esc(op[0])}" ${qf.schoolTypes === op[0] ? "selected" : ""}>${esc(op[1])}</option>`).join("")}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          <div>
            <label class="label !text-[11.5px]">سعر الغلاف</label>
            <input type="number" step="any" inputmode="decimal" class="input !h-10 !text-xs num font-bold" placeholder="جاري التسعير" value="${esc(qf.coverPrice)}" data-input="qbPrice" data-k="coverPrice">
          </div>
          <div>
            <label class="label !text-[11.5px]">خصم المورد %</label>
            <input type="number" step="any" inputmode="decimal" class="input !h-10 !text-xs num font-bold" placeholder="%" value="${esc(qf.supplierDiscountPct)}" data-input="qbPrice" data-k="supplierDiscountPct">
          </div>
        </div>
        <div>
          <button type="button" class="btn btn-primary !h-10 w-full text-xs font-bold shadow-sm" data-act="qbSubmit">${ic("plus")} ${qf.mode === "series" ? "إضافة السلسلة" : "إضافة الكتاب"}</button>
        </div>
      </div>

      <div id="qbLiveBar" class="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex flex-wrap items-center gap-2 text-slate-600">
          <span>الاسم التلقائي: <b class="text-slate-900">${esc(autoName || "—")}</b></span>
          <span class="text-slate-300">|</span>
          <span>الكود: <b class="num text-brand-800">${esc(nextCode)}</b></span>
        </div>
        <div class="flex flex-wrap items-center gap-3 num">
          <span>صافي التكلفة: <b class="text-slate-800">${qf.coverPrice ? fmt(p.cost) + " ج.م" : "—"}</b></span>
          <span>سعر الموظف: <b class="text-brand-800">${qf.coverPrice ? fmt(p.emp) + " ج.م" : "جاري التسعير"}</b></span>
          <span>الهامش: <b class="${p.margin < 0 ? "text-rose-600" : "text-emerald-700"}">${qf.coverPrice ? fmt(p.margin) + " ج.م" : "—"}</b></span>
        </div>
      </div>
    </div>`;
}

/** فلاتر الكتالوج الاحترافية: تصفية ذكية متتالية وقوائم منسدلة متعددة الاختيار (Multi-Select) */
function bookFilters() {
  const d = A(), c = d.catalog || {}, f = Q.bookF || {};
  validateBookFilters();

  const stages = ["رياض الأطفال", "المرحلة الابتدائية", "المرحلة الإعدادية", "المرحلة الثانوية"];

  // 1. نطاق المراحل: الكتب المتطابقة مع بقية الفلاتر (مثل الناشر أو المادة أو البحث)
  const scopeStage = getBookFilterScope("stage");
  const actStages = getFilterArr(f, "stage");
  const stageChips = stages.map(st => {
    const cnt = scopeStage.filter(b => b.Stage === st).length;
    const isAct = actStages.includes(st);
    if (cnt === 0 && !isAct && (getFilterArr(f, "pub").length || getFilterArr(f, "sub").length || getFilterArr(f, "grade").length || Q.books)) return "";
    return `<button type="button" class="qchip ${isAct ? "active" : ""}" data-act="bkStageF" data-id="${esc(st)}">${esc(st.replace("المرحلة ", ""))} <span class="num opacity-75">(${cnt})</span></button>`;
  }).filter(Boolean).join("");

  // 2. نطاق الصفوف: حسب الناشر والمادة والمرحلة...
  const scopeGrade = getBookFilterScope("grade");
  const gradeCounts = {};
  scopeGrade.forEach(b => { if (b.Grade) gradeCounts[b.Grade] = (gradeCounts[b.Grade] || 0) + 1; });
  const catGrades = c.grades || [];
  const availGrades = Object.keys(gradeCounts).sort((a, b) => {
    const ia = catGrades.findIndex(g => g.label === a || g.name === a);
    const ib = catGrades.findIndex(g => g.label === b || g.name === b);
    const ra = ia >= 0 ? ia : 999, rb = ib >= 0 ? ib : 999;
    return ra !== rb ? ra - rb : a.localeCompare(b, "ar");
  });

  // 3. نطاق دور النشر: مرتبة حسب الشهرة ثم أبجدياً
  const scopePub = getBookFilterScope("pub");
  const pubCounts = {};
  scopePub.forEach(b => { if (b.Publisher) pubCounts[b.Publisher] = (pubCounts[b.Publisher] || 0) + 1; });
  const availPubs = Object.keys(pubCounts).sort((a, b) => {
    const ra = publisherPopularityRank(a), rb = publisherPopularityRank(b);
    return ra !== rb ? ra - rb : a.localeCompare(b, "ar");
  });

  // 4. نطاق المواد: مرتبة حسب الشهرة ثم أبجدياً
  const scopeSub = getBookFilterScope("sub");
  const subCounts = {};
  scopeSub.forEach(b => { if (b.Subject) subCounts[b.Subject] = (subCounts[b.Subject] || 0) + 1; });
  const availSubs = Object.keys(subCounts).sort((a, b) => {
    const ra = subjectPopularityRank(a), rb = subjectPopularityRank(b);
    return ra !== rb ? ra - rb : a.localeCompare(b, "ar");
  });

  // 5. نطاق المدارس
  const scopeType = getBookFilterScope("type");
  const typeCounts = {};
  scopeType.forEach(b => {
    String(b.School_Types || "").split(/[,،]/).map(s => s.trim()).filter(Boolean).forEach(t => {
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
  });
  const availTypes = Object.keys(typeCounts).sort((a, b) => a.localeCompare(b, "ar"));

  // 6. نطاق الحالات
  const scopeSt = getBookFilterScope("st");
  const stLabels = [
    ["Pricing", "جاري التسعير"],
    ["Available", "متاح"],
    ["Not_Yet_Printed", "لم يُطبع بعد"],
    ["Suspended", "موقوف"],
    ["Discontinued", "ملغى"]
  ];
  const actSts = getFilterArr(f, "st");
  const availSt = stLabels.map(([stKey, stLbl]) => {
    const cnt = scopeSt.filter(b => b.Book_Status === stKey).length;
    return { key: stKey, label: stLbl, count: cnt };
  }).filter(item => item.count > 0 || actSts.includes(item.key));

  const msDropdown = (k, title, defaultLabel, items) => {
    const activeVals = getFilterArr(f, k);
    const isOpen = BK_UI.openDropdown === k;
    const qSearch = (BK_UI.msSearch[k] || "").toLowerCase().trim();
    const filtered = qSearch ? items.filter(it => it.label.toLowerCase().includes(qSearch) || it.value.toLowerCase().includes(qSearch)) : items;
    const count = activeVals.length;

    let triggerText = `${defaultLabel} (${items.length})`;
    const isAct = count > 0;
    if (count === 1) {
      const match = items.find(it => it.value === activeVals[0]);
      triggerText = match ? match.label : activeVals[0];
    } else if (count === 2) {
      const m1 = items.find(it => it.value === activeVals[0]), m2 = items.find(it => it.value === activeVals[1]);
      const l1 = m1 ? m1.label : activeVals[0], l2 = m2 ? m2.label : activeVals[1];
      triggerText = `${l1}، ${l2}`;
      if (triggerText.length > 20) triggerText = `${l1} (+1)`;
    } else if (count > 2) {
      const m1 = items.find(it => it.value === activeVals[0]);
      const l1 = m1 ? m1.label : activeVals[0];
      triggerText = `${l1} (+${count - 1})`;
    }

    return `
      <div class="relative inline-block" data-ms-root="${k}">
        <select class="sr-only" data-k="${k}" data-change="bookF" multiple tabindex="-1">
          <option value="">${defaultLabel}</option>
          ${items.map(it => `<option value="${esc(it.value)}" ${activeVals.includes(it.value) ? "selected" : ""}>${esc(it.label)}</option>`).join("")}
        </select>

        <button type="button" class="btn btn-xs !h-9 !px-2.5 flex items-center gap-1.5 rounded-xl border text-xs font-semibold transition ${isAct ? "!border-brand-500 bg-brand-50/90 text-brand-900 ring-1 ring-brand-300 shadow-xs" : "border-slate-200 bg-slate-50/80 hover:bg-white text-slate-700"}" data-act="bkMsTrigger" data-id="${k}">
          <span class="max-w-[160px] truncate" title="${esc(triggerText)}">${esc(triggerText)}</span>
          ${count > 1 ? `<span class="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] flex items-center justify-center font-bold num">${count}</span>` : ""}
          ${isAct ? `<span class="text-brand-400 hover:text-rose-600 p-0.5" data-act="bkMsClear" data-id="${k}" title="إلغاء التحديد">${ic("x", "!w-3 !h-3")}</span>` : ""}
          <span class="text-slate-400 shrink-0 ${isOpen ? "rotate-180" : ""} transition-transform duration-150">${ic("chevron-down", "!w-3.5 !h-3.5")}</span>
        </button>

        ${isOpen ? `
          <div class="absolute right-0 top-full mt-1.5 z-50 min-w-[230px] max-w-[300px] w-max bg-white rounded-2xl shadow-lift ring-1 ring-slate-200 p-2.5 space-y-2 text-right animate-in fade-in zoom-in-95 duration-100" data-ms-menu="${k}">
            <div class="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-100 text-slate-700">
              <span class="font-bold text-xs">${esc(title)} <span class="text-[11px] text-slate-400 font-normal">(${items.length})</span></span>
              <div class="flex items-center gap-1.5 text-[11px]">
                <button type="button" class="text-brand-700 font-bold hover:underline" data-act="bkMsAll" data-id="${k}">الكل</button>
                <span class="text-slate-200">|</span>
                <button type="button" class="text-rose-600 font-bold hover:underline" data-act="bkMsNone" data-id="${k}">مسح</button>
              </div>
            </div>
            ${items.length > 5 ? `
              <div class="relative">
                <input type="text" class="input !h-8 !text-xs !pr-7 !pl-2 w-full" placeholder="ابحث في الخيارات…" value="${esc(BK_UI.msSearch[k] || "")}" data-input="bkMsSearch" data-id="${k}">
                <span class="absolute right-2 top-2 text-slate-400 pointer-events-none">${ic("search", "!w-3.5 !h-3.5")}</span>
              </div>` : ""}
            <div class="max-h-56 overflow-y-auto space-y-0.5 p-0.5">
              ${filtered.map(it => {
                const checked = activeVals.includes(it.value);
                return `
                  <button type="button" class="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-right text-xs transition cursor-pointer ${checked ? "bg-brand-50/70 font-bold text-brand-900 ring-1 ring-brand-200" : "text-slate-700"}" data-act="bkMsToggle" data-id="${k}|${esc(it.value)}">
                    <div class="flex items-center gap-2 min-w-0 pointer-events-none">
                      <span class="w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-brand-600 border-brand-600 text-white" : "border-slate-300 bg-white"}">
                        ${checked ? ic("check", "!w-3 !h-3") : ""}
                      </span>
                      <span class="truncate ${checked ? "font-bold text-brand-900" : "text-slate-700"}">${esc(it.label)}</span>
                    </div>
                    <span class="text-[11px] num shrink-0 pointer-events-none ${checked ? "text-brand-700 font-bold" : "text-slate-400 font-normal"}">(${fmt(it.count)})</span>
                  </button>`;
              }).join("")}
              ${!filtered.length ? `<div class="py-3 text-center text-xs text-slate-400">لا توجد خيارات مطابقة</div>` : ""}
            </div>
          </div>` : ""}
      </div>`;
  };

  const hasFilters = !!(actStages.length || getFilterArr(f, "grade").length || getFilterArr(f, "pub").length || getFilterArr(f, "sub").length || getFilterArr(f, "type").length || getFilterArr(f, "st").length || Q.books);
  const matchCount = filteredBooksList().length;

  return `
    <div class="w-full space-y-2.5">
      <div class="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
        <div class="flex flex-wrap items-center gap-1.5">
          <button type="button" class="qchip ${!actStages.length ? "active" : ""}" data-act="bkStageF" data-id="">كل المراحل <span class="num opacity-75">(${scopeStage.length})</span></button>
          ${stageChips}
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          ${can("SAVE_BOOK") ? `<button type="button" class="btn ${BK_UI.quickOpen ? "btn-primary" : "btn-soft"} btn-xs" data-act="toggleQuickEntry">${ic("plus")} لوحة الإدخال السريع</button>` : ""}
          ${can("SAVE_BOOK") ? `<button type="button" class="btn ${BK_UI.inlineMode ? "btn-gold" : "btn-outline"} btn-xs" data-act="toggleInlineBooks">${ic("pencil")} ${BK_UI.inlineMode ? "إغلاق التعديل بالجدول" : "تعديل الأسعار بالجدول"}</button>` : ""}
          <button type="button" class="btn btn-ghost btn-xs" data-act="exportBooks">${ic("download")} تصدير Excel</button>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        ${searchBox("qBooks", Q.books, "بحث بالاسم أو الكود أو الناشر أو المادة…")}
        ${msDropdown("grade", "الصف الدراسي", actStages.length ? `صفوف محددة (${availGrades.length})` : `كل الصفوف (${availGrades.length})`, availGrades.map(g => ({ value: g, label: g, count: gradeCounts[g] || 0 })))}
        ${msDropdown("pub", "دار النشر", `كل دور النشر (${availPubs.length})`, availPubs.map(p => ({ value: p, label: p, count: pubCounts[p] || 0 })))}
        ${msDropdown("sub", "المادة الدراسية", `كل المواد (${availSubs.length})`, availSubs.map(s => ({ value: s, label: s, count: subCounts[s] || 0 })))}
        ${msDropdown("type", "نوع المدرسة", `كل المدارس (${availTypes.length})`, availTypes.map(t => ({ value: t, label: t, count: typeCounts[t] || 0 })))}
        ${msDropdown("st", "حالة الكتاب", `كل الحالات (${availSt.length})`, availSt.map(item => ({ value: item.key, label: item.label, count: item.count })))}
        ${hasFilters ? `<button type="button" class="btn btn-ghost btn-xs text-rose-600 font-semibold" data-act="bkClearF">${ic("x")} مسح الفلاتر (${fmt(matchCount)})</button>` : `<span class="text-[11.5px] text-slate-400 font-semibold mr-1 num">مطابق: ${fmt(matchCount)}</span>`}
      </div>
    </div>`;
}

Router.add("/a/books", view => {
  const d = A(), loss = d.books.filter(x => x.Book_Status !== "Pricing" && n(x.Emp_Selling_Price) < n(x.Standard_Net_Cost)).length;
  const pricingCnt = d.books.filter(x => x.Book_Status === "Pricing").length;
  const availCnt = d.books.filter(x => x.Book_Status === "Available" || x.Book_Status === "Not_Yet_Printed").length;
  const rcMap = resCount();
  const totalReqCopies = Object.values(rcMap).reduce((s, c) => s + c.q, 0);
  const pubsCnt = new Set(d.books.map(b => b.Publisher).filter(Boolean)).size;
  const subsCnt = new Set(d.books.map(b => b.Subject).filter(Boolean)).size;

  view.innerHTML = UI.pageHead("الكتب والأسعار", `${d.books.length} كتاب مسجل · سعر الموظف = الغلاف − ${fmt(d.settingsMap.UNIFIED_EMP_DISCOUNT_PCT)}%`,
    lockedBtn("BULK_PRICE_BOOKS", `<button class="btn btn-gold btn-sm" data-act="bulkPrice">${ic("badge-percent")} تسعير جماعي</button>`) + lockedBtn("SAVE_BOOK", `<button class="btn btn-outline btn-sm" data-act="catalogMgr">${ic("sliders-horizontal")} قوائم الكتالوج</button>`) + lockedBtn("SAVE_BOOK", `<button class="btn btn-outline btn-sm" data-act="pubLogos">${ic("store")} شعارات الناشرين</button>`) + lockedBtn("SAVE_BOOK", `<button class="btn btn-outline btn-sm" data-act="coversBulk">${ic("upload")} رفع أغلفة${(() => { const m = d.books.filter(x => !x.Cover_URL).length; return m ? ` <span class="text-[11px] text-slate-400 num">(${m} بلا صورة)</span>` : ""; })()}</button>`) + lockedBtn("BULK_IMPORT_BOOKS", `<button class="btn btn-outline btn-sm" data-act="importBooks">${ic("file-spreadsheet")} استيراد من Excel</button>`) + lockedBtn("SAVE_BOOK", `<button class="btn btn-primary btn-sm" data-act="bookForm">${ic("plus")} كتاب / سلسلة جديدة</button>`))
    + `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        ${UI.kpi("إجمالي الكتب المسجلة", fmt(d.books.length), { icon: "library-big", tone: "brand", foot: `${fmt(pubsCnt)} دار نشر · ${fmt(subsCnt)} مادة دراسية` })}
        ${UI.kpi("متاح للحجز الآن", fmt(availCnt), { icon: "circle-check", tone: "green", foot: pricingCnt ? `${fmt(pricingCnt)} كتاب جاري تسعيره` : "جميع الكتب مسعّرة وجاهزة" })}
        ${UI.kpi("النسخ المحجوزة بالمرحلة", fmt(totalReqCopies), { icon: "shopping-cart", tone: "blue", foot: `في ${esc(phaseObj().Phase_Name || "المرحلة المختارة")}` })}
        ${UI.kpi("الخصم الموحد للموظف", fmt(d.settingsMap.UNIFIED_EMP_DISCOUNT_PCT) + "%", { icon: "badge-percent", tone: loss ? "red" : "amber", foot: loss ? `تنبيه: ${loss} كتاب أقل من التكلفة` : `عقد المكتبة الرئيسية: ${esc((d.suppliers[0] || {}).Supplier_Name || "—")}` })}
      </div>`
    + (loss ? `<div class="rounded-2xl bg-rose-50 ring-1 ring-rose-200 text-rose-800 p-3.5 mb-4 text-sm flex items-center gap-2">${ic("triangle-alert", "text-rose-600")}<span class="font-semibold">${loss} كتاب سعر الموظف فيه أقل من التكلفة الصافية — يمكنك تعديلها مباشرة من الجدول أدناه.</span></div>` : "")
    + `<div id="quickEntryWrap">${quickBookEntryBarHTML()}</div>`
    + `<section class="card card-pad"><div id="bookFiltersWrap" class="mb-3.5">${bookFilters()}</div><div id="booksList">${booksTable()}</div></section>`;
});
on("qBooks", v => {
  Q.books = v.trim();
  validateBookFilters();
  const fw = $("#bookFiltersWrap");
  if (fw) {
    const activeEl = document.activeElement;
    const isSearchActive = activeEl && activeEl.dataset && activeEl.dataset.input === "qBooks";
    const start = isSearchActive ? activeEl.selectionStart : null;
    const end = isSearchActive ? activeEl.selectionEnd : null;
    fw.innerHTML = bookFilters();
    if (isSearchActive) {
      const inp = fw.querySelector('[data-input="qBooks"]');
      if (inp) {
        inp.focus();
        try { inp.setSelectionRange(start, end); } catch (_) {}
      }
    }
  }
  rerenderList("booksList", booksTable);
});
on("bookF", (v, el) => {
  const k = el.dataset.k;
  const selectedVals = Array.from(el.selectedOptions || []).map(o => o.value).filter(Boolean);
  Q.bookF = Object.assign({}, Q.bookF, { [k]: selectedVals.length ? selectedVals : (v ? [v] : []) });
  validateBookFilters();
  const fw = $("#bookFiltersWrap");
  if (fw) fw.innerHTML = bookFilters();
  rerenderList("booksList", booksTable);
});
on("bkStageF", stg => {
  if (!stg) {
    Q.bookF = Object.assign({}, Q.bookF, { stage: [], grade: [] });
  } else {
    const curStages = getFilterArr(Q.bookF, "stage");
    const idx = curStages.indexOf(stg);
    if (idx >= 0) curStages.splice(idx, 1);
    else curStages.push(stg);
    Q.bookF = Object.assign({}, Q.bookF, { stage: curStages, grade: [] });
  }
  validateBookFilters();
  const fw = $("#bookFiltersWrap");
  if (fw) fw.innerHTML = bookFilters();
  rerenderList("booksList", booksTable);
});
on("bkClearF", () => {
  Q.books = "";
  Q.bookF = {};
  BK_UI.openDropdown = null;
  BK_UI.msSearch = {};
  const fw = $("#bookFiltersWrap");
  if (fw) fw.innerHTML = bookFilters();
  rerenderList("booksList", booksTable);
});
on("bkMsTrigger", k => {
  BK_UI.openDropdown = BK_UI.openDropdown === k ? null : k;
  const fw = $("#bookFiltersWrap");
  if (fw) {
    fw.innerHTML = bookFilters();
    if (BK_UI.openDropdown) {
      const sInp = fw.querySelector(`[data-input="bkMsSearch"]`);
      if (sInp) sInp.focus();
    }
  }
});
on("bkMsToggle", idStr => {
  const [k, ...rest] = idStr.split("|");
  const val = rest.join("|");
  const cur = getFilterArr(Q.bookF, k);
  const idx = cur.indexOf(val);
  if (idx >= 0) cur.splice(idx, 1);
  else cur.push(val);
  Q.bookF = Object.assign({}, Q.bookF, { [k]: cur });
  validateBookFilters();
  BK_UI.openDropdown = k;
  const fw = $("#bookFiltersWrap");
  if (fw) {
    fw.innerHTML = bookFilters();
    const sInp = fw.querySelector(`[data-input="bkMsSearch"]`);
    if (sInp && BK_UI.msSearch[k]) {
      sInp.focus();
      sInp.value = BK_UI.msSearch[k];
    }
  }
  rerenderList("booksList", booksTable);
});
on("bkMsAll", k => {
  const scope = getBookFilterScope(k);
  let allVals = [];
  if (k === "pub") allVals = [...new Set(scope.map(b => b.Publisher).filter(Boolean))];
  else if (k === "sub") allVals = [...new Set(scope.map(b => b.Subject).filter(Boolean))];
  else if (k === "grade") allVals = [...new Set(scope.map(b => b.Grade).filter(Boolean))];
  else if (k === "type") {
    const set = new Set();
    scope.forEach(b => String(b.School_Types || "").split(/[,،]/).map(s => s.trim()).filter(Boolean).forEach(t => set.add(t)));
    allVals = [...set];
  } else if (k === "st") allVals = [...new Set(scope.map(b => b.Book_Status).filter(Boolean))];

  const qSearch = (BK_UI.msSearch[k] || "").toLowerCase().trim();
  if (qSearch) {
    allVals = allVals.filter(v => v.toLowerCase().includes(qSearch));
    const cur = getFilterArr(Q.bookF, k);
    allVals = [...new Set(cur.concat(allVals))];
  }
  Q.bookF = Object.assign({}, Q.bookF, { [k]: allVals });
  validateBookFilters();
  BK_UI.openDropdown = k;
  const fw = $("#bookFiltersWrap");
  if (fw) fw.innerHTML = bookFilters();
  rerenderList("booksList", booksTable);
});
on("bkMsNone", k => {
  Q.bookF = Object.assign({}, Q.bookF, { [k]: [] });
  validateBookFilters();
  BK_UI.openDropdown = k;
  const fw = $("#bookFiltersWrap");
  if (fw) fw.innerHTML = bookFilters();
  rerenderList("booksList", booksTable);
});
on("bkMsClear", (k, el, e) => {
  if (e) { try { e.stopPropagation(); } catch (_) {} }
  Q.bookF = Object.assign({}, Q.bookF, { [k]: [] });
  validateBookFilters();
  BK_UI.openDropdown = null;
  const fw = $("#bookFiltersWrap");
  if (fw) fw.innerHTML = bookFilters();
  rerenderList("booksList", booksTable);
});
on("bkMsSearch", (v, el) => {
  const k = el.dataset.id;
  BK_UI.msSearch[k] = v;
  BK_UI.openDropdown = k;
  const fw = $("#bookFiltersWrap");
  if (fw) {
    fw.innerHTML = bookFilters();
    const sInp = fw.querySelector(`[data-input="bkMsSearch"]`);
    if (sInp) {
      sInp.focus();
      sInp.value = v;
    }
  }
});

if (typeof document !== "undefined") {
  document.addEventListener("click", e => {
    if (!BK_UI.openDropdown) return;
    if (!e.target.closest("[data-ms-root]")) {
      BK_UI.openDropdown = null;
      const fw = $("#bookFiltersWrap");
      if (fw) fw.innerHTML = bookFilters();
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && BK_UI.openDropdown) {
      BK_UI.openDropdown = null;
      const fw = $("#bookFiltersWrap");
      if (fw) fw.innerHTML = bookFilters();
    }
  });
}
on("toggleQuickEntry", () => { BK_UI.quickOpen = !BK_UI.quickOpen; const qw = $("#quickEntryWrap"); if (qw) qw.innerHTML = quickBookEntryBarHTML(); const fw = $("#bookFiltersWrap"); if (fw) fw.innerHTML = bookFilters(); });
on("qbMode", m => { BK_UI.qForm.mode = m; const qw = $("#quickEntryWrap"); if (qw) qw.innerHTML = quickBookEntryBarHTML(); });
on("qbSeries", stg => { BK_UI.qForm.mode = "series"; BK_UI.qForm.stage = stg; const qw = $("#quickEntryWrap"); if (qw) qw.innerHTML = quickBookEntryBarHTML(); });
on("qbField", (v, el) => { BK_UI.qForm[el.dataset.k] = v; const qw = $("#quickEntryWrap"); if (qw) qw.innerHTML = quickBookEntryBarHTML(); });
on("qbPrice", (v, el) => {
  BK_UI.qForm[el.dataset.k] = v;
  const bar = $("#qbLiveBar");
  if (bar) {
    const qf = BK_UI.qForm, p = bookPrice(qf);
    const autoName = previewBookName(qf.publisher, qf.subject, qf.bookPart, qf.schoolTypes);
    const grades = (A().catalog || {}).grades || [];
    const gObj = grades.find(g => g.label === qf.grade);
    const nextCode = qf.mode === "series" && qf.stage ? grades.filter(g => g.stage === qf.stage).map(g => g.code).join("، ") : (gObj ? nextCodePreview(gObj.code, A().books) : "تلقائي");
    bar.innerHTML = `<div class="flex flex-wrap items-center gap-2 text-slate-600"><span>الاسم التلقائي: <b class="text-slate-900">${esc(autoName || "—")}</b></span><span class="text-slate-300">|</span><span>الكود: <b class="num text-brand-800">${esc(nextCode)}</b></span></div>
      <div class="flex flex-wrap items-center gap-3 num"><span>صافي التكلفة: <b class="text-slate-800">${qf.coverPrice ? fmt(p.cost) + " ج.م" : "—"}</b></span><span>سعر الموظف: <b class="text-brand-800">${qf.coverPrice ? fmt(p.emp) + " ج.م" : "جاري التسعير"}</b></span><span>الهامش: <b class="${p.margin < 0 ? "text-rose-600" : "text-emerald-700"}">${qf.coverPrice ? fmt(p.margin) + " ج.م" : "—"}</b></span></div>`;
  }
});
on("qbSubmit", async () => {
  const qf = BK_UI.qForm, grades = ((A().catalog || {}).grades || []);
  const targetGrades = qf.mode === "series" ? grades.filter(g => g.stage === (qf.stage || "المرحلة الابتدائية")).map(g => g.label) : [qf.grade];
  if (!targetGrades.length) return toast("اختر الصف الدراسي أو المرحلة أولاً", "warning");
  if (!qf.publisher || !qf.subject) return toast("اختر دار النشر والمادة الدراسية", "warning");
  const payload = {
    grade: targetGrades[0], grades: targetGrades, schoolTypes: qf.schoolTypes || "حكومي",
    publisher: qf.publisher, subject: qf.subject, bookPart: qf.bookPart || "",
    supplierId: (A().suppliers[0] || {}).Supplier_ID || "", bookStatus: "Available",
    coverPrice: qf.coverPrice, supplierDiscountPct: qf.supplierDiscountPct, volumeDiscountSharePct: 0
  };
  const r = await call("SAVE_BOOK", payload, { block: true });
  if (r && r.success && targetGrades.length > 1 && !Array.isArray(r.books)) {
    for (const gl of targetGrades.slice(1)) await call("SAVE_BOOK", Object.assign({}, payload, { grade: gl, grades: [gl] }), { block: true });
  }
  toast((r && r.message) || (r && r.success ? "تمت الإضافة بنجاح" : "تعذر الحفظ"), r && r.success ? "success" : "danger");
  if (r && r.success) { await Admin.load(); Shell.rerender(); }
});

// أحداث التعديل المباشر داخل جدول الكتب والأسعار
on("toggleInlineBooks", () => {
  BK_UI.inlineMode = !BK_UI.inlineMode;
  if (!BK_UI.inlineMode) BK_UI.editingRow = null;
  const fw = $("#bookFiltersWrap"); if (fw) fw.innerHTML = bookFilters();
  rerenderList("booksList", booksTable);
});
on("bkQuickRow", id => {
  BK_UI.editingRow = BK_UI.editingRow === id ? null : id;
  rerenderList("booksList", booksTable);
  const inp = $(`[data-bk-inline="${id}"][data-f="coverPrice"]`);
  if (inp) setTimeout(() => { inp.focus(); if (inp.select) inp.select(); }, 20);
});
on("bkDiscardInline", () => {
  BK_UI.dirty = {};
  BK_UI.editingRow = null;
  rerenderList("booksList", booksTable);
});
async function saveInlineBookRow(bookId, silent) {
  const b = A().books.find(x => x.Book_ID === bookId);
  if (!b) return { success: false };
  const dr = rowDraftOf(b);
  const r = await call("SAVE_BOOK", {
    bookId: b.Book_ID, grade: b.Grade, grades: [b.Grade], schoolTypes: b.School_Types || "حكومي",
    publisher: b.Publisher, subject: b.Subject, bookPart: b.Book_Part || "",
    supplierId: b.Supplier_ID || (A().suppliers[0] || {}).Supplier_ID || "",
    bookStatus: dr.bookStatus === "Pricing" ? "Available" : (dr.bookStatus || "Available"),
    coverPrice: dr.coverPrice, supplierDiscountPct: dr.supplierDiscountPct,
    volumeDiscountSharePct: 0, empDiscountPct: dr.empDiscountPct
  }, { block: !silent });
  if (r && r.success) delete BK_UI.dirty[bookId];
  return r;
}
on("bkSaveRow", async id => {
  const r = await saveInlineBookRow(id, false);
  toast((r && r.message) || (r && r.success ? "تم حفظ تعديل الكتاب" : "تعذر الحفظ"), r && r.success ? "success" : "danger");
  if (r && r.success) { BK_UI.editingRow = null; await Admin.load(); rerenderList("booksList", booksTable); }
});
on("bkSaveAllInline", async () => {
  const ids = Object.keys(BK_UI.dirty);
  if (!ids.length) return;
  busy(true, true);
  let okCnt = 0, lastErr = "";
  try {
    for (const id of ids) {
      const r = await saveInlineBookRow(id, true);
      if (r && r.success) okCnt++; else if (r && r.message) lastErr = r.message;
    }
  } finally { busy(false, false); }
  BK_UI.editingRow = null;
  await Admin.load();
  Shell.rerender();
  toast(okCnt ? `تم حفظ تعديلات ${okCnt} كتاب بنجاح` + (lastErr ? ` · ${lastErr}` : "") : (lastErr || "تعذر الحفظ"), okCnt ? "success" : "danger");
});
document.addEventListener("input", e => {
  const el = e.target.closest && e.target.closest("[data-bk-inline]");
  if (!el) return;
  const id = el.dataset.bkInline, f = el.dataset.f;
  const b = A().books.find(x => x.Book_ID === id);
  if (!b) return;
  BK_UI.dirty[id] = Object.assign(rowDraftOf(b), { [f]: el.value });
  const dr = BK_UI.dirty[id];
  if (f === "coverPrice" && n(el.value) > 0 && dr.bookStatus === "Pricing") dr.bookStatus = "Available";
  const p = bookPrice(dr);
  const cEl = $(`[data-bk-cost="${id}"]`), eEl = $(`[data-bk-emp="${id}"]`), mEl = $(`[data-bk-margin="${id}"]`), tr = $(`tr[data-book-row="${id}"]`);
  if (cEl) cEl.textContent = fmt(p.cost);
  if (eEl) eEl.textContent = fmt(p.emp);
  if (mEl) { mEl.textContent = fmt(p.margin); mEl.className = `inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold ${p.margin < 0 ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200" : "bg-emerald-50 text-emerald-700"}`; }
  if (tr) tr.classList.add("row-dirty");
});
document.addEventListener("keydown", e => {
  const el = e.target.closest && e.target.closest("[data-bk-inline]");
  if (!el) return;
  if (e.key === "Enter") { e.preventDefault(); ACTIONS.bkSaveRow(el.dataset.bkInline); }
  else if (e.key === "Escape") { e.preventDefault(); delete BK_UI.dirty[el.dataset.bkInline]; BK_UI.editingRow = null; rerenderList("booksList", booksTable); }
});
// ---------------- صور أغلفة الكتب ----------------
const coverThumb = x => `<button class="w-9 h-12 rounded-md shrink-0 overflow-hidden ring-1 ring-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 hover:ring-brand-400" data-act="${can("SAVE_BOOK") ? "coverPick" : "coverView"}" data-id="${esc(x.Book_ID)}" title="صورة الغلاف">${x.Cover_URL ? `<img src="${esc(x.Cover_URL)}" alt="" loading="lazy" class="w-full h-full object-cover">` : logoFor(A().pubLogos, x.Publisher, x.Subject) ? `<img src="${esc(logoFor(A().pubLogos, x.Publisher, x.Subject))}" alt="" loading="lazy" class="w-full h-full object-contain p-0.5 bg-white opacity-70">` : ic("plus")}</button>`;
/** يختار ملف(ات) صور من الجهاز */
const pickFiles = multiple => new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; if (multiple) i.multiple = true; i.onchange = () => res([...(i.files || [])]); i.click(); });
async function uploadCover(bookId, file, publisher) {
  const dataUrl = await imgToWebp(file, publisher ? 400 : 600);
  return call("UPLOAD_BOOK_COVER", publisher ? { publisher, dataUrl } : { bookId, dataUrl });
}
/** شعارات الناشرين: شعار واحد يظهر على كل كتب الناشر التي ليس لها غلاف خاص */
function pubLogosHTML() {
  const d = A(), logos = Object.assign({}, PUB_LOGOS_BUILTIN, d.pubLogos || {}), cnt = {}, lang = {}; d.books.forEach(b => { if (!b.Publisher) return; cnt[b.Publisher] = (cnt[b.Publisher] || 0) + 1; if (LANG_SUBJECTS.includes(b.Subject)) lang[b.Publisher] = (lang[b.Publisher] || 0) + 1; });
  const pubs = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  const row = (key, title, sub) => `<li class="flex items-center gap-3 py-2.5 ${key.endsWith("|lang") ? "pr-6" : ""}">
    <span class="w-14 h-11 rounded-xl ring-1 ring-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">${logos[key] ? `<img src="${esc(logos[key])}" alt="" class="max-w-full max-h-full object-contain">` : `<span class="text-slate-300">${ic("store")}</span>`}</span>
    <span class="flex-1 min-w-0"><b class="block text-slate-800 truncate">${title}</b><span class="text-[12px] text-slate-500">${sub}</span></span>
    <button class="btn btn-${logos[key] ? "ghost" : "soft"} btn-xs" data-act="pubLogoUp" data-id="${esc(key)}">${ic("upload")} ${logos[key] ? "تغيير" : "رفع"}</button>
    ${logos[key] ? `<button class="btn btn-ghost btn-xs text-rose-600" data-act="pubLogoDel" data-id="${esc(key)}" aria-label="حذف">${ic("trash-2")}</button>` : ""}</li>`;
  return `<p class="text-[13px] text-slate-500 mb-3">ارفع شعار كل ناشر مرة واحدة ويظهر على كل كتبه التي ليس لها صورة غلاف خاصة. ولو للناشر شعار مختلف لكتب اللغات (إنجليزي، ماث، ساينس…) ارفعه في السطر الفرعي. <b>${pubs.filter(p => logos[p]).length}</b> من ${pubs.length} لها شعار.</p>
  <ul class="divide-y divide-slate-100">${pubs.map(p => row(p, esc(p), `<span class="num">${cnt[p]}</span> كتاب`) + (lang[p] ? row(p + "|lang", `${ic("graduation-cap", "text-emerald-600")} ${esc(p)} — كتب اللغات`, `<span class="num">${lang[p]}</span> كتاب · ${logos[p + "|lang"] ? "شعار خاص" : "يُستخدم الشعار الأساسي"}`) : "")).join("")}</ul>`;
}
let PL = null;
on("pubLogos", () => { PL = UI.open(pubLogosHTML(), { title: "شعارات الناشرين", wide: true }); });
const plRefresh = async () => { await Admin.load(); if (PL && PL.body && document.body.contains(PL.root)) PL.body.innerHTML = pubLogosHTML(); };
on("pubLogoUp", async pub => {
  const [f] = await pickFiles(false); if (!f) return;
  busy(true, true);
  try { const r = await uploadCover("", f, pub); toast(r.message, r.success ? "success" : "danger"); if (r.success) await plRefresh(); }
  catch (e) { toast("تعذر قراءة الصورة", "danger"); } finally { busy(false, false); }
});
on("pubLogoDel", async pub => {
  if (!await UI.confirm({ title: "حذف الشعار", message: "حذف شعار " + pub.replace("|lang", " (كتب اللغات)") + "؟", ok: "حذف", tone: "danger" })) return;
  const r = await call("UPLOAD_BOOK_COVER", { publisher: pub, dataUrl: "" }, { block: true }); toast(r.message, r.success ? "success" : "danger"); if (r.success) await plRefresh();
});
on("coverView", id => { const b = A().books.find(x => x.Book_ID === id); if (b && b.Cover_URL) UI.open(`<img src="${esc(b.Cover_URL)}" class="w-full rounded-2xl" alt="">`, { title: esc(b.Book_Name) }); });
on("coverPick", async id => {
  const b = A().books.find(x => x.Book_ID === id); if (!b) return;
  if (b.Cover_URL) {
    const m = UI.open(`<img src="${esc(b.Cover_URL)}" class="w-full max-h-[55vh] object-contain rounded-2xl bg-slate-50" alt="">`, { title: "غلاف " + esc(b.Book_Name),
      footer: `<div class="flex gap-2"><button class="btn btn-primary flex-1" data-cv="new">${ic("upload")} تغيير الصورة</button><button class="btn btn-outline text-rose-600" data-cv="del">${ic("trash-2")} حذف</button></div>` });
    const what = await new Promise(r => { m.root.querySelectorAll("[data-cv]").forEach(x => x.onclick = () => r(x.dataset.cv)); });
    m.close();
    if (what === "del") { const r = await call("UPLOAD_BOOK_COVER", { bookId: id, dataUrl: "" }, { block: true }); toast(r.message, r.success ? "success" : "danger"); if (r.success) await Admin.load(); return; }
  }
  const [f] = await pickFiles(false); if (!f) return;
  busy(true, true);
  try { const r = await uploadCover(id, f); toast(r.message, r.success ? "success" : "danger"); if (r.success) await Admin.load(); }
  catch (e) { toast("تعذر قراءة الصورة", "danger"); } finally { busy(false, false); }
});
/** رفع أغلفة كثيرة: يُطابَق كل ملف بكود الكتاب الموجود في اسمه (مثل P4-003.jpg) */
on("coversBulk", async () => {
  const ok = await UI.confirm({ title: "رفع أغلفة دفعة واحدة", icon: "upload", message: "سمِّ كل صورة بكود الكتاب، مثل:\nP4-003.jpg  أو  M1-011.png\n\nثم اختر الصور كلها مرة واحدة، ونطابق كل صورة بكتابها تلقائياً.", ok: "اختيار الصور" });
  if (!ok) return;
  const files = await pickFiles(true); if (!files.length) return;
  const ids = new Set(A().books.map(b => String(b.Book_ID).toUpperCase())), plan = [], miss = [];
  files.forEach(f => { const m = String(f.name).toUpperCase().match(/[A-Z]{1,3}\d?-\d{2,4}/); const id = m && ids.has(m[0]) ? A().books.find(b => String(b.Book_ID).toUpperCase() === m[0]).Book_ID : null; id ? plan.push([id, f]) : miss.push(f.name); });
  if (!plan.length) return toast("لم نجد كود كتاب في أسماء الصور" + (miss.length ? ": " + miss.slice(0, 3).join("، ") : ""), "warning");
  let done = 0, fail = 0; const t = toast(`جاري رفع ${plan.length} صورة…`, "info");
  for (const [id, f] of plan) { try { const r = await uploadCover(id, f); r.success ? done++ : fail++; } catch (_) { fail++; } }
  await Admin.load();
  toast(`تم رفع ${done} غلاف${fail ? ` · تعذر ${fail}` : ""}${miss.length ? ` · ${miss.length} ملف بلا كود معروف` : ""}`, fail ? "warning" : "success");
});
on("exportBooks", () => {
  const list = filteredBooksList();
  exportCSV(list.length === A().books.length ? "الكتالوج" : "الكتالوج_المصفى", ["الكود", "الكتاب", "المرحلة", "الصف", "نوع المدرسة", "الناشر", "المادة", "الجزء", "الحالة", "كود المكتبة", "الغلاف", "خصم المكتبة %", "التكلفة", "سعر الموظف"], list.map(x => [x.Book_ID, x.Book_Name, x.Stage, x.Grade, x.School_Types, x.Publisher, x.Subject, x.Book_Part, ar(x.Book_Status), x.Supplier_ID, x.Cover_Price, x.Supplier_Discount_Pct, x.Standard_Net_Cost, x.Emp_Selling_Price]));
});
/** خيارات نوع المدرسة: كل نوع منفرداً أو مشتركاً (حكومي، حكومي + لغات، ...) */
function typeCombos(types) {
  const out = [];
  for (let m = 1; m < (1 << types.length); m++) { const pick = types.filter((t, i) => m & (1 << i)); out.push([pick.join("،"), pick.length > 1 ? "مشترك: " + pick.join(" + ") : pick[0]]); }
  return out.sort((a, b) => a[0].split("،").length - b[0].split("،").length);
}
/** معاينة الكود التلقائي التالي لصف دراسي */
function nextCodePreview(gradeCode, books) {
  const pre = gradeCode + "-", taken = {};
  let max = 0;
  books.forEach(b => {
    const id = String(b.Book_ID || "").toUpperCase();
    taken[id] = 1;
    if (id.indexOf(pre.toUpperCase()) === 0) max = Math.max(max, parseInt(id.slice(pre.length), 10) || 0);
  });
  let n = max + 1, code;
  do { code = pre + String(n++).padStart(3, "0"); } while (taken[code.toUpperCase()]);
  return code;
}
/** اسم العرض التلقائي للكتاب (مطابق لمنطق الخادم) */
function previewBookName(pub, sub, part, schoolTypes) {
  if (!pub || !sub) return "";
  const types = String(schoolTypes || "").split(/[,،+]/).map(s => s.trim()).filter(Boolean);
  const langOnly = types.length === 1 && types[0] === "لغات" && !LANG_SUBJECTS.includes(sub);
  return pub + " — " + sub + (langOnly ? " لغات" : "") + (part ? " (" + part + ")" : "");
}
/** تنظيف اسم عنصر كتالوج جديد من أي فواصل */
const cleanCatItem = v => String(v || "").replace(/[,،|]/g, " ").replace(/\s+/g, " ").trim();

/** حفظ قائمة كتالوج (ناشرين / مواد / أجزاء / صفوف إضافية) بطريقة متوافقة مع كل نسخ الخادم */
async function persistCatalogList(key, itemsOrJson, opts) {
  opts = opts || {};
  const val = typeof itemsOrJson === "string" ? itemsOrJson : itemsOrJson.join("،");
  if (can("SAVE_SETTING")) {
    const r = await call("SAVE_SETTING", { key, value: val }, { block: opts.block });
    if (r && r.success) return r;
  }
  const p = { catalogUpdate: true };
  if (key === "BOOK_PUBLISHERS") p.publishers = itemsOrJson;
  else if (key === "BOOK_SUBJECTS") p.subjects = itemsOrJson;
  else if (key === "BOOK_PARTS") p.parts = itemsOrJson;
  else if (key === "BOOK_GRADES") p.customGrades = typeof itemsOrJson === "string" ? JSON.parse(itemsOrJson) : itemsOrJson;
  return call("SAVE_BOOK", p, { block: opts.block });
}

// ---------------- إدارة قوائم الكتالوج التفاعلية (دور النشر · المواد · الأجزاء · الصفوف) بلا فواصل ----------------
const CM = { tab: "publishers", q: "", m: null };
const BASE_GRADES = ["تأسيس", "كي جي 1", "كي جي 2", "1 ابتدائي", "2 ابتدائي", "3 ابتدائي", "4 ابتدائي", "5 ابتدائي", "6 ابتدائي", "1 إعدادي", "2 إعدادي", "3 إعدادي", "1 ثانوي", "2 ثانوي", "3 ثانوي"];
function catalogMgrHTML() {
  const d = A(), c = d.catalog || {}, tab = CM.tab, q = (CM.q || "").toLowerCase();
  const stages = [...new Set(["رياض الأطفال", "المرحلة الابتدائية", "المرحلة الإعدادية", "المرحلة الثانوية"].concat((c.grades || []).map(g => g.stage).filter(Boolean)))];
  const tabs = [
    ["publishers", "store", "دور النشر", (c.publishers || []).length],
    ["subjects", "book-open", "المواد الدراسية", (c.subjects || []).length],
    ["parts", "library", "أجزاء الكتاب", (c.parts || []).length],
    ["grades", "graduation-cap", "الصفوف الدراسية", (c.grades || []).length]
  ];
  const usedCount = (field, val) => d.books.filter(b => b[field] === val && b.Book_Status !== "Discontinued").length;
  let body = "";
  if (tab === "grades") {
    const list = (c.grades || []).filter(g => !q || (g.label + " " + g.stage + " " + g.code).toLowerCase().includes(q));
    body = `
      <div class="rounded-2xl bg-brand-50/70 ring-1 ring-brand-200 p-3.5 mb-4">
        <div class="text-xs font-bold text-brand-900 mb-2">${ic("plus", "text-brand-600")} إضافة صف دراسي جديد إلى القائمة المنسدلة</div>
        <div class="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_0.7fr_auto] gap-2 items-end">
          <div><label class="label !text-[11px]">اسم الصف الدراسي</label><input id="cmNewGradeLabel" class="input !h-10" placeholder="مثال: تمهيدي أو 4 ثانوي"></div>
          <div><label class="label !text-[11px]">المرحلة الدراسية</label><select id="cmNewGradeStage" class="input !h-10">${stages.map(st => `<option value="${esc(st)}" ${st === "المرحلة الابتدائية" ? "selected" : ""}>${esc(st)}</option>`).join("")}</select></div>
          <div><label class="label !text-[11px]">بادئة الكود (اختياري)</label><input id="cmNewGradeCode" class="input !h-10 num" placeholder="تلقائي (P7)"></div>
          <button type="button" class="btn btn-primary !h-10" data-act="cmAddGrade">${ic("plus")} إضافة الصف</button>
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto p-0.5">
        ${list.map(g => {
          const cnt = usedCount("Grade", g.label), isBase = BASE_GRADES.includes(g.label);
          return `<div class="flex items-center justify-between gap-2 rounded-2xl bg-white ring-1 ring-slate-200 px-3.5 py-2.5">
            <div class="min-w-0">
              <div class="font-bold text-slate-900 text-sm flex items-center gap-1.5"><span>${esc(g.label)}</span><span class="pill pill-brand !text-[10.5px] !px-2 num">${esc(g.code)}</span></div>
              <div class="text-[11.5px] text-slate-400">${esc(g.stage)} · <span class="num">${cnt}</span> كتاب</div>
            </div>
            ${!isBase && !cnt ? `<button type="button" class="icon-btn w-8 h-8 text-rose-500 hover:bg-rose-50" data-act="cmDelGrade" data-id="${esc(g.label)}" title="حذف الصف">${ic("trash-2")}</button>` : ""}
          </div>`;
        }).join("")}
      </div>`;
  } else {
    const cfg = {
      publishers: { list: c.publishers || [], field: "Publisher", label: "دار نشر جديدة", ph: "اكتب اسم دار النشر الجديدة (مثل: الأضواء، التفوق…)" },
      subjects: { list: c.subjects || [], field: "Subject", label: "مادة دراسية جديدة", ph: "اكتب اسم المادة الجديدة (مثل: مهارات مهنية…)" },
      parts: { list: c.parts || [], field: "Book_Part", label: "جزء كتاب جديد", ph: "اكتب اسم الجزء الجديد (مثل: مراجعة نهائية، ملحق…)" }
    }[tab];
    const items = cfg.list.filter(x => !q || x.toLowerCase().includes(q));
    body = `
      <div class="rounded-2xl bg-brand-50/70 ring-1 ring-brand-200 p-3 mb-4 flex flex-wrap items-center gap-2">
        <div class="flex-1 min-w-[14rem]"><input id="cmNewItem" class="input !h-10 bg-white" placeholder="${esc(cfg.ph)}"></div>
        <button type="button" class="btn btn-primary !h-10" data-act="cmAddItem">${ic("plus")} إضافة ${esc(cfg.label)}</button>
      </div>
      <div class="flex items-center justify-between gap-2 mb-3">
        ${searchBox("cmQ", CM.q, "ابحث في القائمة الحالية…")}
        <span class="text-xs text-slate-500 font-semibold"><b class="num text-slate-800">${items.length}</b> عنصر</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[48vh] overflow-y-auto p-0.5">
        ${items.map(item => {
          const cnt = usedCount(cfg.field, item);
          const lg = tab === "publishers" ? logoFor(d.pubLogos, item, "") : "";
          return `<div class="flex items-center justify-between gap-2.5 rounded-2xl bg-white ring-1 ring-slate-200 px-3 py-2 hover:ring-brand-300 transition">
            <div class="flex items-center gap-2.5 min-w-0">
              ${tab === "publishers" ? `<span class="w-8 h-8 rounded-lg ring-1 ring-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">${lg ? `<img src="${esc(lg)}" class="w-full h-full object-contain" alt="">` : ic("store", "text-slate-400 text-xs")}</span>` : ""}
              <div class="min-w-0"><div class="font-bold text-slate-800 text-[13.5px] truncate">${esc(item)}</div><div class="text-[11px] text-slate-400"><span class="num">${cnt}</span> كتاب مسجل</div></div>
            </div>
            ${!cnt ? `<button type="button" class="icon-btn w-7 h-7 text-rose-500 hover:bg-rose-50 shrink-0" data-act="cmDelItem" data-id="${esc(item)}" title="حذف من القائمة">${ic("x")}</button>` : `<span class="pill pill-gray !text-[10px]">مستخدم</span>`}
          </div>`;
        }).join("") || `<div class="col-span-3 text-center py-8 text-sm text-slate-400">لا توجد عناصر مطابقة للبحث</div>`}
      </div>`;
  }
  return `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-4 p-1 rounded-2xl bg-slate-100">
      ${tabs.map(t => `<button type="button" data-act="cmTab" data-id="${t[0]}" class="flex items-center justify-center gap-1.5 rounded-xl py-2 px-2.5 text-xs font-bold transition ${tab === t[0] ? "bg-white text-brand-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}">${ic(t[1])}<span>${t[2]}</span><span class="rounded-full px-1.5 py-0.5 text-[10px] num ${tab === t[0] ? "bg-brand-50 text-brand-700" : "bg-slate-200/70 text-slate-600"}">${t[3]}</span></button>`).join("")}
    </div>
    ${body}`;
}
const cmRefresh = () => { if (CM.m && CM.m.body && document.body.contains(CM.m.root)) CM.m.body.innerHTML = catalogMgrHTML(); };
on("catalogMgr", initialTab => {
  CM.tab = ["publishers", "subjects", "parts", "grades"].includes(initialTab) ? initialTab : "publishers";
  CM.q = "";
  CM.m = UI.open(catalogMgrHTML(), { title: "إدارة قوائم الكتالوج", sub: "أضف أو احذف دور النشر والمواد الدراسية وأجزاء الكتب والصفوف مباشرة بدون فواصل", wide: true });
});
on("cmTab", t => { CM.tab = t; CM.q = ""; cmRefresh(); });
on("cmQ", v => { CM.q = v.trim(); cmRefresh(); });
on("cmAddItem", async () => {
  const inp = $("#cmNewItem"); if (!inp) return;
  const val = cleanCatItem(inp.value);
  if (val.length < 2 && CM.tab !== "parts") return toast("أدخل الاسم (حرفان على الأقل)", "warning");
  if (!val) return toast("أدخل الاسم أولاً", "warning");
  const c = A().catalog || {}, keyMap = { publishers: ["BOOK_PUBLISHERS", "publishers"], subjects: ["BOOK_SUBJECTS", "subjects"], parts: ["BOOK_PARTS", "parts"] }[CM.tab];
  if (!keyMap) return;
  const list = (c[keyMap[1]] || []).slice();
  if (list.includes(val)) return toast(`«${val}» موجود بالفعل في القائمة`, "info");
  list.push(val);
  const r = await persistCatalogList(keyMap[0], list, { block: true });
  if (!r || !r.success) return toast((r && r.message) || "تعذر الحفظ", "danger");
  c[keyMap[1]] = list;
  toast(`تمت إضافة «${val}» إلى القائمة`, "success");
  await Admin.load();
  cmRefresh();
});
on("cmDelItem", async val => {
  const c = A().catalog || {}, keyMap = { publishers: ["BOOK_PUBLISHERS", "publishers"], subjects: ["BOOK_SUBJECTS", "subjects"], parts: ["BOOK_PARTS", "parts"] }[CM.tab];
  if (!keyMap) return;
  const list = (c[keyMap[1]] || []).filter(x => x !== val);
  if (!list.length && CM.tab !== "parts") return toast("لا يمكن إفراغ القائمة بالكامل", "warning");
  const r = await persistCatalogList(keyMap[0], list, { block: true });
  if (!r || !r.success) return toast((r && r.message) || "تعذر الحذف", "danger");
  c[keyMap[1]] = list;
  toast(`تم حذف «${val}» من القائمة`, "success");
  await Admin.load();
  cmRefresh();
});
on("cmAddGrade", async () => {
  const lbl = cleanCatItem(($("#cmNewGradeLabel") || {}).value);
  const stg = cleanCatItem(($("#cmNewGradeStage") || {}).value) || "المرحلة الابتدائية";
  let code = String(($("#cmNewGradeCode") || {}).value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (lbl.length < 2) return toast("أدخل اسم الصف الدراسي الجديد", "warning");
  const c = A().catalog || {}, grades = (c.grades || []).slice();
  if (grades.some(g => g.label === lbl)) return toast(`الصف «${lbl}» موجود بالفعل`, "info");
  const used = new Set(grades.map(g => String(g.code).toUpperCase()));
  if (code && used.has(code)) return toast(`بادئة الكود (${code}) مستخدمة لصف آخر`, "warning");
  if (!code) {
    const pre = /أطفال|تمهيد|تأسيس|كي جي/i.test(stg + " " + lbl) ? "KG" : /ابتدائ/i.test(stg + " " + lbl) ? "P" : /إعداد/i.test(stg + " " + lbl) ? "M" : /ثانو/i.test(stg + " " + lbl) ? "S" : "G";
    let gn = 1; while (used.has(pre + gn)) gn++; code = pre + gn;
  }
  grades.push({ code, label: lbl, stage: stg });
  const custom = grades.filter(g => !BASE_GRADES.includes(g.label));
  const r = await persistCatalogList("BOOK_GRADES", custom, { block: true });
  if (!r || !r.success) return toast((r && r.message) || "تعذر حفظ الصف الجديد", "danger");
  c.grades = grades;
  toast(`تمت إضافة الصف «${lbl}» (${code})`, "success");
  await Admin.load();
  cmRefresh();
});
on("cmDelGrade", async lbl => {
  const c = A().catalog || {}, grades = (c.grades || []).filter(g => g.label !== lbl);
  const custom = grades.filter(g => !BASE_GRADES.includes(g.label));
  const r = await persistCatalogList("BOOK_GRADES", custom, { block: true });
  if (!r || !r.success) return toast((r && r.message) || "تعذر حذف الصف", "danger");
  c.grades = grades;
  toast(`تم حذف الصف «${lbl}»`, "success");
  await Admin.load();
  cmRefresh();
});

// ---------------- استوديو إدخال وتعديل الكتب والسلاسل الاحترافي (3 أقسام بحدود خفيفة ومرونة فائقة) ----------------
async function openBookModal(id, cloneFromId) {
  const src = id ? A().books.find(b => b.Book_ID === id) : (cloneFromId ? A().books.find(b => b.Book_ID === cloneFromId) : null);
  const x = id ? (src || {}) : (src ? Object.assign({}, src, { Book_ID: "", Grade: "" }) : {});
  const c = A().catalog || {};
  const grades = (c.grades || []).slice();
  const publishers = (c.publishers || []).slice().sort((a, b) => {
    const ra = publisherPopularityRank(a), rb = publisherPopularityRank(b);
    return ra !== rb ? ra - rb : a.localeCompare(b, "ar");
  });
  const subjects = (c.subjects || []).slice().sort((a, b) => {
    const ra = subjectPopularityRank(a), rb = subjectPopularityRank(b);
    return ra !== rb ? ra - rb : a.localeCompare(b, "ar");
  });
  const parts = (c.parts || []).slice();
  const stages = [...new Set(["رياض الأطفال", "المرحلة الابتدائية", "المرحلة الإعدادية", "المرحلة الثانوية"].concat(grades.map(g => g.stage).filter(Boolean)))];
  const extra = { grades: [], newPublisher: "", newSubject: "", newBookPart: "", newGradeLabel: "", newGradeStage: "المرحلة الابتدائية", newGradeCode: "", addedPubs: [], addedSubs: [], addedParts: [], addedGrades: [] };
  let wired = false;

  // بناء قائمة منسدلة ذكية قابلة للبحث والإضافة الفورية + شريط شرائح سريعة (Quick Chips) للاختيار بضغطة واحدة
  const buildSmartDropdown = (name, label, iconName, currentVal, placeholder, emptyOptionLabel) => {
    const srcList = name === "publisher" ? publishers : name === "subject" ? subjects : parts;
    const opts = [["", emptyOptionLabel || placeholder]].concat(
      srcList.map(t => [t, t]),
      [["__NEW__", "+ إضافة جديد"]]
    );
    return `
      <div class="relative" data-smart-dd="${name}">
        <div class="flex items-center justify-between mb-1">
          <label class="label !mb-0">${esc(label)}</label>
          <button type="button" data-dd-trigger="${name}" class="text-[11px] font-bold text-brand-700 hover:underline">${ic("plus", "!w-3 !h-3")} بحث / إضافة جديد</button>
        </div>
        <select name="${name}" class="sr-only" tabindex="-1">${opts.map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(currentVal) ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select>
        <button type="button" data-dd-trigger="${name}" class="w-full flex items-center justify-between gap-2.5 rounded-xl ring-1 ring-slate-200 bg-slate-50/50 hover:bg-white px-3 py-2 text-right text-sm hover:ring-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition">
          <span class="flex items-center gap-2 min-w-0 flex-1" data-dd-label="${name}"></span>
          <span class="text-slate-400 shrink-0">${ic("chevron-down")}</span>
        </button>
        <div data-dd-chips="${name}" class="flex flex-wrap gap-1 mt-1.5"></div>
        <div data-dd-panel="${name}" class="hidden mt-1.5 rounded-2xl bg-white shadow-lift ring-1 ring-slate-200 p-3 z-30">
          <div class="flex items-center gap-1.5 mb-2.5">
            <div class="input-icon flex-1">${ic("search")}<input type="text" data-dd-search="${name}" class="input !h-9 !text-xs" placeholder="ابحث في القائمة أو اكتب اسماً جديداً لإضافته فوراً…"></div>
            <button type="button" data-dd-quickadd="${name}" class="btn btn-primary btn-xs !h-9 shrink-0">${ic("plus")} إضافة جديد</button>
          </div>
          <div data-dd-newprompt="${name}" class="hidden mb-2"></div>
          <div data-dd-list="${name}" class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-52 overflow-y-auto p-0.5"></div>
        </div>
      </div>`;
  };

  const schoolTypeOpts = typeCombos(c.schoolTypes || []);

  const fields = [
    { name: "bookId", type: "html", html: `<div id="bookCodePv" class="rounded-2xl bg-gradient-to-l from-brand-50/90 via-white to-slate-50 ring-1 ring-brand-200/80 px-4 py-3.5 text-sm shadow-xs"></div>` },
    { name: "_secIdentity", type: "html", html: `
      <div class="studio-sec">
        <div class="studio-sec-head">
          <div class="flex items-center gap-2 font-bold text-slate-800 text-[13.5px]">
            <span class="w-6 h-6 rounded-lg bg-brand-700 text-white text-xs flex items-center justify-center num">1</span>
            <span>هوية الكتاب وتصنيفه (دار النشر · المادة · الجزء)</span>
          </div>
          <span class="text-[11px] text-slate-400">اضغط على أي شريحة سريعة أو اختر من القائمة المنسدلة</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3.5">
          ${buildSmartDropdown("publisher", "دار النشر", "store", x.Publisher || "", "— اختر دار النشر أو أضف جديدة —")}
          ${buildSmartDropdown("subject", "المادة الدراسية", "book-open", x.Subject || "", "— اختر المادة أو أضف جديدة —")}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
          ${buildSmartDropdown("bookPart", "جزء الكتاب", "library", x.Book_Part || "", "كتاب واحد (بدون جزء فرعي)", "كتاب واحد (بدون جزء فرعي)")}
          <div>
            <label class="label" for="f_schoolTypes">نوع المدرسة</label>
            <select id="f_schoolTypes" name="schoolTypes" class="sr-only" tabindex="-1">${schoolTypeOpts.map(op => `<option value="${esc(op[0])}" ${String(op[0]) === String(x.School_Types || "حكومي") ? "selected" : ""}>${esc(op[1])}</option>`).join("")}</select>
            <div id="schoolTypePills" class="flex flex-wrap gap-1.5 mt-1">
              ${schoolTypeOpts.map(op => `<button type="button" data-quick-type="${esc(op[0])}" class="qchip">${esc(op[1])}</button>`).join("")}
            </div>
            <div class="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 bg-slate-50 rounded-lg px-2.5 py-1.5 ring-1 ring-slate-100">
              <span>المكتبة المتعاقدة: <b class="text-slate-700">${esc((A().suppliers[0] || {}).Supplier_Name || "الرئيسية")}</b></span>
              <select id="f_supplierId" name="supplierId" class="hidden">${A().suppliers.slice(0, 1).map(s => `<option value="${esc(s.Supplier_ID)}">${esc(s.Supplier_Name)}</option>`).join("")}</select>
              <span class="text-emerald-700 font-semibold">تلقائي</span>
            </div>
          </div>
        </div>
      </div>` },
    { name: "_secGrades", type: "html", html: `
      <div class="studio-sec">
        <div class="studio-sec-head">
          <div class="flex items-center gap-2 font-bold text-slate-800 text-[13.5px]">
            <span class="w-6 h-6 rounded-lg bg-brand-700 text-white text-xs flex items-center justify-center num">2</span>
            <span>الصف الدراسي أو السلسلة المتكاملة</span>
          </div>
          ${!id ? `<div class="seg !w-auto !p-0.5" style="grid-template-columns:repeat(2,auto)" data-seg="regMode">
            <button type="button" class="!px-3 !py-1 !text-xs" data-v="single" aria-pressed="true">كتاب لصف واحد</button>
            <button type="button" class="!px-3 !py-1 !text-xs" data-v="series" aria-pressed="false">سلسلة لعدة صفوف</button>
          </div><input type="hidden" name="regMode" value="single">` : `<span class="pill pill-brand !text-[11px]">تعديل كتاب مسجل</span>`}
        </div>

        ${!id ? `<div class="mb-3 flex flex-wrap items-center gap-1.5 bg-slate-50 rounded-xl px-3 py-2 ring-1 ring-slate-200/70">
          <span class="text-[11.5px] font-bold text-slate-600 ml-1">${ic("library-big", "text-brand-600 !w-3.5 !h-3.5")} تحديد سلسلة مرحلة كاملة بضغطة:</span>
          <button type="button" class="qchip" data-quick-series="المرحلة الابتدائية">الابتدائي 1–6</button>
          <button type="button" class="qchip" data-quick-series="المرحلة الإعدادية">الإعدادي 1–3</button>
          <button type="button" class="qchip" data-quick-series="المرحلة الثانوية">الثانوي 1–3</button>
          <button type="button" class="qchip" data-quick-series="رياض الأطفال">رياض الأطفال</button>
        </div>` : ""}

        <div id="singleGradeCol">
          <div class="relative" data-smart-dd="grade">
            <select name="grade" class="sr-only" tabindex="-1">${[["", "— اختر الصف —"]].concat(grades.map(g => [g.label, g.label + " · " + g.stage]), [["__NEW__", "+ إضافة صف دراسي جديد"]]).map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(x.Grade || "") ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select>
            <div class="flex items-center gap-2">
              <button type="button" data-dd-trigger="grade" class="flex-1 flex items-center justify-between gap-2.5 rounded-xl ring-1 ring-slate-200 bg-slate-50/50 hover:bg-white px-3.5 py-2 text-right text-sm hover:ring-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500 transition">
                <span class="flex items-center gap-2 min-w-0 flex-1" data-dd-label="grade"></span>
                <span class="text-slate-400 shrink-0">${ic("chevron-down")}</span>
              </button>
              <button type="button" data-toggle-newgrade class="btn btn-soft btn-xs !h-10 shrink-0">${ic("plus")} صف جديد</button>
            </div>
            <div id="inlineNewGradeBox" class="hidden rounded-xl bg-brand-50/70 ring-1 ring-brand-200 p-3 mt-2 space-y-2">
              <div class="text-[11.5px] font-bold text-brand-900">إضافة صف دراسي جديد للقائمة:</div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input data-x="newGradeLabel" class="input !h-9 !text-xs bg-white" placeholder="اسم الصف (مثل: تمهيدي)">
                <select data-x="newGradeStage" class="input !h-9 !text-xs bg-white">${stages.map(st => `<option value="${esc(st)}" ${st === "المرحلة الابتدائية" ? "selected" : ""}>${esc(st)}</option>`).join("")}</select>
                <input data-x="newGradeCode" class="input !h-9 !text-xs bg-white num" placeholder="الكود (تلقائي)">
              </div>
              <button type="button" data-confirm-newgrade class="btn btn-primary btn-xs w-full">${ic("check")} اعتماد الصف واختياره</button>
            </div>
            <div data-dd-panel="grade" class="hidden mt-1.5 rounded-2xl bg-white shadow-lift ring-1 ring-slate-200 p-3 z-30">
              <div class="flex items-center justify-between gap-2 mb-2">
                <div class="input-icon flex-1">${ic("search")}<input type="text" data-dd-search="grade" class="input !h-9 !text-xs" placeholder="ابحث عن الصف…"></div>
              </div>
              <div data-dd-list="grade" class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto p-0.5"></div>
            </div>
            <div id="singleGradeQuickGrid" class="mt-2.5 flex flex-wrap gap-1"></div>
          </div>
        </div>

        <div id="seriesWrap" class="hidden mt-2 rounded-2xl bg-slate-50/80 ring-1 ring-slate-200 p-3">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div>
              <span class="font-bold text-xs text-slate-800">صفوف السلسلة المختارة:</span>
              <span id="seriesCountBadge" class="mr-1.5 pill pill-brand !text-[11px]">0 صفوف مختارة</span>
            </div>
            <div class="flex flex-wrap gap-1">
              <button type="button" class="btn btn-soft btn-xs" data-series-stage="المرحلة الابتدائية">الابتدائي (1–6)</button>
              <button type="button" class="btn btn-soft btn-xs" data-series-stage="المرحلة الإعدادية">الإعدادي (1–3)</button>
              <button type="button" class="btn btn-soft btn-xs" data-series-stage="المرحلة الثانوية">الثانوي (1–3)</button>
              <button type="button" class="btn btn-soft btn-xs" data-series-stage="رياض الأطفال">رياض الأطفال</button>
              <button type="button" class="btn btn-ghost btn-xs" data-series-stage="ALL">الكل</button>
              <button type="button" class="btn btn-ghost btn-xs text-rose-600" data-series-stage="NONE">مسح</button>
            </div>
          </div>
          <div id="seriesGradesGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5"></div>
        </div>
      </div>` },
    { name: "_secPricing", type: "html", html: `
      <div class="studio-sec">
        <div class="studio-sec-head">
          <div class="flex items-center gap-2 font-bold text-slate-800 text-[13.5px]">
            <span class="w-6 h-6 rounded-lg bg-brand-700 text-white text-xs flex items-center justify-center num">3</span>
            <span>التسعير والخصومات والحالة</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-[11px] text-slate-400 ml-1">خصم المورد السريع:</span>
            ${[15, 20, 22, 25, 30].map(pct => `<button type="button" data-quick-disc="${pct}" class="qchip !px-2 !py-0.5 num">${pct}%</button>`).join("")}
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label class="label !text-xs" for="f_coverPrice">سعر الغلاف (ج.م)</label>
            <input id="f_coverPrice" name="coverPrice" type="number" inputmode="decimal" step="any" class="input !h-10 num font-bold text-slate-900" value="${esc(x.Cover_Price || "")}" placeholder="فارغ = جاري التسعير">
          </div>
          <div>
            <label class="label !text-xs" for="f_supplierDiscountPct">خصم المكتبة %</label>
            <input id="f_supplierDiscountPct" name="supplierDiscountPct" type="number" inputmode="decimal" step="any" class="input !h-10 num font-bold" value="${esc(x.Supplier_Discount_Pct || "")}" placeholder="%">
          </div>
          <div>
            <label class="label !text-xs" for="f_empDiscountPct">خصم الموظف %</label>
            <input id="f_empDiscountPct" name="empDiscountPct" type="number" inputmode="decimal" step="any" class="input !h-10 num" value="${esc(x.Emp_Discount_Pct === undefined ? "" : x.Emp_Discount_Pct)}" placeholder="الخصم الموحد">
          </div>
          <div>
            <label class="label !text-xs" for="f_bookStatus">حالة الإتاحة</label>
            <select id="f_bookStatus" name="bookStatus" class="input !h-10 !text-xs font-semibold">
              ${[["Available", "متاح للحجز"], ["Not_Yet_Printed", "لم يُطبع بعد (يقبل الحجز)"], ["Suspended", "موقوف مؤقتاً"], ["Discontinued", "ملغى"]].map(op => `<option value="${op[0]}" ${String(op[0]) === String(x.Book_Status === "Pricing" ? "Available" : (x.Book_Status || "Available")) ? "selected" : ""}>${op[1]}</option>`).join("")}
            </select>
          </div>
        </div>
        <div id="pricePv" class="mt-3 rounded-xl bg-brand-50/80 ring-1 ring-brand-100 p-3"></div>
      </div>` }
  ];

  // قراءة كل قيم النموذج شاملة الحقول المخصصة داخل كتل HTML
  const readForm = form => {
    const out = {};
    ["regMode", "grade", "schoolTypes", "publisher", "subject", "bookPart", "supplierId", "bookStatus", "coverPrice", "supplierDiscountPct", "empDiscountPct"].forEach(k => {
      const el = form.elements[k]; if (el) out[k] = el.value;
    });
    return out;
  };

  // استخراج الصفوف المختارة بشكل موثوق سواء من السلسلة أو من القائمة المنسدلة للصف الفردي
  const resolveGrades = form => {
    const f = readForm(form);
    const checked = $$("[data-series-g]:checked", form).map(el => el.dataset.seriesG).filter(Boolean);
    if (checked.length) extra.grades = checked;
    const isSeries = !id && f.regMode === "series";
    if (isSeries) {
      if (extra.grades.length) return extra.grades.slice();
      const singleG = f.grade === "__NEW__" ? cleanCatItem(extra.newGradeLabel) : cleanCatItem(f.grade);
      return singleG ? [singleG] : [];
    }
    const singleG = f.grade === "__NEW__" ? cleanCatItem(extra.newGradeLabel) : cleanCatItem(f.grade);
    if (singleG) return [singleG];
    return extra.grades.length ? extra.grades.slice(0, 1) : [];
  };

  const setSelectValue = (form, name, val, label) => {
    const sel = form.elements[name];
    if (!sel) return;
    if (val && !Array.from(sel.options).some(o => o.value === val)) {
      const op = document.createElement("option");
      op.value = val; op.textContent = label || val;
      sel.appendChild(op);
    }
    sel.value = val;
  };

  const renderSeriesGrid = form => {
    const grid = form.querySelector("#seriesGradesGrid");
    if (!grid) return;
    const sim = A().books.slice();
    grid.innerHTML = grades.map(g => {
      const checked = extra.grades.includes(g.label);
      const nextCode = nextCodePreview(g.code, sim);
      return `<label class="flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold cursor-pointer transition ${checked ? "bg-brand-600 text-white ring-2 ring-brand-600 shadow-sm" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-brand-400"}">
        <span class="flex items-center gap-1.5 min-w-0"><input type="checkbox" data-series-g="${esc(g.label)}" data-series-st="${esc(g.stage)}" class="w-4 h-4 accent-brand-700 shrink-0" ${checked ? "checked" : ""}><span class="truncate">${esc(g.label)}</span></span>
        <span class="text-[10px] num px-1.5 py-0.5 rounded-md ${checked ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}">${esc(nextCode)}</span>
      </label>`;
    }).join("");
    const badge = form.querySelector("#seriesCountBadge");
    if (badge) {
      badge.textContent = extra.grades.length ? `${extra.grades.length} صفوف مختارة` : "اختر صفاً أو مرحلة";
      badge.className = `mr-1.5 pill !text-[11px] ${extra.grades.length ? "pill-green" : "pill-amber"}`;
    }
  };

  const renderSmartDropdown = (form, name) => {
    const f = readForm(form);
    const val = f[name] === "__NEW__" ? cleanCatItem(name === "publisher" ? extra.newPublisher : name === "subject" ? extra.newSubject : name === "bookPart" ? extra.newBookPart : extra.newGradeLabel) : (f[name] || "");
    const lblEl = form.querySelector(`[data-dd-label="${name}"]`);
    const qInput = form.querySelector(`[data-dd-search="${name}"]`);
    const q = qInput ? cleanCatItem(qInput.value) : "";
    const ql = q.toLowerCase();
    const listEl = form.querySelector(`[data-dd-list="${name}"]`);
    const promptEl = form.querySelector(`[data-dd-newprompt="${name}"]`);
    const chipsEl = form.querySelector(`[data-dd-chips="${name}"]`);

    if (name === "grade") {
      const gObj = grades.find(g => g.label === val);
      if (lblEl) {
        lblEl.innerHTML = val
          ? `<span class="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-bold num shrink-0">${esc(gObj ? gObj.code : "جديد")}</span><span class="font-bold text-slate-900 truncate">${esc(val)}</span><span class="text-xs text-slate-400 truncate">${esc(gObj ? gObj.stage : extra.newGradeStage)}</span>`
          : `<span class="text-slate-400">${ic("graduation-cap")} — اختر الصف الدراسي من القائمة أو من الشرائح أدناه —</span>`;
      }
      if (listEl) {
        const filtered = grades.filter(g => !ql || (g.label + " " + g.stage + " " + g.code).toLowerCase().includes(ql));
        listEl.innerHTML = filtered.map(g => {
          const active = g.label === val;
          return `<button type="button" data-dd-pick="grade" data-val="${esc(g.label)}" class="flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-2 text-right text-xs font-semibold transition ${active ? "bg-brand-600 text-white shadow-sm" : "bg-slate-50 text-slate-700 hover:bg-brand-50 hover:text-brand-900"}">
            <span class="truncate">${esc(g.label)}</span>
            <span class="text-[10px] num px-1.5 py-0.5 rounded ${active ? "bg-white/20 text-white" : "bg-white text-slate-500"}">${esc(g.code)}</span>
          </button>`;
        }).join("") || `<div class="col-span-3 text-center py-3 text-xs text-slate-400">لا يوجد صف مطابق — اضغط «+ صف جديد» لإضافته</div>`;
      }
      const sgGrid = form.querySelector("#singleGradeQuickGrid");
      if (sgGrid) {
        sgGrid.innerHTML = grades.map(g => `<button type="button" data-dd-pick="grade" data-val="${esc(g.label)}" class="qchip ${g.label === val ? "active" : ""}"><span>${esc(g.label)}</span><span class="num text-[10px] opacity-75">(${esc(g.code)})</span></button>`).join("");
      }
      return;
    }

    const items = name === "publisher" ? publishers : name === "subject" ? subjects : parts;
    const bookField = name === "publisher" ? "Publisher" : name === "subject" ? "Subject" : "Book_Part";
    const iconName = name === "publisher" ? "store" : name === "subject" ? "book-open" : "library";
    const emptyText = name === "publisher" ? "— اختر دار النشر أو أضف جديدة —" : name === "subject" ? "— اختر المادة أو أضف جديدة —" : "كتاب واحد (بدون جزء فرعي)";

    if (lblEl) {
      if (val) {
        const lg = name === "publisher" ? logoFor(A().pubLogos, val, f.subject || "") : "";
        const isNew = (name === "publisher" && extra.addedPubs.includes(val)) || (name === "subject" && extra.addedSubs.includes(val)) || (name === "bookPart" && extra.addedParts.includes(val));
        lblEl.innerHTML = `${name === "publisher" ? `<span class="w-7 h-7 rounded-lg ring-1 ring-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">${lg ? `<img src="${esc(lg)}" class="w-full h-full object-contain" alt="">` : ic("store", "text-brand-600")}</span>` : `<span class="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">${ic(iconName)}</span>`}
          <span class="font-bold text-slate-900 truncate">${esc(val)}</span>
          ${isNew ? `<span class="pill pill-green !text-[10px] !px-2">جديد</span>` : ""}`;
      } else {
        lblEl.innerHTML = `<span class="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">${ic(iconName)}</span><span class="${name === "bookPart" ? "font-semibold text-slate-700" : "text-slate-400"} truncate">${esc(emptyText)}</span>`;
      }
    }

    if (chipsEl) {
      const topItems = items.slice(0, name === "bookPart" ? 6 : 8);
      const zeroChip = name === "bookPart" ? `<button type="button" data-dd-pick="bookPart" data-val="" class="qchip ${!val ? "active" : ""}">كامل (بلا جزء)</button>` : "";
      chipsEl.innerHTML = zeroChip + topItems.map(it => `<button type="button" data-dd-pick="${name}" data-val="${esc(it)}" class="qchip ${it === val ? "active" : ""}">${esc(it)}</button>`).join("");
    }

    if (promptEl) {
      if (q && !items.some(x => x.toLowerCase() === ql)) {
        const kindAr = name === "publisher" ? "كدار نشر جديدة" : name === "subject" ? "كمادة دراسية جديدة" : "كجزء كتاب جديد";
        promptEl.classList.remove("hidden");
        promptEl.innerHTML = `<button type="button" data-dd-create="${name}" data-val="${esc(q)}" class="w-full flex items-center justify-between gap-2 rounded-xl bg-brand-600 text-white px-3 py-2 text-xs font-bold shadow-sm hover:bg-brand-700 transition">
          <span class="flex items-center gap-1.5">${ic("sparkles")} إضافة «${esc(q)}» ${kindAr} واعتمادها فوراً</span>
          <span>اضغط للاختيار ←</span>
        </button>`;
      } else {
        promptEl.classList.add("hidden");
        promptEl.innerHTML = "";
      }
    }

    if (listEl) {
      const filtered = items.filter(x => !ql || x.toLowerCase().includes(ql));
      const headOpt = name === "bookPart" && !ql ? `<button type="button" data-dd-pick="bookPart" data-val="" class="col-span-2 sm:col-span-3 flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition ${!val ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}"><span>كتاب واحد (كامل بدون جزء فرعي)</span>${!val ? ic("check") : ""}</button>` : "";
      listEl.innerHTML = headOpt + (filtered.map(item => {
        const active = item === val;
        const cnt = A().books.filter(b => b[bookField] === item && b.Book_Status !== "Discontinued").length;
        const lg = name === "publisher" ? logoFor(A().pubLogos, item, f.subject || "") : "";
        return `<button type="button" data-dd-pick="${name}" data-val="${esc(item)}" class="flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-2 text-right text-xs font-semibold transition ${active ? "bg-brand-600 text-white shadow-sm" : "bg-slate-50 text-slate-700 hover:bg-brand-50 hover:text-brand-900"}">
          <span class="flex items-center gap-1.5 min-w-0">
            ${name === "publisher" ? `<span class="w-5 h-5 rounded bg-white flex items-center justify-center overflow-hidden shrink-0">${lg ? `<img src="${esc(lg)}" class="w-full h-full object-contain" alt="">` : ic("store", "text-slate-400 !w-3.5 !h-3.5")}</span>` : ""}
            <span class="truncate">${esc(item)}</span>
          </span>
          ${cnt ? `<span class="text-[10px] num px-1.5 py-0.5 rounded shrink-0 ${active ? "bg-white/20 text-white" : "bg-white text-slate-400"}">${cnt}</span>` : ""}
        </button>`;
      }).join("") || `<div class="col-span-3 text-center py-3 text-xs text-slate-400">اكتب الاسم أعلاه واضغط «+ إضافة جديد»</div>`);
    }
  };

  const addAndPickItem = (form, name, rawVal) => {
    const val = cleanCatItem(rawVal);
    if (!val || (name !== "bookPart" && val.length < 2)) {
      toast(name === "publisher" ? "أدخل اسم دار النشر (حرفان على الأقل)" : name === "subject" ? "أدخل اسم المادة (حرفان على الأقل)" : "أدخل اسم جزء الكتاب", "warning");
      return;
    }
    const list = name === "publisher" ? publishers : name === "subject" ? subjects : parts;
    if (!list.includes(val)) {
      list.unshift(val);
      if (name === "publisher") { extra.newPublisher = val; extra.addedPubs.push(val); if (A().catalog && A().catalog.publishers && !A().catalog.publishers.includes(val)) A().catalog.publishers.push(val); }
      if (name === "subject") { extra.newSubject = val; extra.addedSubs.push(val); if (A().catalog && A().catalog.subjects && !A().catalog.subjects.includes(val)) A().catalog.subjects.push(val); }
      if (name === "bookPart") { extra.newBookPart = val; extra.addedParts.push(val); if (A().catalog && A().catalog.parts && !A().catalog.parts.includes(val)) A().catalog.parts.push(val); }
    }
    setSelectValue(form, name, val, val);
    const qInput = form.querySelector(`[data-dd-search="${name}"]`);
    if (qInput) qInput.value = "";
    const panel = form.querySelector(`[data-dd-panel="${name}"]`);
    if (panel) panel.classList.add("hidden");
    renderSmartDropdown(form, name);
    form.dispatchEvent(new Event("input"));
  };

  const switchMode = (form, mode) => {
    const seg = form.querySelector('[data-seg="regMode"]');
    if (!seg || !form.elements.regMode) return;
    form.elements.regMode.value = mode;
    $$("button", seg).forEach(b => b.setAttribute("aria-pressed", b.dataset.v === mode));
  };

  const v = await UI.form({
    title: id ? "لوحة تعديل الكتاب والتسعير" : (cloneFromId ? "إضافة نفس الكتاب لصف جديد أو سلسلة" : "استوديو تسجيل كتاب أو سلسلة متكاملة"),
    sub: id ? `${x.Book_Name} (${x.Book_ID})` : (cloneFromId && src ? `نسخ من: ${src.Book_Name} (${src.Book_ID}) — اختر الصف الجديد أو السلسلة` : "اختر من الشرائح السريعة أو القوائم المنسدلة، أو أضف دار نشر / مادة / صفاً جديداً بضغطة واحدة"),
    wide: true, icon: "check", ok: id ? "حفظ تعديلات الكتاب" : "اعتماد وحفظ في الكتالوج", fields,
    onChange: (_, form) => {
      if (!wired) {
        wired = true;
        renderSeriesGrid(form);

        form.addEventListener("click", e => {
          const trig = e.target.closest("[data-dd-trigger]");
          if (trig) {
            const name = trig.dataset.ddTrigger;
            const panel = form.querySelector(`[data-dd-panel="${name}"]`);
            const wasOpen = panel && !panel.classList.contains("hidden");
            $$("[data-dd-panel]", form).forEach(p => p.classList.add("hidden"));
            if (panel && !wasOpen) {
              panel.classList.remove("hidden");
              renderSmartDropdown(form, name);
              const sInp = panel.querySelector(`[data-dd-search="${name}"]`);
              if (sInp) setTimeout(() => sInp.focus(), 20);
            }
            return;
          }
          const pick = e.target.closest("[data-dd-pick]");
          if (pick) {
            const name = pick.dataset.ddPick, val = pick.dataset.val;
            setSelectValue(form, name, val, val);
            if (name === "grade" && val && !extra.grades.length) extra.grades = [val];
            const panel = form.querySelector(`[data-dd-panel="${name}"]`);
            if (panel) panel.classList.add("hidden");
            ["grade", "publisher", "subject", "bookPart"].forEach(k => renderSmartDropdown(form, k));
            form.dispatchEvent(new Event("input"));
            return;
          }
          const qt = e.target.closest("[data-quick-type]");
          if (qt) {
            setSelectValue(form, "schoolTypes", qt.dataset.quickType, qt.textContent);
            form.dispatchEvent(new Event("input"));
            return;
          }
          const qd = e.target.closest("[data-quick-disc]");
          if (qd && form.elements.supplierDiscountPct) {
            form.elements.supplierDiscountPct.value = qd.dataset.quickDisc;
            form.dispatchEvent(new Event("input"));
            return;
          }
          const cr = e.target.closest("[data-dd-create]");
          if (cr) {
            addAndPickItem(form, cr.dataset.ddCreate, cr.dataset.val);
            return;
          }
          const qa = e.target.closest("[data-dd-quickadd]");
          if (qa) {
            const name = qa.dataset.ddQuickadd;
            const sInp = form.querySelector(`[data-dd-search="${name}"]`);
            if (sInp && cleanCatItem(sInp.value)) {
              addAndPickItem(form, name, sInp.value);
            } else if (sInp) {
              sInp.focus();
              toast("اكتب الاسم الجديد في خانة البحث ثم اضغط «+ إضافة جديد»", "info");
            }
            return;
          }
          if (e.target.closest("[data-toggle-newgrade]")) {
            const box = form.querySelector("#inlineNewGradeBox");
            if (box) {
              box.classList.toggle("hidden");
              const inp = box.querySelector('[data-x="newGradeLabel"]');
              if (inp && !box.classList.contains("hidden")) inp.focus();
            }
            return;
          }
          if (e.target.closest("[data-confirm-newgrade]")) {
            const lbl = cleanCatItem(extra.newGradeLabel);
            const stg = cleanCatItem(extra.newGradeStage) || "المرحلة الابتدائية";
            let code = String(extra.newGradeCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
            if (lbl.length < 2) { toast("أدخل اسم الصف الدراسي الجديد", "warning"); return; }
            let gObj = grades.find(g => g.label === lbl);
            if (!gObj) {
              const used = new Set(grades.map(g => String(g.code).toUpperCase()));
              if (code && used.has(code)) { toast(`بادئة الكود (${code}) مستخدمة لصف آخر`, "warning"); return; }
              if (!code) {
                const pre = /أطفال|تمهيد|تأسيس|كي جي/i.test(stg + " " + lbl) ? "KG" : /ابتدائ/i.test(stg + " " + lbl) ? "P" : /إعداد/i.test(stg + " " + lbl) ? "M" : /ثانو/i.test(stg + " " + lbl) ? "S" : "G";
                let gn = 1; while (used.has(pre + gn)) gn++; code = pre + gn;
              }
              gObj = { code, label: lbl, stage: stg };
              grades.push(gObj);
              extra.addedGrades.push(gObj);
              if (A().catalog && A().catalog.grades && !A().catalog.grades.some(g => g.label === lbl)) A().catalog.grades.push(gObj);
            }
            extra.newGradeCode = gObj.code;
            setSelectValue(form, "grade", gObj.label, gObj.label + " · " + gObj.stage);
            if (!extra.grades.includes(gObj.label)) extra.grades.push(gObj.label);
            renderSeriesGrid(form);
            const box = form.querySelector("#inlineNewGradeBox"), panel = form.querySelector('[data-dd-panel="grade"]');
            if (box) box.classList.add("hidden");
            if (panel) panel.classList.add("hidden");
            renderSmartDropdown(form, "grade");
            form.dispatchEvent(new Event("input"));
            return;
          }
          const qs = e.target.closest("[data-quick-series]");
          if (qs) {
            const st = qs.dataset.quickSeries;
            switchMode(form, "series");
            extra.grades = grades.filter(g => g.stage === st).map(g => g.label);
            if (extra.grades[0]) setSelectValue(form, "grade", extra.grades[0], extra.grades[0]);
            renderSeriesGrid(form);
            form.dispatchEvent(new Event("input"));
            return;
          }
          const stBtn = e.target.closest("[data-series-stage]");
          if (stBtn) {
            const st = stBtn.dataset.seriesStage;
            extra.grades = st === "ALL" ? grades.map(g => g.label) : st === "NONE" ? [] : grades.filter(g => g.stage === st).map(g => g.label);
            if (extra.grades[0]) setSelectValue(form, "grade", extra.grades[0], extra.grades[0]);
            renderSeriesGrid(form);
            form.dispatchEvent(new Event("input"));
          }
        });

        $$("[data-dd-search]", form).forEach(sInp => {
          sInp.addEventListener("input", e => {
            e.stopPropagation();
            const name = sInp.dataset.ddSearch;
            if (name === "grade") {
              const v = cleanCatItem(sInp.value);
              if (v) extra.newGradeLabel = v;
            }
            renderSmartDropdown(form, name);
          });
          sInp.addEventListener("keydown", e => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              const name = sInp.dataset.ddSearch, v = cleanCatItem(sInp.value);
              if (v && name !== "grade") addAndPickItem(form, name, v);
            }
          });
        });

        $$("[data-x]", form).forEach(inp => inp.addEventListener("input", () => { extra[inp.dataset.x] = inp.value; form.dispatchEvent(new Event("input")); }));
        form.addEventListener("change", e => {
          if (e.target && e.target.matches("[data-series-g]")) {
            extra.grades = $$("[data-series-g]:checked", form).map(el => el.dataset.seriesG).filter(Boolean);
            if (extra.grades[0]) setSelectValue(form, "grade", extra.grades[0], extra.grades[0]);
            renderSeriesGrid(form);
            form.dispatchEvent(new Event("input"));
          }
        });
      }

      const f = readForm(form);
      const isSeries = !id && f.regMode === "series";
      if (isSeries && !extra.grades.length && f.grade && f.grade !== "__NEW__") {
        extra.grades = [f.grade];
        renderSeriesGrid(form);
      }
      const singleCol = form.querySelector("#singleGradeCol"), srWrap = form.querySelector("#seriesWrap");
      if (singleCol) singleCol.classList.toggle("hidden", isSeries);
      if (srWrap) srWrap.classList.toggle("hidden", !isSeries);

      // تحديث أزرار نوع المدرسة السريعة وأزرار خصم المكتبة السريعة
      $$("[data-quick-type]", form).forEach(btn => btn.classList.toggle("active", btn.dataset.quickType === (f.schoolTypes || "حكومي")));
      $$("[data-quick-disc]", form).forEach(btn => btn.classList.toggle("active", String(btn.dataset.quickDisc) === String(f.supplierDiscountPct || "")));

      ["grade", "publisher", "subject", "bookPart"].forEach(k => renderSmartDropdown(form, k));

      const p = bookPrice(f), el = form.querySelector("#pricePv"), cpv = form.querySelector("#bookCodePv");
      const saving = r2(n(f.coverPrice) - p.emp);
      if (el) el.innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">${[
        [`صافي تكلفة الكتاب (خصم ${p.sd}%)`, p.cost, "text-slate-900"],
        [`سعر الموظف (خصم ${p.ed}%)`, p.emp, "text-brand-800"],
        ["وفر الموظف بالنسخة", saving > 0 ? saving : 0, "text-emerald-700"],
        ["هامش المبادرة للنسخة", p.margin, p.margin < 0 ? "text-rose-600" : "text-emerald-700"]
      ].map(c => `<div class="rounded-xl bg-white/90 ring-1 ring-brand-100/80 px-2.5 py-2"><div class="text-[10.5px] text-slate-500 font-semibold">${c[0]}</div><div class="text-base font-bold num mt-0.5 ${c[2]}">${fmt(c[1])} <span class="text-[10px] font-normal text-slate-400">ج.م</span></div></div>`).join("")}</div>
      <div class="mt-2.5 text-[11.5px] text-slate-600 flex flex-wrap items-center justify-between gap-2 border-t border-brand-100/70 pt-2"><span class="flex items-center gap-1">${ic("info", "text-brand-600")} خصم الكمية (افتراضي 3%) يُحتسب على إجمالي كل فاتورة توريد كاملة عند الاستلام وليس على سعر الكتاب الفردي.</span><span class="text-slate-500">الغلاف: <b class="num font-bold text-slate-800">${fmt(f.coverPrice || 0)}</b> ج.م</span></div>`;

      if (cpv) {
        const pub = cleanCatItem(f.publisher === "__NEW__" ? extra.newPublisher : f.publisher);
        const sub = cleanCatItem(f.subject === "__NEW__" ? extra.newSubject : f.subject);
        const part = cleanCatItem(f.bookPart === "__NEW__" ? extra.newBookPart : f.bookPart);
        const autoName = previewBookName(pub, sub, part, f.schoolTypes);
        const lg = pub ? logoFor(A().pubLogos, pub, sub) : "";
        const cTypes = String(f.schoolTypes || "").split(/[,،+]/).map(s => s.trim()).filter(Boolean);
        const findDup = gLabel => (gLabel && pub && sub) ? A().books.find(b => b.Book_ID !== id && b.Book_Status !== "Discontinued" && b.Grade === gLabel && b.Publisher === pub && b.Subject === sub && (b.Book_Part || "") === part && cTypes.some(t => String(b.School_Types || "").split(/[,،+]/).map(s => s.trim()).includes(t))) : null;
        const nameBar = `<div class="flex flex-wrap items-center justify-between gap-3 mb-2 pb-2 border-b border-brand-100/80">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-11 h-11 rounded-xl bg-white ring-1 ring-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">${lg ? `<img src="${esc(lg)}" class="w-full h-full object-contain p-0.5" alt="">` : ic("book-open", "text-brand-600")}</span>
            <div class="min-w-0">
              <div class="text-[11px] text-slate-400 font-semibold">المعاينة الحية لبطاقة الكتاب في الكتالوج</div>
              <div class="font-bold text-slate-900 text-[15px] truncate">${autoName ? esc(autoName) : `<span class="text-slate-400 font-normal text-xs">اختر دار النشر والمادة لتوليد اسم الكتاب تلقائياً…</span>`}</div>
            </div>
          </div>
          <div class="flex items-center gap-2 num text-xs">
            <span class="rounded-lg bg-white ring-1 ring-slate-200 px-2.5 py-1 font-semibold text-slate-700">سعر الموظف: <b class="text-brand-800">${n(f.coverPrice) ? fmt(p.emp) + " ج.م" : "جاري التسعير"}</b></span>
          </div>
        </div>`;

        const targetGrades = resolveGrades(form);
        extra.formVals = f;
        extra.finalGrades = targetGrades;
        if (isSeries) {
          if (!targetGrades.length) {
            cpv.innerHTML = nameBar + `<div class="text-xs text-amber-700 font-semibold">${ic("info")} اختر صفوف السلسلة من الأزرار السريعة (مثل: <b>الابتدائي 1–6</b>) ليتم توليد كود لكل صف تلقائياً.</div>`;
          } else {
            const sim = A().books.slice();
            const chips = targetGrades.map(gl => {
              const dup = findDup(gl);
              if (dup) return `<span class="inline-flex items-center gap-1 rounded-lg bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">${esc(gl)}: مسجّل (${esc(dup.Book_ID)}) — سيُتخطى</span>`;
              const gObj = grades.find(g => g.label === gl);
              const code = gObj ? nextCodePreview(gObj.code, sim) : "جديد";
              sim.push({ Book_ID: code });
              return `<span class="inline-flex items-center gap-1 rounded-lg bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-semibold">${esc(gl)} ← <b class="num">${esc(code)}</b></span>`;
            });
            cpv.innerHTML = nameBar + `<div class="text-xs font-semibold text-slate-700 mb-1.5">أكواد السلسلة التي ستُسجَّل (${targetGrades.length} صفوف):</div><div class="flex flex-wrap gap-1.5">${chips.join("")}</div>`;
          }
        } else {
          const gLabel = targetGrades[0] || "";
          const dup = findDup(gLabel);
          if (dup) cpv.innerHTML = nameBar + `<div class="text-rose-600 font-semibold text-xs">${ic("circle-alert")} هذا الكتاب مسجّل بالفعل في ${esc(gLabel)} بكود <b class="num">${esc(dup.Book_ID)}</b> (${esc(dup.Book_Name)}) — عدّله بدلاً من تكراره.</div>`;
          else if (id) cpv.innerHTML = nameBar + `<div class="text-xs">الكود الحالي: <b class="num text-brand-800">${esc(x.Book_ID)}</b> · الصف: <b>${esc(gLabel)}</b> · المدرسة: <b>${esc(f.schoolTypes || "حكومي")}</b></div>`;
          else if (gLabel) {
            const gObj = grades.find(g => g.label === gLabel);
            cpv.innerHTML = nameBar + `<div class="text-xs">الصف: <b>${esc(gLabel)}</b> ← الكود التلقائي التالي: <b class="num text-brand-800">${esc(gObj ? nextCodePreview(gObj.code, A().books) : "تلقائي")}</b></div>`;
          } else {
            cpv.innerHTML = nameBar + `<div class="text-xs text-slate-500">اختر الصف الدراسي أو اضغط على سلسلة سريعة (مثل: <b>الابتدائي 1–6</b>) لتوليد الأكواد تلقائياً دون تكرار.</div>`;
          }
        }
      }
    },
    validate: (_, form) => {
      const f = readForm(form);
      const targetGrades = resolveGrades(form);
      extra.formVals = f;
      extra.finalGrades = targetGrades;
      const pub = cleanCatItem(f.publisher === "__NEW__" ? extra.newPublisher : f.publisher);
      const sub = cleanCatItem(f.subject === "__NEW__" ? extra.newSubject : f.subject);
      if (!targetGrades.length) { toast("اختر الصف الدراسي (أو حدّد صفوف السلسلة)", "warning"); return false; }
      if (pub.length < 2) { toast("اختر دار النشر من القائمة المنسدلة أو أضف دار نشر جديدة", "warning"); return false; }
      if (sub.length < 2) { toast("اختر المادة الدراسية من القائمة المنسدلة أو أضف مادة جديدة", "warning"); return false; }
      return true;
    }
  });
  if (!v) return;

  // استخراج القيم النهائية المعتمدة من النموذج
  const fv = Object.assign({}, extra.formVals || {}, v);
  const pub = cleanCatItem(fv.publisher === "__NEW__" ? extra.newPublisher : fv.publisher);
  const sub = cleanCatItem(fv.subject === "__NEW__" ? extra.newSubject : fv.subject);
  const part = cleanCatItem(fv.bookPart === "__NEW__" ? extra.newBookPart : fv.bookPart);
  const isSeries = !id && fv.regMode === "series";
  const singleG = fv.grade === "__NEW__" ? cleanCatItem(extra.newGradeLabel) : cleanCatItem(fv.grade);
  const targetGrades = (extra.finalGrades && extra.finalGrades.length)
    ? extra.finalGrades.slice()
    : (isSeries ? (extra.grades.length ? extra.grades.slice() : (singleG ? [singleG] : [])) : (singleG ? [singleG] : extra.grades.slice(0, 1)));

  // إذا أُضيفت دار نشر أو مادة أو جزء جديد، نحفظها في إعدادات الكتالوج أولاً لضمان التوافق التام مع كل نسخ الخادم
  if (extra.addedPubs.includes(pub) && can("SAVE_SETTING")) await call("SAVE_SETTING", { key: "BOOK_PUBLISHERS", value: publishers.join("،") });
  if (extra.addedSubs.includes(sub) && can("SAVE_SETTING")) await call("SAVE_SETTING", { key: "BOOK_SUBJECTS", value: subjects.join("،") });
  if (extra.addedParts.includes(part) && can("SAVE_SETTING")) await call("SAVE_SETTING", { key: "BOOK_PARTS", value: parts.join("،") });
  if (extra.addedGrades.length && can("SAVE_SETTING")) {
    const customG = grades.filter(g => !BASE_GRADES.includes(g.label));
    await call("SAVE_SETTING", { key: "BOOK_GRADES", value: JSON.stringify(customG) });
  }

  const payload = {
    bookId: id || "",
    grade: targetGrades[0] || "",
    grades: targetGrades,
    schoolTypes: fv.schoolTypes || "حكومي",
    publisher: pub,
    subject: sub,
    bookPart: part,
    supplierId: fv.supplierId || (A().suppliers[0] || {}).Supplier_ID || "",
    bookStatus: fv.bookStatus || "Available",
    coverPrice: fv.coverPrice,
    supplierDiscountPct: fv.supplierDiscountPct,
    volumeDiscountSharePct: 0,
    empDiscountPct: fv.empDiscountPct
  };
  if (extra.addedPubs.includes(pub)) payload.newPublisher = pub;
  if (extra.addedSubs.includes(sub)) payload.newSubject = sub;
  if (extra.addedParts.includes(part)) payload.newBookPart = part;
  const addedGObj = extra.addedGrades.find(g => targetGrades.includes(g.label));
  if (addedGObj) {
    payload.newGradeLabel = addedGObj.label;
    payload.newGradeStage = addedGObj.stage;
    payload.newGradeCode = addedGObj.code;
  }

  // تنفيذ الحفظ مع دعم كامل للسلاسل المتعددة والصفوف المخصصة سواء على منطق الخادم الحديث أو الأقدم
  const saveSingleFallback = async gl => {
    const r1 = await call("SAVE_BOOK", Object.assign({}, payload, { grade: gl, grades: [gl] }), { block: true });
    if (r1 && r1.success) return r1;
    // إذا كان الخادم على نسخة أقدم لا تعرف الصف المخصص الجديد، نسجله عبر BULK_IMPORT_BOOKS بنفس الكود والتسعير
    if (r1 && /اختر الصف الدراسي/.test(r1.message || "") && can("BULK_IMPORT_BOOKS")) {
      const gObj = grades.find(g => g.label === gl) || { code: "G1", label: gl, stage: extra.newGradeStage || "المرحلة الابتدائية" };
      const code = id || nextCodePreview(gObj.code, A().books);
      const rImp = await call("BULK_IMPORT_BOOKS", { booksArray: [{
        Book_ID: code, Book_Name: previewBookName(pub, sub, part, payload.schoolTypes), Stage: gObj.stage, Grade: gObj.label,
        Subject: sub, Publisher: pub, Supplier_ID: payload.supplierId, School_Types: payload.schoolTypes, Book_Part: part,
        Cover_Price: payload.coverPrice, Supplier_Discount_Pct: payload.supplierDiscountPct,
        Volume_Discount_Share_Pct: 0, Emp_Discount_Pct: payload.empDiscountPct
      }] }, { block: true });
      if (rImp && rImp.success) return { success: true, message: `تم حفظ الكتاب ${code} (${gObj.label}).`, book: { Book_ID: code, Grade: gObj.label } };
    }
    return r1;
  };

  let r = await call("SAVE_BOOK", payload, { block: true });
  if (r && !r.success && /اختر الصف الدراسي/.test(r.message || "") && targetGrades.length === 1) {
    r = await saveSingleFallback(targetGrades[0]);
  }
  if (r && r.success && targetGrades.length > 1 && !Array.isArray(r.books)) {
    const created = [r.book ? `${targetGrades[0]} (${r.book.Book_ID})` : targetGrades[0]];
    if (r.book) A().books.push(r.book);
    const errs = [];
    for (const gl of targetGrades.slice(1)) {
      const rNext = await saveSingleFallback(gl);
      if (rNext && rNext.success) {
        if (rNext.book) A().books.push(rNext.book);
        created.push(rNext.book ? `${gl} (${rNext.book.Book_ID})` : gl);
      } else if (rNext && rNext.message) errs.push(`${gl}: ${rNext.message}`);
    }
    toast(`تم تسجيل سلسلة (${previewBookName(pub, sub, part, payload.schoolTypes)}) لعدد ${created.length} صفوف: ${created.join("، ")}`, "success");
    if (errs.length) toast(errs.join(" · "), "warning");
    await reloadData();
    return;
  }
  toast((r && r.message) || (r && r.success ? "تم الحفظ بنجاح" : "حدث خطأ"), r && r.success ? "success" : "danger");
  if (r && r.success) await reloadData();
}
on("bookForm", id => openBookModal(id, null));
on("bookClone", id => openBookModal(null, id));
on("bookDel", id => {
  const b = A().books.find(x => x.Book_ID === id) || {};
  return act("DELETE_BOOK", { bookId: id }, { title: "حذف كتاب", message: `سيتم حذف الكتاب «${b.Book_Name || id}» (${id} · ${b.Grade || ""}) نهائياً من الكتالوج.\nالحذف متاح فقط لكتاب بلا حجوزات أو حركات مخزن أو فواتير. متابعة؟`, ok: "حذف", tone: "danger" });
});
on("importBooks", async () => {
  const v = await UI.form({ title: "استيراد الكتالوج", wide: true, intro: "انسخ الصفوف من Excel والصقها هنا. الأعمدة بالترتيب:<br><b>الكود، الاسم، المرحلة، الصف، المادة، الناشر، كود المكتبة، سعر الغلاف، خصم المكتبة %</b>",
    fields: [{ name: "txt", label: "البيانات", type: "textarea", rows: 8, required: true, placeholder: "BK-101\tسلاح التلميذ رياضيات\tالمرحلة الابتدائية\tالرابع\tرياضيات\t..." }], ok: "استيراد", icon: "upload" });
  if (!v) return;
  const rows = parsePaste(v.txt).map(p => ({ Book_ID: p[0], Book_Name: p[1], Stage: p[2], Grade: p[3], Subject: p[4], Publisher: p[5], Supplier_ID: p[6], Cover_Price: p[7], Supplier_Discount_Pct: p[8] }));
  if (rows.length) await act("BULK_IMPORT_BOOKS", { booksArray: rows });
});
// ---------------- التسعير الجماعي: قالب ← لصق من Excel ← معاينة ← اعتماد
const toEnDigits = v => String(v || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[٫,]/g, ".").replace(/[^\d.]/g, "");
const BP = { s: null };
on("bulkPrice", () => {
  const d = A(), pricing = d.books.filter(b => b.Book_Status === "Pricing").length;
  let saved = {}; try { saved = JSON.parse((d.settings.find(x => x.Setting_Key === "SUPPLIER_DISCOUNT_RULES") || {}).Setting_Value || "{}"); } catch (_) { saved = {}; }
  const rules = Object.entries(saved.publishers || {}).reduce((m, [p, v]) => { (m[v] = m[v] || []).push(p); return m; }, {});
  BP.s = { txt: "", sup: saved.supplierId || (d.suppliers[0] || {}).Supplier_ID || "", disc: saved.rest !== undefined ? String(saved.rest) : "", res: null, scope: "pricing",
    rules: Object.keys(rules).length ? Object.entries(rules).map(([v, pubs]) => ({ pct: v, pubs })) : [{ pct: "", pubs: [] }] };
  BP.m = UI.open(`<div id="bpBody">${bpBody()}</div>`, { title: "التسعير الجماعي", sub: `${fmt(pricing)} كتاب بانتظار السعر`, wide: true,
    footer: `<div class="flex flex-wrap items-center justify-between gap-2"><span id="bpSum" class="text-sm text-slate-500"></span><div class="flex gap-2"><button class="btn btn-outline" data-act="bpPreview">${ic("eye")} معاينة</button><button class="btn btn-primary" data-act="bpApply" disabled>${ic("check")} اعتماد التسعير</button></div></div>` });
});
function bpRows() {
  return parsePaste(BP.s.txt).map(c => c.map(x => String(x).trim())).filter(c => c[0] && /[A-Za-z]/.test(c[0]) && /\d/.test(c[0]))
    .map(c => c.length >= 5 ? { bookId: c[0], coverPrice: toEnDigits(c[4]), supplierDiscountPct: toEnDigits(c[5] || "") } : { bookId: c[0], coverPrice: toEnDigits(c[1]), supplierDiscountPct: toEnDigits(c[2] || "") });
}
function bpBody() {
  const d = A(), s = BP.s, rows = bpRows();
  const res = s.res ? s.res.results : null;
  return `<ol class="grid gap-3 sm:grid-cols-3 text-[12.5px] mb-4">${[["download", "نزّل القالب", "ملف Excel بالكتب وأعمدة السعر فارغة"], ["file-spreadsheet", "املأ الأسعار", "سعر الغلاف وخصم المكتبة % لكل كتاب"], ["upload", "الصق واعتمد", "انسخ الصفوف من Excel والصقها هنا"]].map((x, i) => `<li class="rounded-2xl bg-slate-50 p-3 flex gap-2.5"><span class="w-7 h-7 rounded-full bg-brand-700 text-white font-bold flex items-center justify-center shrink-0">${i + 1}</span><span><b class="block text-slate-800">${x[1]}</b><span class="text-slate-500">${x[2]}</span></span></li>`).join("")}</ol>
  <div class="flex flex-wrap items-end gap-2 mb-3">
    <div><div class="label">القالب يشمل</div><select class="input !h-10 !w-auto" data-change="bpF" data-k="scope"><option value="pricing" ${s.scope === "pricing" ? "selected" : ""}>الكتب بانتظار السعر</option><option value="filtered" ${s.scope === "filtered" ? "selected" : ""}>الكتب الظاهرة بالفلاتر الحالية</option><option value="all" ${s.scope === "all" ? "selected" : ""}>كل الكتب</option></select></div>
    <button class="btn btn-outline btn-sm !h-10" data-act="bpTemplate">${ic("download")} تنزيل القالب</button>
    <div class="mr-auto"><div class="label">المكتبة</div><div class="input !h-10 !w-auto flex items-center bg-slate-50">${ic("store", "text-brand-600")}&nbsp;${esc((d.suppliers[0] || {}).Supplier_Name || "—")} (الرئيسية)</div></div>
  </div>
  <div class="rounded-2xl ring-1 ring-slate-200 p-3 mb-3"><div class="flex items-center justify-between mb-2"><div class="font-bold text-[13.5px] text-slate-800">${ic("badge-percent", "text-brand-600")} خصم المكتبة حسب الناشر</div><button class="btn btn-ghost btn-xs" data-act="bpRuleAdd">${ic("plus")} قاعدة</button></div>
    ${s.rules.map((r, i) => `<div class="flex flex-wrap items-start gap-2 mb-2"><input class="input !h-10 !w-20 num" inputmode="decimal" placeholder="%" value="${esc(r.pct)}" data-change="bpRule" data-i="${i}" data-k="pct">
      <div class="flex-1 min-w-[12rem] flex flex-wrap gap-1.5">${pubsOf().map(p => `<button class="chip !h-8 !text-xs" data-act="bpPub" data-id="${i}|${esc(p)}" aria-pressed="${r.pubs.includes(p)}">${esc(p)}</button>`).join("")}</div>
      ${s.rules.length > 1 ? `<button class="icon-btn w-9 h-9 text-rose-500" data-act="bpRuleDel" data-id="${i}">${ic("trash-2")}</button>` : ""}</div>`).join("")}
    <div class="flex items-center gap-2 mt-1 pt-2 border-t border-slate-100"><span class="text-[13px] font-semibold text-slate-700">باقي الكتب</span><input class="input !h-10 !w-20 num" inputmode="decimal" value="${esc(s.disc)}" placeholder="%" data-change="bpF" data-k="disc"><span class="text-[12px] text-slate-500">%</span>
      <button class="btn btn-outline btn-xs mr-auto" data-act="bpReprice">${ic("refresh-cw")} طبّق على الكتب المسعّرة</button></div>
    <div class="text-[11.5px] text-slate-400 mt-1.5">الأولوية: الخصم المكتوب في السطر ← قاعدة الناشر ← باقي الكتب. سعر الموظف لا يتأثر.</div></div>
  <textarea class="input h-auto py-2.5 leading-relaxed num" rows="6" dir="ltr" placeholder="P4-012	سلاح التلميذ — عربي	4 ابتدائي	سلاح التلميذ	135	25&#10;أو بالمختصر:  P4-012	135	25" data-input="bpTxt">${esc(s.txt)}</textarea>
  <div class="text-[12px] text-slate-500 mt-1.5">${rows.length ? `قُرئ ${fmt(rows.length)} سطراً` : "يُقبل القالب كما هو (6 أعمدة) أو 3 أعمدة: الكود، سعر الغلاف، خصم المكتبة. الخصم الفارغ يأخذ الافتراضي."} · سعر الموظف = الغلاف − ${fmt(d.settingsMap.UNIFIED_EMP_DISCOUNT_PCT)}% مقرَّباً لأعلى جنيه.</div>
  ${res ? `<div class="mt-3">${UI.table([
      { t: "الكتاب", v: r => `<b>${esc(r.name || r.bookId)}</b><div class="text-[11px] text-slate-400 num">${esc(r.bookId)} · سطر ${r.line}</div>` },
      { t: "الغلاف", cls: "num", v: r => r.ok ? fmt(r.cover) + (n(r.oldCover) && n(r.oldCover) !== n(r.cover) ? `<div class="text-[11px] text-slate-400 line-through">${fmt(r.oldCover)}</div>` : "") : "" },
      { t: "خصم المكتبة", cls: "num", v: r => r.ok ? r.disc + "%" + (r.rule ? `<div class="text-[10.5px] text-slate-400">${esc(r.rule)}</div>` : "") : "" }, { t: "التكلفة", cls: "num", v: r => r.ok ? fmt(r.cost) : "" },
      { t: "سعر الموظف", cls: "num", v: r => r.ok ? `<b class="text-brand-800">${fmt(r.emp)}</b>` : "" },
      { t: "الهامش", cls: "num", v: r => r.ok ? `<span class="${r.margin < 0 ? "text-rose-600 font-bold" : "text-emerald-600"}">${fmt(r.margin)}</span>` : "" },
      { t: "الحالة", v: r => r.ok ? (r.warning ? pill("", r.warning, "amber") : pill("", r.wasPricing ? "سيُتاح للحجز" : "تحديث سعر", "green")) : pill("", r.error, "red") }
    ], res, { maxH: 320 })}</div>` : ""}`;
}
const bpRefresh = () => { const el = $("#bpBody"); if (el) el.innerHTML = bpBody(); const r = BP.s.res, ap = document.querySelector('[data-act="bpApply"]'), sm = $("#bpSum");
  if (ap) ap.disabled = !(r && r.priced); if (sm) sm.innerHTML = r ? `<b class="text-emerald-600">${fmt(r.priced)}</b> صالح · <b class="text-rose-600">${fmt(r.rejected)}</b> مرفوض` : ""; };
on("bpTxt", v => { BP.s.txt = v; BP.s.res = null; const ap = document.querySelector('[data-act="bpApply"]'); if (ap) ap.disabled = true; const sm = $("#bpSum"); if (sm) sm.innerHTML = ""; });
on("bpF", (v, el) => { BP.s[el.dataset.k] = v; BP.s.res = null; bpRefresh(); });
on("bpTemplate", () => {
  const d = A(), f = Q.bookF || {}, q = (Q.books || "").toLowerCase(), sc = BP.s.scope;
  const list = d.books.filter(x => x.Book_Status !== "Discontinued" && (sc === "all" || (sc === "pricing" ? x.Book_Status === "Pricing"
    : (!q || (x.Book_ID + x.Book_Name + x.Grade + x.Subject + x.Publisher).toLowerCase().includes(q)) && (!f.grade || x.Grade === f.grade) && (!f.type || String(x.School_Types || "").split("،").includes(f.type)) && (!f.pub || x.Publisher === f.pub) && (!f.sub || x.Subject === f.sub) && (!f.st || x.Book_Status === f.st))));
  exportCSV("قالب_التسعير", ["الكود", "الكتاب", "الصف", "الناشر", "سعر الغلاف", "خصم المكتبة %"], list.map(x => [x.Book_ID, x.Book_Name, x.Grade, x.Publisher, x.Book_Status === "Pricing" ? "" : x.Cover_Price, x.Book_Status === "Pricing" ? "" : x.Supplier_Discount_Pct]));
});
const pubsOf = () => [...new Set(A().books.filter(b => b.Book_Status !== "Discontinued").map(b => b.Publisher).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
const bpRules = () => { const m = {}; BP.s.rules.forEach(r => { if (r.pct !== "" && r.pct !== undefined) r.pubs.forEach(p => { m[p] = toEnDigits(r.pct); }); }); return m; };
on("bpRuleAdd", () => { BP.s.rules.push({ pct: "", pubs: [] }); BP.s.res = null; bpRefresh(); });
on("bpRuleDel", i => { BP.s.rules.splice(n(i), 1); BP.s.res = null; bpRefresh(); });
on("bpRule", (v, el) => { BP.s.rules[n(el.dataset.i)][el.dataset.k] = v; BP.s.res = null; });
on("bpPub", id => { const [i, p] = [n(id.split("|")[0]), id.slice(id.indexOf("|") + 1)]; BP.s.rules.forEach((r, k) => { if (k !== i) r.pubs = r.pubs.filter(x => x !== p); }); const r = BP.s.rules[i]; r.pubs = r.pubs.includes(p) ? r.pubs.filter(x => x !== p) : r.pubs.concat(p); BP.s.res = null; bpRefresh(); });
// إعادة حساب خصم المكتبة للكتب المسعّرة بنفس سعر غلافها
on("bpReprice", async () => {
  const priced = A().books.filter(b => b.Book_Status !== "Pricing" && b.Book_Status !== "Discontinued" && n(b.Cover_Price) > 0);
  if (!priced.length) return toast("لا توجد كتب مسعّرة بعد", "info");
  BP.s.txt = priced.map(b => b.Book_ID + "\t" + b.Cover_Price).join("\n"); BP.s.res = null; bpRefresh();
  ACTIONS.bpPreview();
});
const bpCall = dryRun => call("BULK_PRICE_BOOKS", { rows: bpRows(), defaults: { supplierId: BP.s.sup, supplierDiscountPct: toEnDigits(BP.s.disc), publisherDiscounts: bpRules() }, dryRun }, { block: true });
on("bpPreview", async () => {
  if (!bpRows().length) return toast("الصق صفوف الأسعار أولاً", "warning");
  const r = await bpCall(true); if (!r.success) return toast(r.message, "danger");
  BP.s.res = r; bpRefresh();
});
on("bpApply", async () => {
  const r0 = BP.s.res; if (!r0 || !r0.priced) return;
  if (!(await UI.confirm({ title: "اعتماد التسعير", message: `تسعير ${fmt(r0.priced)} كتاباً${r0.rejected ? ` (وتجاهل ${fmt(r0.rejected)} سطراً مرفوضاً)` : ""}؟ الكتب المسعّرة تُتاح للحجز فوراً.`, ok: "اعتماد" }))) return;
  const r = await bpCall(false);
  toast(r.message, r.success ? "success" : "danger");
  if (r.success) { if (BP.m) BP.m.close(); await Admin.load(); }
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
          <div class="flex items-center gap-1.5">${cur ? "" : `<button class="btn btn-ghost btn-xs" data-act="setPhase" data-id="${esc(p.Phase_ID)}">عرض</button>`}${lockedBtn("SAVE_PHASE", `<button class="act-ic act-ic-edit" data-act="phaseForm" data-id="${esc(p.Phase_ID)}" title="تعديل المرحلة" aria-label="تعديل المرحلة">${ic("pencil")}</button>`)}${its.length ? "" : lockedBtn("DELETE_PHASE", `<button class="act-ic act-ic-del" data-act="phaseDel" data-id="${esc(p.Phase_ID)}" title="حذف المرحلة" aria-label="حذف المرحلة">${ic("trash-2")}</button>`)}</div></div></article>`;
    }).join("")}</div>` : `<div class="card">${UI.empty("calendar-range", "لا توجد مراحل بعد", "", lockedBtn("SAVE_PHASE", `<button class="btn btn-primary mt-5" data-act="phaseForm">${ic("plus")} مرحلة جديدة</button>`))}</div>`);
});
on("phaseForm", async id => {
  const p = id ? A().phases.find(x => x.Phase_ID === id) : {};
  const grades = (A().catalog || {}).grades || [];
  const rawG = String(p.Allowed_Grades || "ALL").trim();
  const isAll = !rawG || rawG.toUpperCase() === "ALL";
  let picked = isAll ? [] : rawG.split(/[,،]/).map(s => s.trim()).filter(Boolean);
  let wiredP = false;
  const v = await UI.form({
    title: id ? "تعديل مرحلة" : "مرحلة جديدة", sub: id || "", wide: true,
    fields: [
      { name: "phaseName", label: "اسم المرحلة", value: p.Phase_Name || "", required: true, placeholder: "مثال: الترم الأول 2026/2027" },
      { name: "startDate", label: "بداية الحجز", type: "date", value: day(p.Start_DateTime), cols: 1, required: true },
      { name: "endDate", label: "نهاية الحجز", type: "date", value: day(p.End_DateTime), cols: 1, required: true },
      { name: "deliveryStartDate", label: "بداية التسليم", type: "date", value: day(p.Delivery_Start_Date), cols: 1, hint: "أساس جدول الأقساط" },
      { name: "gradeScope", label: "نطاق الصفوف المتاحة", type: "seg", value: isAll ? "ALL" : "CUSTOM", cols: 1, options: [["ALL", "كل الصفوف الدراسية"], ["CUSTOM", "تحديد صفوف معينة"]] },
      { name: "_phaseGrades", type: "html", html: `
        <input type="hidden" name="allowedGrades" value="${esc(isAll ? "ALL" : picked.join("،"))}">
        <div id="phGradesBox" class="${isAll ? "hidden" : ""} rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-3.5">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <span class="font-bold text-xs text-slate-800">${ic("graduation-cap", "text-brand-600")} اختر الصفوف المسموح لها بالحجز في هذه المرحلة:</span>
            <div class="flex flex-wrap gap-1">
              <button type="button" class="btn btn-soft btn-xs" data-ph-stage="المرحلة الابتدائية">الابتدائي</button>
              <button type="button" class="btn btn-soft btn-xs" data-ph-stage="المرحلة الإعدادية">الإعدادي</button>
              <button type="button" class="btn btn-soft btn-xs" data-ph-stage="المرحلة الثانوية">الثانوي</button>
              <button type="button" class="btn btn-soft btn-xs" data-ph-stage="رياض الأطفال">رياض الأطفال</button>
              <button type="button" class="btn btn-ghost btn-xs text-rose-600" data-ph-stage="NONE">مسح</button>
            </div>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">${grades.map(g => `<label class="flex items-center gap-2 rounded-xl bg-white ring-1 ring-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:ring-brand-400"><input type="checkbox" data-ph-g="${esc(g.label)}" data-ph-st="${esc(g.stage)}" class="w-4 h-4 accent-brand-700" ${picked.includes(g.label) ? "checked" : ""}><span>${esc(g.label)}</span></label>`).join("")}</div>
        </div>` }
    ],
    onChange: (f, form) => {
      if (!wiredP) {
        wiredP = true;
        form.addEventListener("change", e => {
          if (e.target && e.target.matches("[data-ph-g]")) {
            picked = $$("[data-ph-g]:checked", form).map(el => el.dataset.phG);
            if (form.elements.allowedGrades) form.elements.allowedGrades.value = f.gradeScope === "ALL" ? "ALL" : picked.join("،");
          }
        });
        $$("[data-ph-stage]", form).forEach(btn => btn.addEventListener("click", () => {
          const st = btn.dataset.phStage;
          $$("[data-ph-g]", form).forEach(cb => { cb.checked = st === "NONE" ? false : (cb.checked || cb.dataset.phSt === st); });
          picked = $$("[data-ph-g]:checked", form).map(el => el.dataset.phG);
          if (form.elements.allowedGrades) form.elements.allowedGrades.value = picked.join("،");
        }));
      }
      const box = form.querySelector("#phGradesBox");
      if (box) box.classList.toggle("hidden", f.gradeScope === "ALL");
      if (form.elements.allowedGrades) form.elements.allowedGrades.value = f.gradeScope === "ALL" ? "ALL" : (picked.length ? picked.join("،") : "ALL");
    },
    validate: (f) => {
      if (f.gradeScope === "CUSTOM" && !picked.length) { toast("اختر صفاً واحداً على الأقل أو اختر «كل الصفوف الدراسية»", "warning"); return false; }
      return true;
    }
  });
  if (v) {
    v.allowedGrades = v.gradeScope === "ALL" ? "ALL" : (picked.length ? picked.join("،") : "ALL");
    delete v.gradeScope; delete v._phaseGrades;
    await act("SAVE_PHASE", Object.assign({ phaseId: id || "" }, v));
  }
});
on("phaseDel", id => {
  const p = A().phases.find(x => x.Phase_ID === id) || {};
  return act("DELETE_PHASE", { phaseId: id }, { title: "حذف مرحلة", message: `سيتم حذف المرحلة «${p.Phase_Name || id}» نهائياً. الحذف متاح فقط لمرحلة بلا حجوزات أو حركات. متابعة؟`, ok: "حذف", tone: "danger" });
});

// ============================================================ المكتبات
Router.add("/a/suppliers", view => {
  const d = A(), bal = supplierBalances(), mainId = (d.suppliers[0] || {}).Supplier_ID;
  view.innerHTML = UI.pageHead("المكتبات المتعاقدة", "كل الكتب تتبع المكتبة الرئيسية (أول مكتبة مسجلة) · خصم الكمية يُطبق على إجمالي الفاتورة بعد خصومات الأصناف", lockedBtn("SAVE_SUPPLIER", `<button class="btn btn-primary btn-sm" data-act="supplierForm">${ic("plus")} مكتبة جديدة</button>`))
    + (d.suppliers.length ? `<div class="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">${d.suppliers.map(s => { const x = bal[s.Supplier_ID] || { inv: 0, claim: 0, ret: 0, paid: 0 }; const due = x.inv - x.claim - x.ret - x.paid;
      const isMain = s.Supplier_ID === mainId, hasMoves = !!bal[s.Supplier_ID];
      return `<article class="card card-pad ${isMain ? "ring-2 ring-brand-400" : ""}"><div class="flex items-center gap-3"><span class="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center text-xl">${ic("store")}</span>
        <div class="min-w-0 flex-1"><h3 class="font-bold text-slate-900 truncate">${esc(s.Supplier_Name)}</h3><div class="text-[12px] text-slate-500 num">${esc(s.Supplier_ID)}${s.Phone ? " · " + esc(s.Phone) : ""}</div></div><span class="pill pill-brand">خصم فاتورة التوريد ${fmt(s.Volume_Discount_Pct !== undefined && s.Volume_Discount_Pct !== "" ? s.Volume_Discount_Pct : 3)}%</span></div>
        <div class="grid grid-cols-3 gap-2 mt-4">${UI.stat("الكتب", fmt(d.books.filter(b => b.Supplier_ID === s.Supplier_ID).length))}${UI.stat("المدفوع", fmt(x.paid))}${UI.stat("المستحق لها", `<span class="${due > 0 ? "text-rose-600" : ""}">${fmt(due)}</span>`)}</div>
        <div class="flex items-center justify-between mt-4">${isMain ? `<span class="pill pill-brand">${ic("badge-check")} المكتبة الرئيسية</span>` : "<span></span>"}${hasMoves ? "" : lockedBtn("DELETE_SUPPLIER", `<button class="act-ic act-ic-del" data-act="supplierDel" data-id="${esc(s.Supplier_ID)}" title="حذف المكتبة" aria-label="حذف المكتبة">${ic("trash-2")}</button>`)}</div></article>`; }).join("")}</div>`
      : `<div class="card">${UI.empty("store", "لا توجد مكتبات", "أضف المكتبة المتعاقدة أولاً لربط الكتب بها.")}</div>`);
});
on("supplierForm", async () => {
  const v = await UI.form({ title: "مكتبة جديدة", fields: [{ name: "supplierName", label: "اسم المكتبة", required: true }, { name: "phone", label: "الهاتف", type: "tel", cols: 1 }, { name: "volumeDiscountPct", label: "خصم الكمية على إجمالي الفاتورة % (افتراضي 3%)", type: "number", value: 3, cols: 1 }] });
  if (v) await act("SAVE_SUPPLIER", v);
});
on("supplierDel", id => {
  const d = A(), s = d.suppliers.find(x => x.Supplier_ID === id) || {}, isMain = (d.suppliers[0] || {}).Supplier_ID === id, next = d.suppliers[1];
  const extra = isMain ? (next ? `\nهذه هي المكتبة الرئيسية: ستصبح «${next.Supplier_Name}» هي الرئيسية وتنتقل إليها كل الكتب.` : "\nهذه هي المكتبة الرئيسية الوحيدة.") : "";
  return act("DELETE_SUPPLIER", { supplierId: id }, { title: "حذف مكتبة", message: `سيتم حذف المكتبة «${s.Supplier_Name || id}» نهائياً. الحذف متاح فقط لمكتبة بلا طلبات توريد أو فواتير أو حركات حساب.${extra}\nمتابعة؟`, ok: "حذف", tone: "danger" });
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
    { t: "الموظف", v: e => `<div class="flex items-center gap-2.5">${UI.avatar(e.Full_Name, "w-9 h-9 text-xs")}<div><div class="font-semibold text-slate-900">${empLink(e.Emp_ID, e.Full_Name)}</div><div class="text-[11.5px] text-slate-400 num">${esc(e.Emp_ID)}</div></div></div>` },
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
    syncBtn("btn-sm") + lockedBtn("SUBMIT_OR_UPDATE_RESERVATION", `<button class="btn btn-outline btn-sm" data-act="reserveFor">${ic("notebook-pen")} حجز نيابة عن موظف</button>`) + lockedBtn("BULK_IMPORT_EMPLOYEES", `<button class="btn btn-primary btn-sm" data-act="importEmps">${ic("file-spreadsheet")} استيراد / تحديث</button>`))
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
on("reserveFor", () => ACTIONS.resNew());

// ============================================================ الإعدادات
const CATALOG_SETTING_TABS = { BOOK_PUBLISHERS: "publishers", BOOK_SUBJECTS: "subjects", BOOK_PARTS: "parts", BOOK_GRADES: "grades" };
Router.add("/a/settings", view => {
  const d = A();
  view.innerHTML = UI.pageHead("الإعدادات", APP.user.role === "Admin" ? "قواعد المبادرة العامة" : "للاطلاع فقط — التعديل للمدير",
    can("SAVE_BOOK") ? `<button class="btn btn-outline btn-sm" data-act="catalogMgr">${ic("sliders-horizontal")} إدارة قوائم الكتالوج</button>` : "")
    + permsSection()
    + `<section class="card divide-y divide-slate-100">${d.settings.filter(s => s.Setting_Key !== "ROLE_PERMISSIONS").map(s => {
      const catTab = CATALOG_SETTING_TABS[s.Setting_Key];
      const cleanDesc = String(s.Description || s.Setting_Key).replace(/\s*\(مفصولة بفاصلة\)/g, "");
      if (catTab) {
        const items = s.Setting_Key === "BOOK_GRADES"
          ? ((d.catalog || {}).grades || []).map(g => g.label)
          : String(s.Setting_Value || "").split(/[,،]/).map(x => x.trim()).filter(Boolean);
        return `<div class="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3.5">
          <div class="flex-1 min-w-[12rem]"><div class="font-semibold text-slate-800 text-[14px]">${esc(cleanDesc)}</div><code class="text-[11px] text-slate-400" dir="ltr">${esc(s.Setting_Key)}</code></div>
          <div class="flex flex-wrap items-center gap-1 max-w-xl">${items.slice(0, 8).map(it => `<span class="pill pill-gray !text-xs">${esc(it)}</span>`).join("")}${items.length > 8 ? `<span class="pill pill-brand !text-xs num">+${items.length - 8} أخرى</span>` : ""}</div>
          ${(can("SAVE_SETTING") || can("SAVE_BOOK")) ? `<button class="btn btn-outline btn-xs" data-act="catalogMgr" data-id="${catTab}">${ic("sliders-horizontal")} إدارة القائمة (${items.length})</button>` : ""}</div>`;
      }
      return `<div class="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3.5">
        <div class="flex-1 min-w-[12rem]"><div class="font-semibold text-slate-800 text-[14px]">${esc(cleanDesc)}</div><code class="text-[11px] text-slate-400" dir="ltr">${esc(s.Setting_Key)}</code></div>
        <div class="font-bold text-brand-800 num text-[15px] min-w-0 max-w-full [overflow-wrap:anywhere]">${esc(String(s.Setting_Value).replace(/،/g, "، "))}</div>
        ${can("SAVE_SETTING") ? `<button class="act-ic act-ic-edit" data-act="editSetting" data-id="${esc(s.Setting_Key)}" title="تعديل الإعداد" aria-label="تعديل الإعداد">${ic("pencil")}</button>` : ""}</div>`;
    }).join("")}</section>`;
});
// ---------------- مصفوفة الصلاحيات (المدير يحدد ما يفعله كل دور)
// [الدور، الاسم، اختصار للموبايل، باقي الاسم للشاشات الأكبر]
const PERM_ROLES = [["Coordinator", "مسؤول المبادرة", "مسؤول", " المبادرة"], ["Finance", "أمين الصندوق", "الصندوق", ""], ["Warehouse", "أمين المخزن", "المخزن", ""]];
const PERM_GROUPS = [
  ["الحجوزات والكتب", [["SUBMIT_OR_UPDATE_RESERVATION", "إضافة/تعديل/حذف حجز موظف"], ["SAVE_BOOK", "إضافة وتعديل الكتب والأسعار"], ["DELETE_BOOK", "حذف كتاب من الكتالوج"], ["BULK_IMPORT_BOOKS", "استيراد الكتب"], ["BULK_IMPORT_EMPLOYEES", "استيراد/تحديث الموظفين"], ["SAVE_SUPPLIER", "المكتبات المتعاقدة"], ["DELETE_SUPPLIER", "حذف مكتبة"]]],
  ["المراحل والتوريد", [["SAVE_PHASE", "إنشاء وتعديل المراحل"], ["DELETE_PHASE", "حذف مرحلة"], ["SET_PHASE_STATUS", "فتح وإغلاق الحجز"], ["GENERATE_PO_SNAPSHOT", "تجميد الحصر وطلب التوريد"], ["CANCEL_PO_BACKORDER", "إلغاء نواقص المكتبة"], ["SUBMIT_SUPPLIER_INVOICE", "فاتورة المكتبة والجرد"]]],
  ["التوزيع والتسليم", [["RUN_ALLOCATION_ENGINE", "تشغيل التوزيع بالأسبقية"], ["MANUAL_ALLOCATION_OVERRIDE", "تعديل التوزيع يدوياً"], ["CARRY_WAITLIST_TO_PHASE", "ترحيل المنتظرين"], ["EXECUTE_BOOK_DELIVERY", "تسليم الكتب"], ["CANCEL_UNDELIVERED_QTY", "إلغاء كمية لم تُسلَّم"], ["RECORD_BOOK_RETURN", "مرتجعات الموظفين"], ["RECORD_STOCK_ADJUSTMENT", "تسويات المخزن"]]],
  ["الخزينة والفواتير", [["RECORD_EMPLOYEE_PAYMENT", "تحصيل وإصدار إيصال"], ["VOID_EMPLOYEE_PAYMENT", "إلغاء إيصال"], ["REFUND_EMPLOYEE_CREDIT", "رد رصيد لموظف"], ["CUSTOMIZE_EMP_INSTALLMENTS", "تعديل خطة الأقساط"], ["ADJUST_EMP_INVOICE", "تعديل الفاتورة (خصم/إضافة)"], ["DELETE_EMP_INVOICE", "حذف فاتورة"], ["RECORD_SUPPLIER_PAYMENT", "السداد للمكتبة"], ["RECORD_INITIATIVE_EXPENSE", "المصروفات"], ["CLOSE_CASH_DAY", "إقفال الخزينة اليومي"]]]
];
const RISKY = ["VOID_EMPLOYEE_PAYMENT", "DELETE_EMP_INVOICE", "RECORD_STOCK_ADJUSTMENT", "MANUAL_ALLOCATION_OVERRIDE"];
function permsSection() {
  const acl = A().acl || ACL, admin = APP.user.role === "Admin";
  if (!Q.perm) Q.perm = JSON.parse(JSON.stringify(acl));
  const P = Q.perm;
  return `<section class="card mb-4"><div class="px-4 sm:px-5 pt-4 pb-3 flex flex-wrap items-start justify-between gap-3">
      <div><h2 class="card-title">${ic("shield-check", "text-brand-600")} الصلاحيات</h2><p class="card-sub">حدّد ما يستطيع كل دور فعله. المدير له كل الصلاحيات دائماً، والتعديل يسري فوراً على الجميع.</p></div>
      ${admin ? `<div class="flex gap-2"><button class="btn btn-ghost btn-sm" data-act="permReset">تراجع</button><button class="btn btn-primary btn-sm" data-act="permSave">${ic("check")} حفظ الصلاحيات</button></div>` : ""}</div>
    <div class="px-3 sm:px-5 pb-4">
      <div class="grid grid-cols-[1fr_repeat(3,3.6rem)] sm:grid-cols-[1fr_repeat(3,7rem)] items-center gap-y-0.5 sticky top-16 bg-white z-[1] py-2 border-b border-slate-100 text-[11.5px] sm:text-[12.5px] font-bold text-slate-500 text-center"><span class="text-right">العملية</span>${PERM_ROLES.map(r => `<span class="leading-tight">${r[2]}<span class="hidden sm:inline">${r[3]}</span></span>`).join("")}</div>
      ${PERM_GROUPS.map(g => `<div class="mt-3 mb-1 text-[12.5px] font-bold text-brand-800">${g[0]}</div>${g[1].map(([a, label]) => `<label class="grid grid-cols-[1fr_repeat(3,3.6rem)] sm:grid-cols-[1fr_repeat(3,7rem)] items-center py-2 border-b border-slate-50 text-[13px]"><span class="leading-snug pl-2">${label}${RISKY.includes(a) ? ` <span class="pill pill-red !text-[10px] !px-1.5">حساسة</span>` : ""}</span>${PERM_ROLES.map(([r]) => `<span class="text-center"><input type="checkbox" class="w-5 h-5 accent-brand-700 align-middle" data-change="permToggle" data-a="${a}" data-r="${r}" ${(P[a] || []).includes(r) ? "checked" : ""} ${admin ? "" : "disabled"}></span>`).join("")}</label>`).join("")}`).join("")}
    </div></section>`;
}
on("permToggle", (v, el) => { const a = el.dataset.a, r = el.dataset.r, P = Q.perm; P[a] = (P[a] || []).filter(x => x !== r); if (el.checked) P[a].push(r); });
on("permReset", () => { Q.perm = null; Shell.rerender(); });
on("permSave", async () => {
  const P = Q.perm, acl = {}; PERM_GROUPS.forEach(g => g[1].forEach(([a]) => { acl[a] = (P[a] || []).filter(r => r !== "EMPLOYEE"); }));
  const risky = RISKY.filter(a => acl[a].length).map(a => PERM_GROUPS.flatMap(g => g[1]).find(x => x[0] === a)[1]);
  const r = await act("SAVE_ROLE_PERMISSIONS", { acl }, risky.length ? { title: "حفظ الصلاحيات", message: "منحت صلاحيات حساسة: " + risky.join("، ") + ". متابعة؟", ok: "حفظ" } : null);
  if (r && r.success) { Q.perm = null; Shell.rerender(); }
});

on("editSetting", async key => {
  if (CATALOG_SETTING_TABS[key]) { ACTIONS.catalogMgr(CATALOG_SETTING_TABS[key]); return; }
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
    lockedBtn("GENERATE_PO_SNAPSHOT", `<button class="btn btn-gold btn-sm" data-act="freezePO">${ic("lock")} تجميد الحصر</button>`) + (snaps.length ? `<button class="btn btn-primary btn-sm" data-act="printPO">${ic("printer")} أمر التوريد PDF</button><button class="btn btn-outline btn-sm" data-act="exportPO">${ic("download")} تصدير طلب التوريد</button>` : ""))
    + poDriftBox(poDrift(APP.phaseId))
    + `<div class="grid grid-cols-3 gap-3 sm:gap-4 mb-4">${UI.kpi("كتب مختلفة", fmt(live.length), { icon: "library", tone: "brand" })}${UI.kpi("نسخ محجوزة", fmt(sum(live, "req")), { icon: "book-open", tone: "blue" })}${UI.kpi("المطلوب من المكتبة", fmt(sum(snaps, "Net_Order_To_Supplier_Qty")), { icon: "truck", tone: "green", foot: snaps.length ? "بعد التجميد" : "لم يُجمَّد بعد" })}</div>`
    + UI.section(`${ic("clipboard-list", "text-brand-600")} الحجوزات الحالية`, "تجميع لحظي يتغير مع حجوزات الموظفين", UI.table([
      { t: "الكتاب", v: x => `<b>${esc(bookName(b, x.id))}</b><div class="text-[11.5px] text-slate-400">${esc(x.id)}</div>` },
      { t: "عدد الموظفين", cls: "num", v: x => fmt(x.emps) }, { t: "النسخ المحجوزة", cls: "num", v: x => `<b>${fmt(x.req)}</b>` }, { t: "الرصيد الحر بالمخزن", cls: "num", v: x => fmt(x.free) }
    ], live.sort((x, y) => y.req - x.req), { maxH: 380, empty: "لا حجوزات في المرحلة", emptyIcon: "clipboard-list" }))
    + `<div class="h-4"></div>`
    + UI.section(`${ic("truck", "text-brand-600")} طلب التوريد المجمَّد`, "", UI.table([
      { t: "كود الكتاب", cls: "num", v: p => esc(p.Book_ID) },
      { t: "اسم الكتاب", v: p => `<b>${esc(bookName(b, p.Book_ID))}</b>` },
      { t: "المادة", v: p => esc((b[p.Book_ID] || {}).Subject || "") },
      { t: "الصف", v: p => esc((b[p.Book_ID] || {}).Grade || "") },
      { t: "العدد المطلوب", cls: "num", v: p => `<b class="text-brand-800">${fmt(p.Net_Order_To_Supplier_Qty)}</b>` + (n(p.Received_Qty_To_Date) ? `<div class="text-[11px] text-emerald-600">وصل ${fmt(p.Received_Qty_To_Date)}</div>` : "") },
      { t: "", actions: true, v: p => p.Line_Status === "Open" && can("CANCEL_PO_BACKORDER") ? `<button class="btn btn-outline-danger btn-xs" data-act="cancelBO" data-id="${esc(p.PO_ID)}">${ic("ban")} لن يُورَّد</button>` : "" }
    ], snaps, { maxH: 520, emptyIcon: "lock", empty: "لم يُجمَّد الحصر بعد", emptySub: "التجميد يُغلق الحجز ويُنشئ طلب التوريد النهائي للمكتبة." }));
});
on("freezePO", () => act("GENERATE_PO_SNAPSHOT", { phaseId: APP.phaseId }, { title: "تجميد الحصر", message: "سيتم إغلاق الحجز لهذه المرحلة وإنشاء طلب التوريد النهائي. متابعة؟", ok: "تجميد" }));
on("exportPO", () => { const { b, s } = maps(); exportCSV("طلب_توريد_" + APP.phaseId, ["كود الكتاب", "اسم الكتاب", "المادة", "الصف", "العدد المطلوب"], A().poSnapshots.filter(p => p.Phase_ID === APP.phaseId && n(p.Net_Order_To_Supplier_Qty) > 0).map(p => [p.Book_ID, bookName(b, p.Book_ID), (b[p.Book_ID] || {}).Subject, (b[p.Book_ID] || {}).Grade, p.Net_Order_To_Supplier_Qty])); });
on("cancelBO", async id => {
  const v = await UI.form({ title: "إلغاء نواقص لن تُورَّد", tone: "danger", fields: [{ name: "reason", label: "السبب", required: true, placeholder: "مثال: الناشر أوقف الطبعة" }], ok: "تأكيد الإلغاء" });
  if (v) await act("CANCEL_PO_BACKORDER", { poId: id, reason: v.reason });
});

// ============================================================ فاتورة المكتبة والجرد
Router.add("/a/receive", view => {
  if (noPhase(view)) return;
  const d = A(), sid = Q.sup || (d.suppliers[0] || {}).Supplier_ID, sup = d.suppliers.find(x => x.Supplier_ID === sid) || {};
  const snaps = {}; d.poSnapshots.filter(p => p.Phase_ID === APP.phaseId).forEach(p => snaps[p.Book_ID] = n(p.Outstanding_Qty));
  const books = d.books.filter(b => b.Supplier_ID === sup.Supplier_ID)
    .sort((x, y) => (snaps[y.Book_ID] || 0) - (snaps[x.Book_ID] || 0) || bookSortComparator(x, y, d.catalog));
  const canSubmit = can("SUBMIT_SUPPLIER_INVOICE");
  const defVol = sup.Volume_Discount_Pct !== undefined && sup.Volume_Discount_Pct !== "" ? n(sup.Volume_Discount_Pct) : 3;

  view.innerHTML = UI.pageHead("فاتورة المكتبة والجرد", "أدخل ما وصل فعلياً: السليم يدخل المخزن، والتالف مطالبة على المكتبة · خصم الكمية يُحتسب على إجمالي الفاتورة بنسبة ثابتة قابلة للتعديل")
  + `<section class="card card-pad mb-4">
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div class="col-span-2 lg:col-span-1"><label class="label">المكتبة</label><select class="input" data-change="pickSup">${d.suppliers.map(s => `<option value="${esc(s.Supplier_ID)}" ${s.Supplier_ID === sid ? "selected" : ""}>${esc(s.Supplier_Name)}</option>`).join("")}</select></div>
        <div><label class="label">رقم فاتورة المكتبة</label><input id="siNo" class="input" placeholder="مثال: INV-2026/01"></div>
        <div><label class="label">التاريخ</label><input id="siDate" type="date" class="input" value="${new Date().toISOString().slice(0, 10)}"></div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="label !mb-0" for="siVol">خصم الكمية للفاتورة %</label>
            <div class="flex items-center gap-1">
              ${[0, 2, 3, 5].map(p => `<button type="button" class="qchip !px-1.5 !py-0.2 num text-[11px]" data-act="siVolPreset" data-v="${p}">${p}%</button>`).join("")}
            </div>
          </div>
          <input id="siVol" type="number" step="any" min="0" max="100" class="input num font-bold text-brand-800" value="${defVol}" data-input="recalcSI">
        </div>
        <div><label class="label">الصافي بفاتورة المكتبة</label><input id="siStated" type="number" step="any" class="input num" placeholder="للمطابقة الحية" data-input="recalcSI"></div>
      </div>
      <div id="siDiffBadge" class="mt-3 flex items-center justify-end"></div>
    </section>

    <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
      <div class="flex items-center gap-2 flex-1 max-w-sm">
        <div class="relative w-full">
          <input id="siSearch" class="input input-sm !h-9 pr-8 text-xs" placeholder="بحث باسم الكتاب أو الكود أو الناشر…" data-input="siFilter">
          <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">${ic("search")}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" class="btn btn-outline btn-xs" data-act="siFillReq">${ic("check-check")} مطابقة المطلوب لكل الكتب</button>
        <button type="button" class="btn btn-outline btn-xs" data-act="siZeroReq">${ic("rotate-ccw")} تصفير السليم</button>
      </div>
    </div>

  ${books.length ? `<div id="siBody" class="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">${books.map(b => { const o = snaps[b.Book_ID] || 0; return `<article class="card p-4 si-row" data-id="${esc(b.Book_ID)}" data-ord="${o}" data-search="${esc((b.Book_ID + " " + b.Book_Name + " " + (b.Publisher || "") + " " + (b.Subject || "")).toLowerCase())}">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <h3 class="font-bold text-slate-900 leading-snug">${esc(b.Book_Name)}</h3>
          <div class="text-[11.5px] text-slate-500 flex items-center gap-2 mt-0.5"><code class="num font-bold text-brand-700">${esc(b.Book_ID)}</code>${b.Publisher ? `<span>· ${esc(b.Publisher)}</span>` : ""}${b.Grade ? `<span>· ${esc(b.Grade)}</span>` : ""}</div>
        </div>
        <div class="text-left shrink-0"><div class="text-[11px] text-slate-500 font-semibold">المطلوب</div><div class="font-bold text-lg num text-brand-800">${o}</div></div>
      </div>
      <div class="grid grid-cols-4 gap-2 mt-3">
        <div><label class="text-[11px] font-semibold text-emerald-700">سليم</label><input type="number" min="0" class="input input-sm num font-bold text-emerald-800 si-rec" value="${o}" data-input="recalcSI"></div>
        <div><label class="text-[11px] font-semibold text-rose-600">تالف</label><input type="number" min="0" class="input input-sm num font-bold text-rose-700 si-dmg" value="0" data-input="recalcSI"></div>
        <div><label class="text-[11px] font-semibold text-slate-500">الغلاف</label><input type="number" step="any" class="input input-sm num si-cover" value="${n(b.Cover_Price)}" data-input="recalcSI"></div>
        <div><label class="text-[11px] font-semibold text-slate-500">خصم %</label><input type="number" step="any" class="input input-sm num si-disc" value="${n(b.Supplier_Discount_Pct)}" data-input="recalcSI"></div>
      </div>
      <div class="flex items-center justify-between mt-3 text-[12.5px] border-t border-slate-100 pt-2.5">
        <label class="flex items-center gap-1.5 text-slate-600 text-xs font-semibold cursor-pointer"><input type="checkbox" class="w-4 h-4 accent-brand-700 si-np"> لم يُطبع بعد</label>
        <div class="flex items-center gap-2 text-slate-500 text-xs">
          <span>تكلفة النسخة: <b class="si-unit num text-slate-800 font-bold"></b></span>
          <span>·</span>
          <span>الإجمالي: <b class="si-line num text-brand-800 font-bold"></b></span>
        </div>
        <span class="si-var"></span>
      </div></article>`; }).join("")}</div>`
    : `<div class="card">${UI.empty("truck", "لا توجد كتب لهذه المكتبة")}</div>`}
  <div class="sticky bottom-[calc(4.3rem+env(safe-area-inset-bottom))] md:bottom-4 z-20 mt-4">
    <div class="card p-3.5 sm:p-4 shadow-lift flex flex-wrap items-center gap-x-6 gap-y-2 bg-white/95 backdrop-blur-sm ring-1 ring-brand-200">
      <div class="text-[13px] text-slate-600">بعد خصم الأصناف: <b id="siAfter" class="num text-slate-900 font-bold"></b></div>
      <div class="text-[13px] text-brand-700">خصم كمية الفاتورة (<span id="siVolPctLbl" class="num font-bold">${defVol}</span>%): <b id="siVolAmt" class="num font-bold"></b></div>
      <div class="text-[13px] text-rose-600">مطالبة تالف: <b id="siDmg" class="num font-bold"></b></div>
      <div class="flex-1 text-[15px] font-bold text-brand-800">الصافي المستحق للمكتبة: <span id="siNet" class="num text-lg"></span></div>
      ${canSubmit && books.length ? `<button class="btn btn-success" data-act="submitSI">${ic("clipboard-check")} اعتماد الفاتورة</button>` : ""}
    </div></div>
  <div class="h-4"></div>
  ${UI.section(`${ic("receipt", "text-brand-600")} فواتير المكتبة المسجلة`, "", UI.table([
    { t: "المرجع", v: h => `<b>${esc(h.Internal_Ref_No)}</b><div class="text-[11.5px] text-slate-400">${esc(h.Supplier_Invoice_No)}</div>` },
    { t: "المرحلة", v: "Phase_ID" },
    { t: "التاريخ", cls: "num", v: h => esc(day(h.Invoice_Date)) },
    { t: "بعد خصم الأصناف", cls: "num", v: h => fmt(h.Total_After_Item_Discount) },
    { t: "خصم الكمية على الفاتورة", cls: "num", v: h => `${fmt(h.Volume_Discount_Amount)} <span class="text-[11px] text-brand-700 font-semibold">(${fmt(h.Volume_Discount_Pct !== undefined && h.Volume_Discount_Pct !== "" ? h.Volume_Discount_Pct : 3)}%)</span>` },
    { t: "الصافي", cls: "num", v: h => `<b>${fmt(h.Net_Payable_Amount)}</b>` },
    { t: "تالف", cls: "num", v: h => fmt(h.Damaged_Claim_Amount) },
    { t: "الحالة", v: h => esc(h.Status) + (n(h.Variance_Amount) ? ` ${pill("", "فرق " + fmt(h.Variance_Amount), "red")}` : "") }
  ], d.supInvHeaders.slice().reverse(), { maxH: 420, emptyIcon: "receipt", empty: "لا فواتير مسجلة" }))}`;
  recalcSI();
});
on("pickSup", v => { Q.sup = v; Shell.rerender(); });
on("siVolPreset", (v, btn) => {
  const inp = $("#siVol");
  if (inp) {
    inp.value = btn.dataset.v;
    recalcSI();
  }
});
on("siFilter", v => {
  const q = String(v || "").trim().toLowerCase();
  $$(".si-row").forEach(el => {
    const s = el.dataset.search || "";
    el.classList.toggle("hidden", !!q && !s.includes(q));
  });
});
on("siFillReq", () => {
  $$(".si-row:not(.hidden)").forEach(el => {
    const rec = el.querySelector(".si-rec"), dmg = el.querySelector(".si-dmg");
    if (rec) rec.value = el.dataset.ord || "0";
    if (dmg) dmg.value = "0";
  });
  recalcSI();
});
on("siZeroReq", () => {
  $$(".si-row:not(.hidden)").forEach(el => {
    const rec = el.querySelector(".si-rec"), dmg = el.querySelector(".si-dmg");
    if (rec) rec.value = "0";
    if (dmg) dmg.value = "0";
  });
  recalcSI();
});

function recalcSI() {
  const vol = n(($("#siVol") || {}).value);
  let after = 0, dmgAmt = 0;
  $$(".si-row").forEach(tr => {
    const g = c => n(tr.querySelector(c).value), rec = g(".si-rec"), dmg = g(".si-dmg"), cover = g(".si-cover"), disc = g(".si-disc"), ord = n(tr.dataset.ord);
    const first = r2(cover * (1 - disc / 100));
    const lineTotal = r2(first * (rec + dmg));
    after += lineTotal;
    dmgAmt += r2(first * dmg);
    tr.querySelector(".si-unit").textContent = fmt(first) + " ج.م";
    tr.querySelector(".si-line").textContent = fmt(lineTotal) + " ج.م";
    const v = rec + dmg - ord;
    tr.querySelector(".si-var").innerHTML = !ord && !rec && !dmg ? "" : v === 0 ? pill("EXACT") : pill("", (v > 0 ? "+" : "") + v, v < 0 ? "red" : "amber");
  });
  after = r2(after);
  const va = r2(after * vol / 100);
  const net = r2(after - va);
  const stated = n(($("#siStated") || {}).value);
  const diff = stated ? r2(stated - net) : 0;

  if ($("#siAfter")) $("#siAfter").textContent = moneyTxt(after);
  if ($("#siVolAmt")) $("#siVolAmt").textContent = moneyTxt(va);
  if ($("#siVolPctLbl")) $("#siVolPctLbl").textContent = fmt(vol);
  if ($("#siNet")) $("#siNet").textContent = moneyTxt(net);
  if ($("#siDmg")) $("#siDmg").textContent = moneyTxt(dmgAmt);
  if ($("#siDiffBadge")) {
    if (!stated) {
      $("#siDiffBadge").innerHTML = "";
    } else if (Math.abs(diff) < 0.01) {
      $("#siDiffBadge").innerHTML = `<span class="pill pill-green">${ic("check")} مطابقة تامة مع فاتورة المكتبة (${fmt(stated)} ج.م)</span>`;
    } else {
      $("#siDiffBadge").innerHTML = `<span class="pill pill-red">${ic("triangle-alert")} فرق مع فاتورة المكتبة: ${diff > 0 ? "+" : ""}${fmt(diff)} ج.م (المُدخل ${fmt(stated)} مقابل صافي محسوب ${fmt(net)})</span>`;
    }
  }
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
    { t: "الكتاب", v: i => `<b>${esc(bookName(b, i.Book_ID))}</b>${bookSub(b, i.Book_ID)}` },
    { t: "الموظف", v: i => `${esc(empName(e, i.Emp_ID))} <span class="text-slate-400 text-xs">(${esc(i.Emp_ID)})</span>` },
    { t: "الأسبقية", cls: "num", v: i => `<span dir="ltr" class="text-xs">${esc(i.Priority_Timestamp)}</span>${n(i.Tranche_No) > 1 ? ` <span class="pill pill-gray">ش${esc(i.Tranche_No)}</span>` : ""}${i.Carried_From_Item_ID ? ` <span class="pill pill-blue">مُرحَّل</span>` : ""}` },
    { t: "محجوز", cls: "num", v: i => fmt(i.Requested_Qty) }, { t: "مخصص", cls: "num", v: i => `<b class="text-brand-800">${fmt(i.Allocated_Qty)}</b>` }, { t: "مُسلَّم", cls: "num", v: i => fmt(i.Delivered_Qty) },
    { t: "الحالة", v: i => pill(i.Allocation_Status) + (i.Unallocated_Reason ? `<div class="text-[11px] text-slate-400 mt-1">${esc(i.Unallocated_Reason)}</div>` : "") + (isTrue(i.Is_Manual_Exception) ? `<div class="mt-1">${pill("", "استثناء: " + i.Exception_Reason, "blue")}</div>` : "") },
    { t: "", actions: true, v: i => can("MANUAL_ALLOCATION_OVERRIDE") ? `<button class="act-ic act-ic-edit" data-act="override" data-id="${esc(i.Res_Item_ID)}" title="تعديل التخصيص يدوياً" aria-label="تعديل التخصيص يدوياً">${ic("pencil")}</button>` : "" }
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
        <div class="flex-1 min-w-0"><div class="text-[13.5px] font-semibold text-slate-800 truncate">${esc(bookName(b, i.Book_ID))}</div>${bookSub(b, i.Book_ID)}<div class="text-[11.5px] text-slate-500 num">مخصص ${fmt(i.Allocated_Qty)} · مُسلَّم ${fmt(i.Delivered_Qty)}${n(i.Returned_Qty) ? ` · مرتجع ${fmt(i.Returned_Qty)}` : ""}</div></div>
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
      { t: "", actions: true, v: x => `<button class="act-ic act-ic-edit" data-act="printDoc" data-id="${esc(x.Printed_Receipt_No)}" title="طباعة المستند" aria-label="طباعة المستند">${ic("printer")}</button>` }
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
  const f = lines[0], title = f.Doc_Type === "EMP_DELIVERY" ? "إذن تسليم كتب" : "إذن ارتجاع كتب";
  Doc.show(title + " " + no, Doc.delivery({ title, no, date: f.Trans_Date, emp: { name: empName(e, f.Party_ID), id: f.Party_ID }, lines: lines.map(l => ({ code: l.Book_ID, name: bookName(b, l.Book_ID), qty: n(l.Qty) })), note: f.Received_By ? "المستلم: " + f.Received_By + " · المسلِّم: " + (f.Handled_By || "") : "" }), { file: no });
}
on("printDoc", id => printDoc(id));

// ============================================================ شاشة يوم التسليم (شباك الخدمة)
/** موظف واحد في كل مرة: ابحث برقمه ← حصّل ما عليه ← سلّم كتبه، مع عداد تقدّم اليوم */
function ddState(id) {
  const d = A(), list = phaseItems().filter(i => i.Emp_ID === id && (n(i.Allocated_Qty) > 0 || n(i.Delivered_Qty) > 0));
  const inv = d.empInvoices.find(x => x.Emp_Inv_ID === `EINV-${APP.phaseId}-${id}`) || null;
  const rem = list.reduce((s, i) => s + n(i.Allocated_Qty) - n(i.Delivered_Qty), 0);
  const dueDown = inv ? Math.max(0, n(inv.Down_Payment_Required) - n(inv.Total_Paid_Amount)) : 0;
  const overdue = inv && inv.Invoice_Status === "Overdue";
  return { list, inv, rem, dueDown, overdue, ok: rem > 0 && !dueDown && !overdue };
}
function ddCard(id) {
  const { e, b } = maps(), emp = e[id];
  if (!emp) return `<div class="card card-pad text-center text-rose-600 font-semibold">لا يوجد موظف بالرقم ${esc(id)}</div>`;
  const s = ddState(id), inv = s.inv;
  if (!s.list.length) return `<div class="card card-pad">${UI.empty("package-x", empName(e, id), "لا توجد له كتب مخصصة في هذه المرحلة.")}</div>`;
  const step = s.rem === 0 ? ["تم تسليم كل الكتب", "gray", "circle-check"] : s.dueDown ? [`يسدد المقدم أولاً: ${moneyTxt(s.dueDown)}`, "red", "hand-coins"] : s.overdue ? ["عليه أقساط متأخرة", "red", "triangle-alert"] : ["جاهز للتسليم", "green", "package-check"];
  const tone = { red: "bg-rose-50 text-rose-700 ring-rose-200", green: "bg-emerald-50 text-emerald-700 ring-emerald-200", gray: "bg-slate-50 text-slate-600 ring-slate-200" }[step[1]];
  return `<article class="card overflow-hidden">
    <div class="flex items-center gap-3 p-4">${UI.avatar(empName(e, id), "w-14 h-14 text-lg")}
      <div class="flex-1 min-w-0"><div class="font-display font-bold text-lg text-slate-900 truncate">${esc(empName(e, id))}</div>
      <div class="text-[13px] text-slate-500 num truncate">${esc(id)}${emp.Department ? " · " + esc(emp.Department) : ""}${emp.Mobile ? ` · <a class="text-brand-700" href="tel:${esc(emp.Mobile)}">${esc(emp.Mobile)}</a>` : ""}</div></div></div>
    <div class="mx-4 rounded-2xl ring-1 ${tone} px-4 py-3 flex items-center gap-2 font-bold text-[15px]">${ic(step[2])} ${esc(step[0])}</div>
    ${inv ? `<div class="grid grid-cols-3 gap-2 p-4">${UI.stat("الفاتورة", fmt(inv.Net_Final_Invoice_Amount))}${UI.stat("المسدد", fmt(inv.Total_Paid_Amount))}${UI.stat("المتبقي", `<span class="${n(inv.Remaining_Balance) > 0 ? "text-rose-600" : "text-emerald-600"}">${fmt(inv.Remaining_Balance)}</span>`)}</div>` : ""}
    <ul class="divide-y divide-slate-100 border-t border-slate-100">${s.list.map(i => { const r = n(i.Allocated_Qty) - n(i.Delivered_Qty); return `<li class="flex items-center gap-3 px-4 py-2.5">
      <span class="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${r > 0 ? "bg-brand-50 text-brand-700" : "bg-emerald-50 text-emerald-600"}">${r > 0 ? `<b class="num">${r}</b>` : ic("check")}</span>
      <div class="flex-1 min-w-0"><div class="text-[14px] font-semibold text-slate-800 truncate">${esc(bookName(b, i.Book_ID))}</div>${bookSub(b, i.Book_ID, `${i.Beneficiary ? ` · <span class="text-sky-700 font-semibold">لـ ${esc(i.Beneficiary)}</span>` : ""}${n(i.Delivered_Qty) ? ` · سُلّم ${fmt(i.Delivered_Qty)}` : ""}`)}</div></li>`; }).join("")}</ul>
    <div class="p-3 bg-slate-50/70 grid gap-2">
      ${inv && n(inv.Remaining_Balance) > 0 && can("RECORD_EMPLOYEE_PAYMENT") ? `<button class="btn ${s.dueDown || s.overdue ? "btn-primary" : "btn-outline"} w-full !h-12" data-act="collect" data-id="${esc(inv.Emp_Inv_ID)}">${ic("hand-coins")} تحصيل${s.dueDown ? " المقدم " + fmt(s.dueDown) : ""}</button>` : ""}
      ${s.rem > 0 && can("EXECUTE_BOOK_DELIVERY") ? `<button class="btn ${s.ok ? "btn-success" : "btn-outline"} w-full !h-12" data-act="deliver" data-id="${esc(id)}">${ic("check-check")} تسليم ${fmt(s.rem)} نسخة وطباعة الإذن</button>` : ""}
      <button class="btn btn-ghost w-full" data-act="ddNext">${ic("arrow-right")} الموظف التالي</button></div></article>`;
}
function ddMatches() {
  const { e } = maps(), q = (Q.ddq || "").trim().toLowerCase(); if (!q) return "";
  const ids = [...new Set(phaseItems().filter(i => n(i.Allocated_Qty) > 0).map(i => i.Emp_ID))].filter(id => (id + " " + empName(e, id)).toLowerCase().includes(q)).slice(0, 8);
  if (!ids.length) return `<div class="text-sm text-slate-500 p-3">لا نتائج</div>`;
  return `<div class="card divide-y divide-slate-100">${ids.map(id => { const s = ddState(id); return `<button class="w-full flex items-center gap-3 px-4 py-3 text-right" data-act="ddPick" data-id="${esc(id)}">${UI.avatar(empName(e, id), "w-9 h-9 text-xs")}<div class="flex-1 min-w-0"><div class="font-semibold truncate">${esc(empName(e, id))}</div><div class="text-[12px] text-slate-500 num">${esc(id)}</div></div>${s.rem === 0 ? pill("", "استلم", "gray") : s.ok ? pill("", "جاهز", "green") : pill("", "عليه سداد", "red")}</button>`; }).join("")}</div>`;
}
Router.add("/a/dday", view => {
  if (noPhase(view)) return;
  const d = A(), items = phaseItems().filter(i => n(i.Allocated_Qty) > 0), today = new Date().toISOString().slice(0, 10);
  const emps = [...new Set(items.map(i => i.Emp_ID))], done = emps.filter(id => ddState(id).rem === 0).length;
  const alloc = sum(items, "Allocated_Qty"), deliv = sum(items, "Delivered_Qty");
  const cashToday = d.empPayments.filter(p => !isTrue(p.Is_Voided) && day(p.Payment_Date) === today && String(p.Emp_Inv_ID || "").indexOf("-" + APP.phaseId + "-") > 0).reduce((s, p) => s + n(p.Amount), 0);
  const delToday = new Set(d.deliveryReturns.filter(x => x.Doc_Type === "EMP_DELIVERY" && x.Phase_ID === APP.phaseId && day(x.Trans_Date) === today).map(x => x.Party_ID)).size;
  view.innerHTML = UI.pageHead("يوم التسليم", "ابحث برقم الموظف ← حصّل ما عليه ← سلّم كتبه")
    + `<div class="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-4">${UI.kpi("استلموا كتبهم", `${fmt(done)} / ${fmt(emps.length)}`, { icon: "users", tone: "brand", pct: emps.length ? done / emps.length * 100 : 0 })}${UI.kpi("النسخ المسلّمة", `${fmt(deliv)} / ${fmt(alloc)}`, { icon: "package-check", tone: "green", pct: alloc ? deliv / alloc * 100 : 0 })}${UI.kpi("سُلِّموا اليوم", fmt(delToday), { icon: "calendar-check", tone: "amber" })}${UI.kpi("محصّل اليوم", money(cashToday), { icon: "banknote", tone: "green" })}</div>
    <div class="max-w-2xl mx-auto grid gap-3">
      <div class="input-icon">${ic("search")}<input id="ddq" class="input !h-14 !text-lg" inputmode="search" placeholder="رقم الموظف أو اسمه" value="${esc(Q.ddq || "")}" data-input="ddq" autocomplete="off"></div>
      <div id="ddRes">${Q.ddId ? ddCard(Q.ddId) : ddMatches()}</div></div><div class="h-5"></div>`;
  if (!Q.ddId) setTimeout(() => { const i = $("#ddq"); if (i && matchMedia("(min-width:768px)").matches) i.focus(); }, 50);
});
on("ddq", v => { Q.ddq = v; Q.ddId = ""; const { e } = maps(), t = v.trim(); if (e[t] && phaseItems().some(i => i.Emp_ID === t)) Q.ddId = t; const r = $("#ddRes"); if (r) r.innerHTML = Q.ddId ? ddCard(Q.ddId) : ddMatches(); });
on("ddPick", id => { Q.ddId = id; Q.ddq = id; Shell.rerender(); });
on("ddNext", () => { Q.ddId = ""; Q.ddq = ""; Shell.rerender(); setTimeout(() => { const i = $("#ddq"); if (i) i.focus(); }, 80); });

// ============================================================ التحصيل والفواتير
const resHeaderOf = id => A().resHeaders.find(h => h.Res_ID === id) || {};
on("adjInv", async id => {
  const i = A().empInvoices.find(x => x.Emp_Inv_ID === id), h = resHeaderOf(i.Res_ID), { e } = maps();
  const cur = n(h.Invoice_Adjustment), base = n(i.Net_Final_Invoice_Amount) - cur;
  const v = await UI.form({ title: "تعديل الفاتورة", sub: `${empName(e, i.Emp_ID)} · ${id}`,
    intro: "خصم أو إضافة على صافي الفاتورة بسبب موثق، ويُعاد بناء الأقساط تلقائياً. لتغيير الكتب استخدم «الحجز».",
    fields: [{ name: "_s", type: "html", html: `<div class="grid grid-cols-3 gap-2">${UI.stat("قيمة الكتب", fmt(base))}${UI.stat("التعديل الحالي", fmt(cur))}${UI.stat("المسدد", fmt(i.Total_Paid_Amount))}</div>` },
      { name: "kind", label: "النوع", type: "seg", value: cur > 0 ? "add" : "disc", options: [["disc", "خصم"], ["add", "إضافة"], ["none", "بلا تعديل"]] },
      { name: "amount", label: "القيمة (ج.م)", type: "number", value: Math.abs(cur) || "", min: 0 },
      { name: "reason", label: "السبب", value: h.Adjustment_Reason || "", placeholder: "مثال: خصم تأخير توريد" }], ok: "حفظ التعديل", icon: "pencil" });
  if (!v) return;
  const amt = v.kind === "none" ? 0 : (v.kind === "disc" ? -1 : 1) * n(v.amount);
  await act("ADJUST_EMP_INVOICE", { invId: id, amount: amt, reason: v.reason });
});
on("delInv", async id => {
  const i = A().empInvoices.find(x => x.Emp_Inv_ID === id), { e } = maps();
  const v = await UI.form({ title: "حذف الفاتورة", sub: `${empName(e, i.Emp_ID)} · ${id}`, danger: true,
    intro: "يُلغى حجز الموظف في هذه المرحلة وتتحرر نسخه المخصصة للتوزيع على غيره. لا يمكن الحذف إن وُجدت إيصالات سارية أو كتب مُسلَّمة.",
    fields: [{ name: "reason", label: "سبب الحذف", required: true }], ok: "حذف الفاتورة", icon: "trash-2" });
  if (v) await act("DELETE_EMP_INVOICE", { invId: id, reason: v.reason });
});

function finList() {
  const d = A(), { e } = maps(), q = (Q.fin || "").toLowerCase(), f = Q.finF || "";
  const invs = d.empInvoices.filter(i => i.Phase_ID === APP.phaseId && (!q || (i.Emp_ID + empName(e, i.Emp_ID)).toLowerCase().includes(q))
    && (!f || (f === "due" ? n(i.Remaining_Balance) > 0 : f === "down" ? n(i.Total_Paid_Amount) < n(i.Down_Payment_Required) : f === "credit" ? n(i.Credit_Balance) > 0 : i.Invoice_Status === f)));
  return UI.table([
    { t: "الموظف", v: i => `<div class="flex items-center gap-2.5">${UI.avatar(empName(e, i.Emp_ID), "w-9 h-9 text-xs")}<div><div class="font-semibold text-slate-900">${empLink(i.Emp_ID, empName(e, i.Emp_ID))}</div><div class="text-[11.5px] text-slate-400 num">${esc(i.Emp_ID)}</div></div></div>` },
    { t: "الصافي", cls: "num", v: i => { const h = resHeaderOf(i.Res_ID), a = n(h.Invoice_Adjustment); return `<b>${fmt(i.Net_Final_Invoice_Amount)}</b>` + (a ? `<div class="text-[11px] ${a < 0 ? "text-emerald-600" : "text-amber-600"}" title="${esc(h.Adjustment_Reason)}">${a < 0 ? "خصم" : "إضافة"} ${fmt(Math.abs(a))}</div>` : ""); } }, { t: "المقدم", cls: "num", v: i => fmt(i.Down_Payment_Required) }, { t: "المسدد", cls: "num", v: i => `<span class="text-emerald-600">${fmt(i.Total_Paid_Amount)}</span>` },
    { t: "المتبقي", cls: "num", v: i => `<b class="${n(i.Remaining_Balance) ? "text-rose-600" : "text-slate-400"}">${fmt(i.Remaining_Balance)}</b>` + (n(i.Credit_Balance) ? `<div class="text-emerald-600 text-[11px]">له ${fmt(i.Credit_Balance)}</div>` : "") },
    { t: "الخطة", v: i => esc(ar(i.Payment_Plan_Type)) + (n(i.Installments_Count) ? ` · ${i.Installments_Count}` : "") }, { t: "الحالة", v: i => pill(i.Invoice_Status) },
    { t: "إجراءات", actions: true, v: i => `<div class="inline-flex items-center gap-1 whitespace-nowrap">`
      + (n(i.Remaining_Balance) > 0 && can("RECORD_EMPLOYEE_PAYMENT") ? `<button class="btn btn-primary btn-xs" data-act="collect" data-id="${esc(i.Emp_Inv_ID)}">${ic("hand-coins")} تحصيل</button>` : "")
      + (n(i.Credit_Balance) && can("REFUND_EMPLOYEE_CREDIT") ? `<button class="btn btn-outline btn-xs" data-act="refund" data-id="${esc(i.Emp_Inv_ID)}">${ic("undo-2")} رد الرصيد</button>` : "")
      + (can("CUSTOMIZE_EMP_INSTALLMENTS") ? `<button class="act-ic act-ic-copy" data-act="changePlan" data-id="${esc(i.Res_ID)}" title="تعديل خطة السداد" aria-label="تعديل خطة السداد">${ic("calendar-range")}</button>` : "")
      + `<button class="act-ic act-ic-edit" data-act="printInvA" data-id="${esc(i.Emp_Inv_ID)}" title="طباعة الفاتورة" aria-label="طباعة الفاتورة">${ic("printer")}</button>`
      + (can("ADJUST_EMP_INVOICE") ? `<button class="act-ic act-ic-brand" data-act="adjInv" data-id="${esc(i.Emp_Inv_ID)}" title="تعديل الفاتورة (خصم/إضافة)" aria-label="تعديل الفاتورة">${ic("pencil")}</button>` : "")
      + (can("SUBMIT_OR_UPDATE_RESERVATION") ? `<button class="act-ic act-ic-edit" data-act="resEdit" data-id="${esc(i.Emp_ID)}" title="تعديل حجز الكتب" aria-label="تعديل حجز الكتب">${ic("notebook-pen")}</button>` : "")
      + (can("DELETE_EMP_INVOICE") ? `<button class="act-ic act-ic-del" data-act="delInv" data-id="${esc(i.Emp_Inv_ID)}" title="حذف الفاتورة" aria-label="حذف الفاتورة">${ic("trash-2")}</button>` : "")
      + `</div>` }
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
  Doc.show("إيصال " + no, Doc.receipt({ no, date: p.Payment_Date, emp: { name: empName(e, p.Emp_ID), id: p.Emp_ID }, amount: p.Amount, method: p.Payment_Method, ref: p.Transaction_Ref, inv: p.Emp_Inv_ID, net: inv.Net_Final_Invoice_Amount, remaining: inv.Remaining_Balance, collector: p.Collected_By, voided: isTrue(p.Is_Voided), voidReason: p.Void_Reason }), { file: no });
}
/** فاتورة موظف (A5) من بيانات الإدارة */
function invoiceData(invId) {
  const d = A(), i = d.empInvoices.find(x => x.Emp_Inv_ID === invId); if (!i) return null;
  const { e, b } = maps(), emp = e[i.Emp_ID] || {}, h = resHeaderOf(i.Res_ID), ph = d.phases.find(x => x.Phase_ID === i.Phase_ID) || {};
  return { no: i.Emp_Inv_ID, date: i.Issue_Date, phase: ph.Phase_Name || i.Phase_ID, status: i.Invoice_Status, method: i.Payment_Plan_Type,
    emp: { name: emp.Full_Name || i.Emp_ID, id: i.Emp_ID, dept: emp.Department },
    lines: d.resItems.filter(x => x.Res_ID === i.Res_ID).map(x => ({ code: x.Book_ID, name: bookName(b, x.Book_ID), grade: (b[x.Book_ID] || {}).Grade, ben: x.Beneficiary, alloc: n(x.Allocated_Qty), deliv: n(x.Delivered_Qty), ret: n(x.Returned_Qty), price: x.Unit_Emp_Price, cover: x.Unit_Cover_Price })),
    adj: n(h.Invoice_Adjustment), adjReason: h.Adjustment_Reason, paid: i.Total_Paid_Amount, remaining: i.Remaining_Balance, credit: i.Credit_Balance, down: i.Down_Payment_Required,
    schedule: d.installments.filter(x => x.Emp_Inv_ID === i.Emp_Inv_ID).sort((a, c) => String(a.Due_Date).localeCompare(String(c.Due_Date))).map(x => ({ label: x.Admin_Custom_Notes || "قسط " + x.Installment_No, due: x.Due_Date, amount: x.Scheduled_Amount, paid: x.Paid_Amount, status: x.Status })) };
}
on("printInvA", id => { const d = invoiceData(id); if (d) Doc.show("فاتورة " + id, Doc.invoice(d), { file: id }); });
/** طلب حجز موظف (A5) من بيانات الإدارة */
on("printResA", empId => {
  const d = A(), h = d.resHeaders.find(x => x.Phase_ID === APP.phaseId && x.Emp_ID === empId); if (!h) return toast("لا حجز لهذا الموظف في المرحلة", "info");
  const { e, b } = maps(), emp = e[empId] || {}, lines = resLines(empId);
  Doc.show("طلب حجز " + h.Res_ID, Doc.reservation({ no: h.Res_ID, date: h.Created_At, phase: phaseObj().Phase_Name, status: h.Res_Status === "Cancelled" ? "ملغي" : "مؤكد",
    emp: { name: emp.Full_Name || empId, id: empId, dept: emp.Department, mobile: emp.Mobile },
    lines: Object.entries(lines).map(([k, q]) => { const bk = b[k.split(SEP)[0]] || {}; return { code: bk.Book_ID || k.split(SEP)[0], name: bk.Book_Name, grade: bk.Grade, ben: k.split(SEP)[1], qty: q, cover: bk.Cover_Price, price: bk.Emp_Selling_Price }; }),
    plan: { method: h.Payment_Method_Selected, down: h.Calculated_Down_Payment, count: n(h.Installment_Count), per: h.Installment_Value } }), { file: h.Res_ID });
});
/** أوامر التوريد للمكتبات (A4، صفحة لكل مكتبة) */
on("printPO", () => {
  const d = A(), { b, s } = maps(), snaps = d.poSnapshots.filter(p => p.Phase_ID === APP.phaseId && n(p.Net_Order_To_Supplier_Qty) > 0);
  if (!snaps.length) return toast("لا يوجد مطلوب من المكتبات في هذه المرحلة", "info");
  const bySup = {}; snaps.forEach(p => (bySup[p.Supplier_ID || "—"] = bySup[p.Supplier_ID || "—"] || []).push(p));
  const pages = Object.keys(bySup).map(sid => { const sp = s[sid] || {}, lines = bySup[sid];
    return Doc.purchaseOrder({ no: "PO-" + APP.phaseId + "-" + sid, date: (lines[0].Frozen_At || "").slice(0, 10), phase: phaseObj().Phase_Name, by: lines[0].Frozen_By,
      supplier: { name: sp.Supplier_Name || sid, contact: sp.Contact_Person, phone: sp.Phone, terms: sp.Payment_Terms, returnDays: sp.Return_Policy_Days },
      lines: lines.map(p => { const bk = b[p.Book_ID] || {}; return { code: p.Book_ID, name: bk.Book_Name || p.Book_ID, grade: bk.Grade, subject: bk.Subject, qty: n(p.Net_Order_To_Supplier_Qty) }; }).sort((x, y) => String(x.code).localeCompare(String(y.code))) }); }).join("");
  Doc.show("أوامر التوريد · " + phaseObj().Phase_Name, pages, { size: "A4", file: "أمر-توريد-" + APP.phaseId });
});

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
      { t: "إجراءات", actions: true, v: p => isTrue(p.Is_Voided) ? pill("", "ملغى: " + (p.Void_Reason || ""), "red") : `<div class="inline-flex items-center gap-1 whitespace-nowrap"><button class="act-ic act-ic-edit" data-act="printRcpt" data-id="${esc(p.Receipt_No)}" title="طباعة الإيصال" aria-label="طباعة الإيصال">${ic("printer")}</button>` + (can("VOID_EMPLOYEE_PAYMENT") ? `<button class="act-ic act-ic-del" data-act="voidRcpt" data-id="${esc(p.Receipt_No)}" title="إلغاء الإيصال" aria-label="إلغاء الإيصال">${ic("ban")}</button>` : "") + `</div>` }
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

// ============================================================ الحجوزات (إضافة / تعديل / حذف نيابة عن الموظف)
const SEP = "|";
const resLines = (empId) => {
  const m = {};
  A().resItems.filter(i => i.Phase_ID === APP.phaseId && i.Emp_ID === empId && !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward" && n(i.Requested_Qty) > 0)
    .forEach(i => { const k = i.Book_ID + SEP + (i.Beneficiary || ""); m[k] = (m[k] || 0) + n(i.Requested_Qty); });
  return m;
};
function resRows() {
  const d = A(), { e } = maps(), q = (Q.res || "").toLowerCase(), showCancelled = Q.resF === "c";
  const items = d.resItems.filter(i => i.Phase_ID === APP.phaseId);
  return d.resHeaders.filter(h => h.Phase_ID === APP.phaseId && (showCancelled ? h.Res_Status === "Cancelled" : h.Res_Status !== "Cancelled"))
    .map(h => { const its = items.filter(i => i.Res_ID === h.Res_ID && !String(i.Allocation_Status).startsWith("Cancelled") && n(i.Requested_Qty) > 0);
      return { h, emp: e[h.Emp_ID] || {}, copies: sum(its, "Requested_Qty"), books: new Set(its.map(i => i.Book_ID)).size, rel: [...new Set(its.map(i => i.Beneficiary).filter(Boolean))], delivered: sum(its, "Delivered_Qty") }; })
    .filter(r => !q || (r.h.Emp_ID + (r.emp.Full_Name || "") + (r.emp.Department || "") + r.rel.join(" ")).toLowerCase().includes(q))
    .sort((a, b) => String(b.h.Last_Modified_At).localeCompare(String(a.h.Last_Modified_At)));
}
function resTable() {
  const rows = resRows(), edit = can("SUBMIT_OR_UPDATE_RESERVATION");
  return UI.table([
    { t: "الموظف", v: r => `<div class="flex items-center gap-2.5">${UI.avatar(r.emp.Full_Name || r.h.Emp_ID, "w-9 h-9 text-xs")}<div><div class="font-semibold text-slate-900">${empLink(r.h.Emp_ID, r.emp.Full_Name || r.h.Emp_ID)}</div><div class="text-[11.5px] text-slate-400"><span class="num">${esc(r.h.Emp_ID)}</span>${r.emp.Department ? " · " + esc(r.emp.Department) : ""}</div></div></div>` },
    { t: "الكتب / النسخ", cls: "num", v: r => `${fmt(r.books)} / <b>${fmt(r.copies)}</b>` + (r.delivered ? `<div class="text-[11px] text-emerald-600">سُلّم ${fmt(r.delivered)}</div>` : "") },
    { t: "القيمة", cls: "num", v: r => `<b>${fmt(r.h.Total_Emp_Value)}</b>` },
    { t: "السداد", v: r => esc(ar(r.h.Payment_Method_Selected)) + (n(r.h.Installment_Count) ? ` · ${r.h.Installment_Count} أقساط` : "") },
    { t: "للأقارب", v: r => r.rel.length ? r.rel.map(x => `<span class="pill pill-blue mb-0.5">${esc(x)}</span>`).join(" ") : `<span class="text-slate-300">—</span>` },
    { t: "آخر تعديل", v: r => `<div class="text-[12px] num">${esc(dt(r.h.Last_Modified_At))}</div>${r.h.Created_By ? `<div class="text-[11px] text-slate-400">أنشأته الإدارة: ${esc(r.h.Created_By)}</div>` : ""}` },
    { t: "إجراءات", actions: true, v: r => `<div class="inline-flex items-center gap-1 whitespace-nowrap"><button class="act-ic act-ic-edit" data-act="printResA" data-id="${esc(r.h.Emp_ID)}" title="طباعة طلب الحجز" aria-label="طباعة طلب الحجز">${ic("printer")}</button>` + (edit ? `<button class="act-ic act-ic-brand" data-act="resEdit" data-id="${esc(r.h.Emp_ID)}" title="تعديل الحجز" aria-label="تعديل الحجز">${ic("pencil")}</button>${r.h.Res_Status !== "Cancelled" && !r.delivered ? `<button class="act-ic act-ic-del" data-act="resDel" data-id="${esc(r.h.Emp_ID)}" title="حذف الحجز" aria-label="حذف الحجز">${ic("trash-2")}</button>` : ""}` : "") + `</div>` }
  ], rows, { maxH: 680, emptyIcon: "notebook-pen", empty: Q.res ? "لا نتائج للبحث" : "لا حجوزات في هذه المرحلة" });
}
Router.add("/a/res", view => {
  if (noPhase(view)) return;
  const all = A().resHeaders.filter(h => h.Phase_ID === APP.phaseId), act1 = all.filter(h => h.Res_Status !== "Cancelled");
  const its = phaseItems(), rel = its.filter(i => i.Beneficiary);
  view.innerHTML = UI.pageHead("الحجوزات", `${esc(phaseObj().Phase_Name)} · إضافة وتعديل وحذف الحجز نيابة عن الموظف`,
      lockedBtn("SUBMIT_OR_UPDATE_RESERVATION", `<button class="btn btn-primary btn-sm" data-act="resNew">${ic("plus")} حجز لموظف</button>`))
    + (() => { const dr = poDrift(APP.phaseId); return dr && (dr.rows.length || dr.changed.length) ? `<a href="#/a/po" class="mb-4 flex items-center gap-3 rounded-2xl bg-amber-50 ring-1 ring-amber-200 text-amber-900 p-3.5 text-sm">${ic("triangle-alert", "text-amber-500 text-lg")}<span class="flex-1">تغيّرت الحجوزات بعد تجميد طلب التوريد (${fmt(dr.changed.length)} موظف). راجع الفرق في صفحة الحصر.</span>${ic("chevron-left")}</a>` : (dr ? `<div class="mb-4 rounded-2xl bg-sky-50 ring-1 ring-sky-100 text-sky-900 p-3 text-[13px] flex gap-2">${ic("info", "mt-0.5")}طلب التوريد مُجمَّد؛ أي تعديل الآن يظهر تنبيهاً بالفرق في صفحة الحصر.</div>` : ""); })()
    + `<div class="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-4">${UI.kpi("حجوزات سارية", fmt(act1.length), { icon: "notebook-pen", tone: "brand" })}${UI.kpi("النسخ", fmt(sum(its, "Requested_Qty")), { icon: "book-open", tone: "blue" })}${UI.kpi("نسخ للأقارب", fmt(sum(rel, "Requested_Qty")), { icon: "users", tone: "gray", foot: `${fmt(new Set(rel.map(i => i.Emp_ID + i.Beneficiary)).size)} قريب` })}${UI.kpi("ملغاة", fmt(all.length - act1.length), { icon: "ban", tone: "red" })}</div>
    <section class="card card-pad"><div class="flex flex-wrap items-center gap-3 mb-4">${searchBox("qRes", Q.res, "بحث بالموظف أو جهة العمل أو القريب")}
      <div class="scroll-x !mx-0 !px-0">${[["", "السارية"], ["c", "الملغاة"]].map(f => `<button class="chip !h-9" data-act="resF" data-id="${f[0]}" aria-pressed="${(Q.resF || "") === f[0]}">${f[1]}</button>`).join("")}</div>
      <button class="btn btn-ghost btn-sm" data-act="exportRes">${ic("download")} تصدير</button></div>
      <div id="resList">${resTable()}</div></section>`;
});
on("qRes", v => { Q.res = v.trim(); rerenderList("resList", resTable); });
on("resF", v => { Q.resF = v; Shell.rerender(); });
on("exportRes", () => { const { b, e } = maps(); exportCSV("حجوزات " + (phaseObj().Phase_Name || ""), ["رقم الموظف", "الاسم", "جهة العمل", "الكود", "الكتاب", "المستفيد", "محجوز", "مخصص", "مُسلَّم", "سعر الموظف", "الأسبقية"],
  phaseItems().map(i => [i.Emp_ID, empName(e, i.Emp_ID), (e[i.Emp_ID] || {}).Department, i.Book_ID, bookName(b, i.Book_ID), i.Beneficiary || "العضو", i.Requested_Qty, i.Allocated_Qty, i.Delivered_Qty, i.Unit_Emp_Price, i.Priority_Timestamp])); });
on("resDel", async empId => {
  const { e } = maps();
  if (!(await UI.confirm({ title: "حذف الحجز", message: `حذف كل حجز ${empName(e, empId)} في هذه المرحلة؟ تتحرر نسخه المخصصة للتوزيع.`, ok: "حذف الحجز", tone: "danger" }))) return;
  const h = A().resHeaders.find(x => x.Phase_ID === APP.phaseId && x.Emp_ID === empId) || {};
  await act("SUBMIT_OR_UPDATE_RESERVATION", { empId, phaseId: APP.phaseId, items: [], paymentMethod: h.Payment_Method_Selected || "CASH" });
});

// اختيار الموظف لحجز جديد
on("resNew", () => {
  Q.pickEmp = "";
  const m = UI.open(`${searchBox("qPickEmp", "", "اكتب الاسم أو الرقم الوظيفي")}<div id="pickEmpList" class="mt-3">${pickEmpList()}</div>`, { title: "حجز لموظف", sub: "اختر الموظف أولاً" });
  setTimeout(() => { const i = m.body && m.body.querySelector("input"); if (i) i.focus(); }, 50);
});
function pickEmpList() {
  const q = (Q.pickEmp || "").toLowerCase();
  if (q.length < 2) return `<div class="text-sm text-slate-500 text-center py-6">اكتب حرفين على الأقل للبحث في ${fmt(A().employees.length)} موظف.</div>`;
  const list = A().employees.filter(x => (x.Emp_ID + " " + x.Full_Name + " " + (x.Department || "")).toLowerCase().includes(q)).slice(0, 30);
  return list.length ? `<ul class="divide-y divide-slate-100">${list.map(x => `<li><button class="w-full flex items-center gap-3 py-2.5 text-right hover:bg-slate-50 rounded-lg px-1" data-act="resPick" data-id="${esc(x.Emp_ID)}">${UI.avatar(x.Full_Name, "w-9 h-9 text-xs")}<span class="flex-1 min-w-0"><span class="block font-semibold text-[13.5px] truncate">${esc(x.Full_Name)}</span><span class="block text-[11.5px] text-slate-400 truncate"><span class="num">${esc(x.Emp_ID)}</span> · ${esc(x.Department || "")}</span></span>${x.Employment_Status !== "ساري" ? pill("", "موقوف", "red") : ""}</button></li>`).join("")}</ul>` : UI.empty("search", "لا نتائج");
}
on("qPickEmp", v => { Q.pickEmp = v.trim(); rerenderList("pickEmpList", pickEmpList); });
on("resPick", id => { const top = UI._stack[UI._stack.length - 1]; if (top) UI.close(top); setTimeout(() => ACTIONS.resEdit(id), 50); });

// محرر الحجز
const Ed = { s: null };
on("resEdit", empId => {
  if (!APP.phaseId) return toast("لا توجد مرحلة.", "info");
  const h = A().resHeaders.find(x => x.Phase_ID === APP.phaseId && x.Emp_ID === empId) || {}, st = A().settingsMap || {};
  const lines = resLines(empId);
  Ed.s = { empId, lines, orig: JSON.stringify(lines), ben: "", bens: [...new Set(Object.keys(lines).map(k => k.split(SEP)[1]).filter(Boolean))], q: "", grade: "", subject: "",
    method: h.Payment_Method_Selected || "INSTALLMENT", count: n(h.Installment_Count) || n(st.DEFAULT_INSTALLMENT_COUNT) || 2,
    downType: h.Down_Payment_Type || "PERCENTAGE", down: h.Down_Payment_Input !== undefined && h.Down_Payment_Input !== "" ? n(h.Down_Payment_Input) : n(st.MIN_DOWN_PAYMENT_PCT) || 20 };
  const { e } = maps(), emp = e[empId] || {};
  Ed.m = UI.open(`<div id="edBody">${edBody()}</div>`, { title: (h.Res_ID ? "تعديل حجز " : "حجز جديد لـ ") + esc(emp.Full_Name || empId), sub: `<span class="num">${esc(empId)}</span> · ${esc(emp.Department || "")} · ${esc(phaseObj().Phase_Name || "")}`, wide: true,
    footer: `<div class="flex flex-wrap items-center justify-between gap-3"><div id="edTotal" class="text-sm"></div><button class="btn btn-primary" data-act="edSave">${ic("check")} حفظ الحجز</button></div>` });
  edTotals();
});
const edRefresh = () => { const el = $("#edBody"); if (el) el.innerHTML = edBody(); edTotals(); };
function edTotals() {
  const { b } = maps(); let c = 0, v = 0;
  Object.entries(Ed.s.lines).forEach(([k, q]) => { const bk = b[k.split(SEP)[0]] || {}; c += q; v += q * n(bk.Emp_Selling_Price); });
  const el = $("#edTotal"); if (el) el.innerHTML = `<b class="num">${fmt(c)}</b> نسخة · <b class="num text-brand-800">${fmt(v)}</b> ج.م`;
}
function edBody() {
  const s = Ed.s, d = A(), { b } = maps(), mx = n(d.settingsMap.MAX_QTY_PER_BOOK) || 3, c = d.catalog || {};
  const benChip = (val, label) => `<button class="chip !h-8 !text-xs" data-act="edBen" data-id="${esc(val)}" aria-pressed="${s.ben === val}">${label}</button>`;
  const q = s.q.toLowerCase();
  const found = (q.length >= 2 || s.grade || s.subject) ? d.books.filter(x => ["Available", "Not_Yet_Printed"].includes(x.Book_Status)
    && (!s.grade || x.Grade === s.grade) && (!s.subject || x.Subject === s.subject) && (!q || (x.Book_ID + " " + x.Book_Name + " " + x.Subject + " " + x.Grade).toLowerCase().includes(q))).slice(0, 40) : [];
  const step = (k, qty) => `<div class="stepper scale-90 origin-left"><button data-act="edInc" data-id="${esc(k)}" ${qty >= mx ? "disabled" : ""}>${ic("plus")}</button><span>${qty}</span><button data-act="edDec" data-id="${esc(k)}">${ic(qty === 1 ? "trash-2" : "minus")}</button></div>`;
  const groups = {}; Object.keys(s.lines).forEach(k => { const ben = k.split(SEP)[1] || ""; (groups[ben] = groups[ben] || []).push(k); });
  const benOrder = ["", ...s.bens.filter(x => groups[x] || x === s.ben)];
  const sel = (k, label, opts) => `<select class="input !h-10 !text-sm" data-change="edF" data-k="${k}"><option value="">${label}</option>${opts.map(o => `<option ${s[k] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  const frozen = A().poSnapshots.some(p => p.Phase_ID === APP.phaseId);
  return `${frozen ? `<div class="mb-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 text-amber-900 text-[12.5px] p-2.5 flex gap-2">${ic("triangle-alert", "text-amber-500 mt-0.5")}طلب التوريد مُجمَّد لهذه المرحلة؛ أي زيادة ستظهر كفرق يحتاج توريداً إضافياً.</div>` : ""}
  <div class="mb-3"><div class="label">الحجز لـ</div><div class="flex flex-wrap gap-1.5">${benChip("", `${ic("user")} العضو وأبناؤه`)}${s.bens.map(x => benChip(x, `${ic("users")} ${esc(x)}`)).join("")}<button class="chip !h-8 !text-xs" data-act="edAddBen">${ic("plus")} قريب</button></div></div>
  <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">${searchBox("edQ", s.q, "ابحث عن كتاب بالاسم أو الكود")}${sel("grade", "كل الصفوف", (c.grades || []).map(g => g.label))}${sel("subject", "كل المواد", c.subjects || [])}</div>
  <div class="mt-2 max-h-56 overflow-y-auto rounded-xl ring-1 ring-slate-100">${found.length ? `<ul class="divide-y divide-slate-100">${found.map(x => { const k = x.Book_ID + SEP + s.ben, qty = s.lines[k] || 0;
    return `<li class="flex items-center gap-3 px-3 py-2"><div class="flex-1 min-w-0"><div class="font-semibold text-[13px] truncate">${esc(x.Book_Name)}</div>${bookSub(b, x.Book_ID, ` · <span class="num font-semibold text-slate-700">${fmt(x.Emp_Selling_Price)}</span> ج.م`)}</div>${qty ? step(k, qty) : `<button class="btn btn-soft btn-xs" data-act="edInc" data-id="${esc(k)}">${ic("plus")} أضف</button>`}</li>`; }).join("")}</ul>`
    : `<div class="text-[12.5px] text-slate-400 text-center py-5">${q.length || s.grade || s.subject ? "لا كتب مسعّرة مطابقة" : "ابحث أو اختر صفاً/مادة لإضافة كتب"}</div>`}</div>
  <div class="mt-4"><div class="label">الكتب في الحجز</div>${Object.keys(s.lines).length ? benOrder.filter(x => groups[x]).map(ben => `<div class="mt-2"><div class="text-[12px] font-bold ${ben ? "text-sky-700" : "text-brand-700"} mb-1">${ben ? "لـ " + esc(ben) : "للعضو وأبنائه"}</div><ul class="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-100">${groups[ben].map(k => { const bk = b[k.split(SEP)[0]] || {}; return `<li class="flex items-center gap-3 px-3 py-2"><div class="flex-1 min-w-0"><div class="font-semibold text-[13px] truncate">${esc(bk.Book_Name || k)}</div>${bookSub(b, k.split(SEP)[0])}<div class="text-[11px] text-slate-400 num">${fmt(bk.Emp_Selling_Price)} × ${s.lines[k]} = ${fmt(n(bk.Emp_Selling_Price) * s.lines[k])}</div></div>${step(k, s.lines[k])}</li>`; }).join("")}</ul></div>`).join("") : `<div class="text-[12.5px] text-slate-400 py-3">لا كتب بعد — حفظ حجز فارغ يلغي الحجز.</div>`}</div>
  <div class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 items-end">
    <div class="col-span-2 sm:col-span-1"><div class="label">طريقة السداد</div><select class="input !h-10" data-change="edF" data-k="method">${[["INSTALLMENT", "تقسيط"], ["CASH", "نقدي كامل"], ["INSTAPAY", "إنستاباي"], ["WALLET", "محفظة"], ["PAYROLL", "خصم من المرتب"]].map(o => `<option value="${o[0]}" ${s.method === o[0] ? "selected" : ""}>${o[1]}</option>`).join("")}</select></div>
    ${s.method === "INSTALLMENT" ? `<div><div class="label">المقدم %</div><input class="input !h-10" type="number" min="0" max="100" value="${esc(s.down)}" data-change="edF" data-k="down"></div><div><div class="label">عدد الأقساط</div><input class="input !h-10" type="number" min="1" max="${n(d.settingsMap.MAX_INSTALLMENT_COUNT) || 4}" value="${esc(s.count)}" data-change="edF" data-k="count"></div>` : ""}
  </div>`;
}
on("edQ", v => { Ed.s.q = v.trim(); const el = $("#edBody"); if (!el) return; const pos = document.activeElement && document.activeElement.selectionStart; el.innerHTML = edBody(); const i = el.querySelector('[data-input="edQ"]'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (_) {} } });
on("edF", (v, el) => { Ed.s[el.dataset.k] = el.dataset.k === "down" || el.dataset.k === "count" ? n(v) : v; if (el.dataset.k === "down" || el.dataset.k === "count") return; edRefresh(); });
on("edBen", v => { Ed.s.ben = v; edRefresh(); });
on("edAddBen", async () => {
  const v = await UI.form({ title: "إضافة قريب", intro: "تُحسب كتب القريب على حساب العضو نفسه.", fields: [{ name: "name", label: "اسم القريب", required: true }, { name: "rel", label: "صلة القرابة", type: "select", value: "ابن أخ", options: ["ابن أخ", "ابن أخت", "حفيد", "أخ", "أخت", "ابن عم", "ابن خال", "أخرى"].map(x => [x, x]) }], ok: "إضافة" });
  if (!v || !v.name.trim()) return;
  const label = v.name.trim() + " — " + v.rel;
  if (!Ed.s.bens.includes(label)) Ed.s.bens.push(label);
  Ed.s.ben = label; edRefresh();
});
on("edInc", k => { const mx = n(A().settingsMap.MAX_QTY_PER_BOOK) || 3; Ed.s.lines[k] = Math.min(mx, (Ed.s.lines[k] || 0) + 1); edRefresh(); });
on("edDec", k => { Ed.s.lines[k] = (Ed.s.lines[k] || 0) - 1; if (Ed.s.lines[k] <= 0) delete Ed.s.lines[k]; edRefresh(); });
on("edSave", async () => {
  const s = Ed.s, items = Object.entries(s.lines).map(([k, q]) => ({ bookId: k.split(SEP)[0], beneficiary: k.split(SEP)[1] || "", qty: q }));
  const h = A().resHeaders.find(x => x.Phase_ID === APP.phaseId && x.Emp_ID === s.empId);
  if (!items.length && !h) return toast("أضف كتاباً واحداً على الأقل.", "warning");
  if (!items.length && !(await UI.confirm({ title: "إلغاء الحجز", message: "لا كتب في الحجز — سيُلغى حجز الموظف بالكامل. متابعة؟", ok: "إلغاء الحجز", tone: "danger" }))) return;
  const r = await call("SUBMIT_OR_UPDATE_RESERVATION", { empId: s.empId, phaseId: APP.phaseId, items, paymentMethod: s.method, downPaymentType: "PERCENTAGE", downPaymentInput: s.down, installmentCount: s.count }, { block: true });
  toast(r.message, r.success ? "success" : "danger"); (r.warnings || []).forEach(w => toast(w, "warning"));
  if (r.success) { if (Ed.m) Ed.m.close(); await Admin.load(); }
});

// ============================================================ ملف الموظف: كل ما يخصه في مكان واحد
on("empProfile", id => { Q.epTab = Q.epTab || "res"; Q.epId = id; const e = maps().e[id] || {};
  Q.epM = UI.open(`<div id="epBody">${epBody(id)}</div>`, { title: esc(e.Full_Name || id), sub: `<span class="num">${esc(id)}</span>${e.Department ? " · " + esc(e.Department) : ""}${e.Job_Title ? " · " + esc(e.Job_Title) : ""}`, wide: true }); });
on("epTab", t => { Q.epTab = t; const el = $("#epBody"); if (el) el.innerHTML = epBody(Q.epId); });
function epBody(id) {
  const d = A(), { b } = maps(), e = maps().e[id] || {}, ph = by(d.phases, "Phase_ID");
  const items = d.resItems.filter(i => i.Emp_ID === id && n(i.Requested_Qty) > 0 && !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward");
  const invs = d.empInvoices.filter(i => i.Emp_ID === id), pays = d.empPayments.filter(p => p.Emp_ID === id);
  const insts = d.installments.filter(i => i.Emp_ID === id).sort((a, c) => String(a.Due_Date).localeCompare(String(c.Due_Date)));
  const billed = sum(invs, "Net_Final_Invoice_Amount"), paid = sum(invs, "Total_Paid_Amount"), rem = sum(invs, "Remaining_Balance");
  const overdue = insts.filter(i => i.Status === "Overdue").reduce((s, i) => s + n(i.Remaining_Inst_Amount), 0);
  const rels = [...new Set(items.map(i => i.Beneficiary).filter(Boolean))];
  const t = Q.epTab;
  const tab = (k, label, c) => `<button class="chip !h-9" data-act="epTab" data-id="${k}" aria-pressed="${t === k}">${label}${c !== undefined ? ` <span class="num text-[11px] opacity-70">${fmt(c)}</span>` : ""}</button>`;
  const byPhase = {}; items.forEach(i => (byPhase[i.Phase_ID] = byPhase[i.Phase_ID] || []).push(i));
  let body = "";
  if (t === "res") body = Object.keys(byPhase).length ? Object.keys(byPhase).reverse().map(pid => `<div class="mb-4"><div class="flex items-center justify-between mb-1.5"><div class="font-bold text-[13.5px] text-slate-800">${esc((ph[pid] || {}).Phase_Name || pid)}</div>${pid === APP.phaseId && can("SUBMIT_OR_UPDATE_RESERVATION") ? `<button class="btn btn-outline btn-xs" data-act="epEditRes" data-id="${esc(id)}">${ic("pencil")} تعديل الحجز</button>` : ""}</div>
      <ul class="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-100">${byPhase[pid].sort((a, c) => String(a.Priority_Timestamp).localeCompare(String(c.Priority_Timestamp))).map(i => `<li class="flex items-center gap-3 px-3 py-2"><div class="flex-1 min-w-0"><div class="font-semibold text-[13px] truncate">${esc(bookName(b, i.Book_ID))}</div>${bookSub(b, i.Book_ID)}<div class="text-[11px] text-slate-400">${i.Beneficiary ? `<span class="text-sky-700 font-semibold">لـ ${esc(i.Beneficiary)}</span> · ` : ""}<span class="num">${esc(dt(i.Priority_Timestamp))}</span></div></div>
        <div class="text-left text-[12px] num shrink-0"><b>${fmt(i.Requested_Qty)}</b> نسخة${n(i.Delivered_Qty) ? `<div class="text-emerald-600">سُلّم ${fmt(i.Delivered_Qty)}</div>` : n(i.Allocated_Qty) ? `<div class="text-sky-600">مخصص ${fmt(i.Allocated_Qty)}</div>` : ""}</div>${pill(i.Allocation_Status)}</li>`).join("")}</ul></div>`).join("")
    : UI.empty("notebook-pen", "لا حجوزات", "", can("SUBMIT_OR_UPDATE_RESERVATION") && APP.phaseId ? `<button class="btn btn-primary btn-sm mt-4" data-act="epEditRes" data-id="${esc(id)}">${ic("plus")} حجز له</button>` : "");
  if (t === "inv") body = invs.length ? `<ul class="space-y-2">${invs.slice().reverse().map(i => `<li class="rounded-2xl ring-1 ring-slate-100 p-3"><div class="flex flex-wrap items-center justify-between gap-2"><div><div class="font-bold text-[13.5px]">${esc((ph[i.Phase_ID] || {}).Phase_Name || i.Phase_ID)} <span class="num text-[11px] text-slate-400">${esc(i.Emp_Inv_ID)}</span></div><div class="text-[11.5px] text-slate-500">${esc(ar(i.Payment_Plan_Type))}${n(i.Installments_Count) ? " · " + i.Installments_Count + " أقساط" : ""} · صدرت ${esc(i.Issue_Date)}</div></div>${pill(i.Invoice_Status)}</div>
      <div class="grid grid-cols-4 gap-2 mt-2">${UI.stat("الصافي", fmt(i.Net_Final_Invoice_Amount))}${UI.stat("المقدم", fmt(i.Down_Payment_Required))}${UI.stat("المسدد", `<span class="text-emerald-600">${fmt(i.Total_Paid_Amount)}</span>`)}${UI.stat("المتبقي", `<span class="${n(i.Remaining_Balance) ? "text-rose-600" : ""}">${fmt(i.Remaining_Balance)}</span>`)}</div>
      <div class="flex flex-wrap gap-1.5 mt-2"><button class="btn btn-outline btn-xs" data-act="printInvA" data-id="${esc(i.Emp_Inv_ID)}">${ic("printer")} الفاتورة</button>${n(i.Remaining_Balance) > 0 && can("RECORD_EMPLOYEE_PAYMENT") ? `<button class="btn btn-primary btn-xs" data-act="collect" data-id="${esc(i.Emp_Inv_ID)}">${ic("hand-coins")} تحصيل</button>` : ""}${can("ADJUST_EMP_INVOICE") ? `<button class="btn btn-ghost btn-xs" data-act="adjInv" data-id="${esc(i.Emp_Inv_ID)}">${ic("pencil")} تعديل</button>` : ""}${can("CUSTOMIZE_EMP_INSTALLMENTS") ? `<button class="btn btn-ghost btn-xs" data-act="changePlan" data-id="${esc(i.Res_ID)}">${ic("calendar-range")} الخطة</button>` : ""}${can("DELETE_EMP_INVOICE") ? `<button class="btn btn-ghost btn-xs text-rose-600" data-act="delInv" data-id="${esc(i.Emp_Inv_ID)}">${ic("trash-2")} حذف</button>` : ""}</div></li>`).join("")}</ul>` : UI.empty("receipt", "لا فواتير", "تصدر بعد التوزيع.");
  if (t === "inst") body = insts.length ? UI.table([{ t: "القسط", v: i => `${esc(i.Admin_Custom_Notes || ("قسط " + i.Installment_No))}<div class="text-[11px] text-slate-400 num">${esc(i.Emp_Inv_ID)}</div>` }, { t: "الاستحقاق", cls: "num", v: "Due_Date" }, { t: "القيمة", cls: "num", v: i => fmt(i.Scheduled_Amount) }, { t: "المسدد", cls: "num", v: i => fmt(i.Paid_Amount) }, { t: "المتبقي", cls: "num", v: i => `<b class="${n(i.Remaining_Inst_Amount) ? "text-rose-600" : "text-slate-400"}">${fmt(i.Remaining_Inst_Amount)}</b>` }, { t: "الحالة", v: i => pill(i.Status) }], insts, { cardsOnMobile: false }) : UI.empty("calendar-range", "لا أقساط");
  if (t === "pay") body = pays.length ? `<ul class="divide-y divide-slate-100">${pays.slice().reverse().map(p => `<li class="flex items-center gap-3 py-2.5"><div class="flex-1"><div class="font-semibold text-[13px] num">${esc(p.Receipt_No)} <span class="text-slate-400 font-normal">· ${esc(ar(p.Payment_Method))}${p.Transaction_Ref ? " · " + esc(p.Transaction_Ref) : ""}</span></div><div class="text-[11.5px] text-slate-400 num">${esc(dt(p.Payment_Date))} · ${esc(p.Collected_By || "")}</div></div>
      ${isTrue(p.Is_Voided) ? pill("", "ملغى", "red") : `<b class="num ${n(p.Amount) < 0 ? "text-rose-600" : "text-emerald-600"}">${fmt(p.Amount)}</b><button class="icon-btn w-8 h-8" data-act="printRcpt" data-id="${esc(p.Receipt_No)}" title="طباعة">${ic("printer")}</button>`}</li>`).join("")}</ul>` : UI.empty("wallet", "لا إيصالات");
  if (t === "log") { body = `<div id="epLog">${UI.skeleton(3)}</div>`; setTimeout(async () => { const r = await call("GET_AUDIT_LOG", { empId: id, limit: 200 }); const el = $("#epLog"); if (!el) return; Q.audRows = r.entries || []; el.innerHTML = r.success ? audList(Q.audRows) : esc(r.message); }, 0); }
  if (t === "info") body = `<div class="grid grid-cols-2 gap-2">${UI.stat("الرقم الوظيفي", esc(e.Emp_ID))}${UI.stat("الموبايل", e.Mobile ? `<a class="text-brand-700" href="tel:${esc(e.Mobile)}" dir="ltr">${esc(e.Mobile)}</a>` : "—")}${UI.stat("جهة العمل", esc(e.Department || "—"))}${UI.stat("الوظيفة", esc(e.Job_Title || "—"))}${UI.stat("حالة العضوية", esc(e.Employment_Status || "—"))}${UI.stat("التقسيط", String(e.Installment_Allowed) === "false" ? "غير مسموح" : "مسموح")}${UI.stat("الحد الائتماني", e.Max_Credit_Limit ? fmt(e.Max_Credit_Limit) : "الافتراضي")}${UI.stat("آخر تحديث", esc(dt(e.Updated_At) || "—"))}</div>
    ${rels.length ? `<div class="mt-3"><div class="label">الأقارب الذين حجز لهم</div><div class="flex flex-wrap gap-1.5">${rels.map(r => `<span class="pill pill-blue">${esc(r)}</span>`).join("")}</div></div>` : ""}
    ${e.Mobile ? `<div class="mt-3"><div class="label">رسالة واتساب جاهزة</div><div class="flex flex-wrap gap-1.5">${[["ready", "كتبك جاهزة"], ["inst", "تذكير بالقسط"], ["open", "الحجز مفتوح"], ["free", "رسالة حرة"]].map(x => `<button class="btn btn-soft btn-xs" data-act="waEmp" data-id="${esc(e.Emp_ID)}|${x[0]}">${ic("message-circle")} ${x[1]}</button>`).join("")}<a class="btn btn-ghost btn-xs" href="tel:${esc(e.Mobile)}">${ic("phone")} اتصال</a></div></div>` : ""}
    <p class="text-[11.5px] text-slate-400 mt-3">${ic("info", "inline -mt-0.5")} البيانات الأساسية تُحدَّث تلقائياً كل ليلة من MyNekaba.</p>`;
  return `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">${UI.stat("النسخ المحجوزة", fmt(sum(items, "Requested_Qty")))}${UI.stat("إجمالي الفواتير", fmt(billed))}${UI.stat("المسدد", `<span class="text-emerald-600">${fmt(paid)}</span>`)}${UI.stat(overdue ? "المتبقي (متأخر " + fmt(overdue) + ")" : "المتبقي", `<span class="${rem ? "text-rose-600" : ""}">${fmt(rem)}</span>`, overdue ? "!bg-rose-50" : "")}</div>
    <div class="scroll-x !mx-0 !px-0 mb-3">${tab("res", "الحجوزات", items.length)}${tab("inv", "الفواتير", invs.length)}${tab("inst", "الأقساط", insts.length)}${tab("pay", "الإيصالات", pays.filter(p => !isTrue(p.Is_Voided)).length)}${tab("info", "البيانات")}${can("GET_AUDIT_LOG") ? tab("log", "السجل") : ""}</div>${body}`;
}
on("epEditRes", id => { if (Q.epM) Q.epM.close(); setTimeout(() => ACTIONS.resEdit(id), 50); });

// ============================================================ سجل التعديلات
const AUD_MOD = { Reservations: "الحجوزات", ReservationItems: "بنود الحجز", Invoices: "الفواتير", Payments: "الإيصالات", Installments: "الأقساط", Catalog: "الكتب", Settings: "الإعدادات", Phases: "المراحل", PO_Snapshot: "طلب التوريد", Supplier_Invoices: "فواتير المكتبة", Supplier: "حساب المكتبة", Suppliers: "المكتبات", Allocation: "التوزيع", Delivery: "التسليم", Returns: "المرتجعات", Inventory: "المخزن", Expenses: "المصروفات", Cash: "الخزينة", Employees: "الموظفون", Auth: "الدخول" };
const AUD_ACT = { SAVE_RESERVATION: "حفظ حجز (الموظف)", SAVE_RESERVATION_ON_BEHALF: "حجز/تعديل من الإدارة", ADD_NEW: "إضافة كتاب", INCREASE_QTY: "زيادة كمية", DECREASE_QTY: "تخفيض كمية", REMOVE_ITEM: "حذف كتاب", CANCEL_UNDELIVERED: "إلغاء كمية لم تُسلَّم", ADJUST_INVOICE: "تعديل فاتورة", DELETE_INVOICE: "حذف فاتورة", COLLECT: "تحصيل", VOID: "إلغاء إيصال", REFUND: "رد رصيد", CUSTOMIZE_PLAN: "تعديل خطة الأقساط", SAVE_BOOK: "حفظ كتاب", DELETE_BOOK: "حذف كتاب من الكتالوج", BULK_IMPORT_BOOKS: "استيراد كتب", SAVE_SETTING: "تعديل إعداد", SAVE_ROLE_PERMISSIONS: "تعديل الصلاحيات", SAVE_PHASE: "حفظ مرحلة", DELETE_PHASE: "حذف مرحلة", SET_STATUS: "تغيير حالة المرحلة", FREEZE_PO: "تجميد الحصر", CANCEL_BACKORDER: "إلغاء نواقص", APPROVE_INVOICE: "اعتماد فاتورة مكتبة", PAYMENT: "سداد للمكتبة", SAVE_SUPPLIER: "حفظ مكتبة", DELETE_SUPPLIER: "حذف مكتبة", RUN_FIFO: "تشغيل التوزيع", MANUAL_EXCEPTION: "تعديل توزيع يدوي", CARRY_WAITLIST: "ترحيل المنتظرين", EMP_RETURN: "مرتجع موظف", SUPPLIER_RETURN: "مرتجع للمكتبة", ADJUST: "تسوية مخزن", RECORD: "تسجيل مصروف", CLOSE_DAY: "إقفال الخزينة", BULK_IMPORT: "استيراد موظفين", CHANGE_PASSWORD: "تغيير كلمة المرور" };
const AUD_F = { Res_ID: "رقم الحجز", Phase_ID: "المرحلة", Emp_ID: "الموظف", Created_At: "أُنشئ", Last_Modified_At: "آخر تعديل", Payment_Method_Selected: "طريقة السداد", Down_Payment_Type: "نوع المقدم", Down_Payment_Input: "المقدم", Calculated_Down_Payment: "قيمة المقدم", Installment_Count: "عدد الأقساط", Installment_Value: "القسط", Total_Cover_Value: "إجمالي الغلاف", Total_Emp_Value: "الإجمالي", Res_Status: "حالة الحجز", Invoice_Adjustment: "تعديل الفاتورة", Adjustment_Reason: "سبب التعديل", Created_By: "أنشأه", Setting_Value: "القيمة", v: "القيمة", reason: "السبب", Book_Name: "الكتاب", Cover_Price: "الغلاف", Emp_Selling_Price: "سعر الموظف", Book_Status: "الحالة", Phase_Status: "حالة المرحلة", Amount: "المبلغ", Is_Voided: "ملغى", Void_Reason: "سبب الإلغاء", Net_Final_Invoice_Amount: "صافي الفاتورة", Remaining_Balance: "المتبقي", Total_Paid_Amount: "المسدد", Invoice_Status: "حالة الفاتورة" };
const AUD_TONE = a => /DELETE|VOID|REMOVE|CANCEL/.test(a) ? "red" : /ADJUST|DECREASE|CUSTOM|SET_STATUS|PERMISSION|SETTING/.test(a) ? "amber" : /ON_BEHALF|MANUAL/.test(a) ? "blue" : "green";
Q.aud = Q.aud || { module: "", q: "", days: 7 };
async function loadAudit() {
  const el = $("#audList"); if (!el) return;
  el.innerHTML = UI.skeleton(4);
  const r = await call("GET_AUDIT_LOG", Object.assign({ limit: 400 }, Q.aud));
  if (!$("#audList")) return;
  if (!r.success) { el.innerHTML = UI.empty("history", "تعذر تحميل السجل", r.message); return; }
  Q.audRows = r.entries;
  $("#audCount").textContent = `${fmt(r.entries.length)} من ${fmt(r.total)} حركة`;
  el.innerHTML = audList(r.entries);
}
function audDiff(a) {
  let b = {}, c = {}; try { b = a.before ? JSON.parse(a.before) : {}; } catch (_) { b = { قيمة: a.before }; } try { c = a.after ? JSON.parse(a.after) : {}; } catch (_) { c = { قيمة: a.after }; }
  const keys = [...new Set([...Object.keys(b || {}), ...Object.keys(c || {})])].filter(k => JSON.stringify((b || {})[k]) !== JSON.stringify((c || {})[k])).slice(0, 14);
  if (!keys.length) return "";
  const v = x => x === undefined || x === null || x === "" ? "—" : esc(typeof x === "object" ? JSON.stringify(x) : String(x)).slice(0, 120);
  return `<div class="mt-2 rounded-xl bg-slate-50 p-2.5 text-[12px] grid grid-cols-[auto_1fr_auto_1fr] gap-x-2 gap-y-1 items-start">${keys.map(k => `<span class="text-slate-500 font-semibold">${esc(AUD_F[k] || k)}</span><span class="text-rose-600 line-through break-all">${v((b || {})[k])}</span><span class="text-slate-300">←</span><span class="text-emerald-700 break-all">${v((c || {})[k])}</span>`).join("")}</div>`;
}
function audList(rows) {
  if (!rows.length) return UI.empty("history", "لا حركات مطابقة", "جرّب توسيع المدة أو إزالة الفلتر.");
  const { b } = maps(); let lastDay = "";
  return `<ul class="relative">${rows.map((a, i) => { const dayS = a.t.slice(0, 10), head = dayS !== lastDay ? (lastDay = dayS, `<li class="text-[12px] font-bold text-slate-500 mt-4 mb-2 first:mt-0">${esc(dayS)}</li>`) : "";
    const tone = AUD_TONE(a.action), dot = { red: "bg-rose-500", amber: "bg-amber-500", blue: "bg-sky-500", green: "bg-emerald-500" }[tone];
    const detail = a.module === "ReservationItems" ? `<div class="text-[12.5px] text-slate-600 mt-0.5">${esc(bookName(b, a.book))} · <span class="num">${fmt(a.oldQty)} ← ${fmt(a.newQty)}</span></div>${a.rule ? `<div class="text-[11.5px] text-slate-400 mt-0.5">${esc(a.rule)}</div>` : ""}` : "";
    return head + `<li class="flex gap-3 pb-3"><span class="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${dot}"></span><div class="flex-1 min-w-0 rounded-2xl ring-1 ring-slate-100 p-3 ${a.before || a.after ? "cursor-pointer hover:bg-slate-50" : ""}" ${a.before || a.after ? `data-act="audOpen" data-id="${i}"` : ""}>
      <div class="flex flex-wrap items-center justify-between gap-2"><div class="font-semibold text-[13.5px] text-slate-900">${esc(AUD_ACT[a.action] || a.action)} <span class="pill pill-gray !text-[10.5px]">${esc(AUD_MOD[a.module] || a.module)}</span></div><span class="text-[11.5px] text-slate-400 num">${esc(a.t.slice(11, 16))}</span></div>
      <div class="text-[12px] text-slate-500 mt-0.5">${ic("user", "inline -mt-0.5")} ${esc(a.user)}${a.role && a.role !== "EMPLOYEE" ? " · " + esc(ar(a.role)) : ""} · <span class="num">${esc(a.key)}</span></div>${detail}<div class="aud-d" data-i="${i}"></div></div></li>`; }).join("")}</ul>`;
}
on("audOpen", i => { const el = $(`.aud-d[data-i="${i}"]`); if (!el) return; el.innerHTML = el.innerHTML ? "" : (audDiff(Q.audRows[i]) || `<div class="mt-2 text-[12px] text-slate-400">لا تفاصيل إضافية.</div>`); });
Router.add("/a/audit", view => {
  const f = Q.aud;
  view.innerHTML = UI.pageHead("سجل التعديلات", "من عدّل ماذا ومتى — اضغط على أي حركة لرؤية التفاصيل قبل وبعد")
    + `<section class="card card-pad"><div class="flex flex-wrap items-center gap-2 mb-3">${searchBox("audQ", f.q, "بحث بالاسم أو الرقم أو العملية")}
      <select class="input !h-10 !w-auto !text-sm" data-change="audF" data-k="module"><option value="">كل الأقسام</option>${Object.keys(AUD_MOD).map(k => `<option value="${k}" ${f.module === k ? "selected" : ""}>${AUD_MOD[k]}</option>`).join("")}</select>
      <div class="scroll-x !mx-0 !px-0">${[[1, "اليوم"], [7, "أسبوع"], [30, "شهر"], [0, "الكل"]].map(d => `<button class="chip !h-9" data-act="audDays" data-id="${d[0]}" aria-pressed="${n(f.days) === d[0]}">${d[1]}</button>`).join("")}</div>
      <span id="audCount" class="text-[12px] text-slate-400 mr-auto"></span></div><div id="audList"></div></section>`;
  loadAudit();
});
let audT = null;
on("audQ", v => { Q.aud.q = v.trim(); clearTimeout(audT); audT = setTimeout(loadAudit, 400); });
on("audF", (v, el) => { Q.aud[el.dataset.k] = v; loadAudit(); });
on("audDays", v => { Q.aud.days = n(v); Shell.rerender(); });

// ============================================================ الإعلانات والتواصل مع الموظفين
function annList() {
  const list = A().announcements || [];
  if (!list.length) return `<div class="text-sm text-slate-500">لا إعلانات منشورة. مثال: «الحجز يفتح السبت 10 صباحاً» أو «التسليم من مقر النقابة يوم الأحد».</div>`;
  return `<ul class="space-y-2">${list.map(a => `<li class="flex items-start gap-3 rounded-2xl ring-1 ring-slate-100 p-3"><span class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a.tone === "warning" ? "bg-amber-50 text-amber-600" : a.tone === "success" ? "bg-emerald-50 text-emerald-600" : "bg-brand-50 text-brand-600"}">${ic("megaphone")}</span>
    <div class="flex-1 min-w-0"><b class="block text-[14px]">${esc(a.title)}</b>${a.body ? `<p class="text-[12.5px] text-slate-500 whitespace-pre-line">${esc(a.body)}</p>` : ""}<div class="text-[11px] text-slate-400 mt-1 num">${esc(a.at || "")} · ${esc(a.by || "")}${a.until ? " · حتى " + esc(a.until) : ""}${a.phaseId ? " · " + esc((A().phases.find(p => p.Phase_ID === a.phaseId) || {}).Phase_Name || a.phaseId) : " · كل المراحل"}</div></div>
    ${can("POST_ANNOUNCEMENT") ? `<button class="icon-btn w-9 h-9 text-rose-500" data-act="annDel" data-id="${esc(a.id)}" aria-label="حذف">${ic("trash-2")}</button>` : ""}</li>`).join("")}</ul>`;
}
on("annNew", async () => {
  const v = await UI.form({ title: "إعلان جديد للموظفين", fields: [{ name: "title", label: "العنوان", required: true, placeholder: "مثال: الحجز يفتح السبت 10 صباحاً" }, { name: "body", label: "التفاصيل (اختياري)", type: "textarea", rows: 3 },
    { name: "phaseId", label: "يظهر لموظفي", type: "select", value: APP.phaseId || "", options: [["", "كل المراحل"]].concat(A().phases.map(p => [p.Phase_ID, p.Phase_Name])) },
    { name: "tone", label: "النوع", type: "seg", value: "info", options: [["info", "معلومة"], ["success", "خبر سعيد"], ["warning", "تنبيه"]] }, { name: "until", label: "يظهر حتى (اختياري)", type: "date" }], ok: "نشر للموظفين", icon: "megaphone" });
  if (v) await act("POST_ANNOUNCEMENT", { op: "add", title: v.title, body: v.body, tone: v.tone, until: v.until, phaseId: v.phaseId });
});
on("annDel", id => act("POST_ANNOUNCEMENT", { op: "delete", id }, { title: "حذف الإعلان", message: "حذف هذا الإعلان من عند الموظفين؟", ok: "حذف", tone: "danger" }));
/** رسائل واتساب جاهزة للموظف من ملفه */
const WA_TPL = {
  ready: (e, x) => `أهلاً ${e}، كتبك جاهزة للتسليم 📦 في ${Brand.get().org}. برجاء الحضور لاستلامها ومعك المقدم${x.down ? " (" + x.down + " ج.م)" : ""}.`,
  inst: (e, x) => `أهلاً ${e}، تذكير ودي بقسط كتب أولادك${x.amount ? " بقيمة " + x.amount + " ج.م" : ""}${x.due ? " المستحق " + x.due : ""}. شكراً لتعاونك.`,
  open: e => `أهلاً ${e}، الحجز مفتوح الآن في ${Brand.get().platform} 🎉 احجز كتب أولادك بخصم العاملين من التطبيق.`,
  free: e => `أهلاً ${e}، `
};
on("waEmp", key => {
  const [id, t] = key.split("|"), d = A(), e = maps().e[id] || {};
  if (!e.Mobile) return toast("لا يوجد رقم موبايل لهذا الموظف", "warning");
  const inv = d.empInvoices.filter(i => i.Emp_ID === id).pop() || {}, inst = d.installments.filter(i => i.Emp_ID === id && n(i.Remaining_Inst_Amount) > 0).sort((a, c) => String(a.Due_Date).localeCompare(String(c.Due_Date)))[0] || {};
  const first = String(e.Full_Name || "").split(" ")[0];
  window.open(Brand.waLink(e.Mobile, WA_TPL[t](first, { down: fmt(Math.max(0, n(inv.Down_Payment_Required) - n(inv.Total_Paid_Amount))), amount: fmt(inst.Remaining_Inst_Amount), due: inst.Due_Date })), "_blank");
});
