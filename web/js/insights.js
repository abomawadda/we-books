/* ============================================================================
 * نظرة المدير: «أنا فين النهارده؟»، الجاهزية، أولوية التسعير، فجوة التوريد، متابعة الأعضاء
 * كلها محسوبة في المتصفح من بيانات GET_ADMIN_DASHBOARD_DATA (عدا قائمة من تجاوزتهم المزامنة)
 * ========================================================================== */
"use strict";
const dayKey = v => String(v || "").replace("T", " ").slice(0, 10);
const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const addDays = (k, x) => { const d = new Date(k + "T12:00:00"); d.setDate(d.getDate() + x); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
const reservedQty = () => { const m = {}; phaseItems().forEach(i => { m[i.Book_ID] = (m[i.Book_ID] || 0) + n(i.Requested_Qty); }); return m; };

/** أول حجز لكل موظف في المرحلة (يوم انضمامه) */
function bookingDays() {
  const first = {};
  A().resHeaders.filter(h => h.Phase_ID === APP.phaseId && h.Res_Status !== "Cancelled").forEach(h => { const k = dayKey(h.Created_At); if (k && (!first[h.Emp_ID] || k < first[h.Emp_ID])) first[h.Emp_ID] = k; });
  const per = {}; Object.values(first).forEach(k => { per[k] = (per[k] || 0) + 1; });
  return per;
}

// ---------------------------------------------------------------- شريط «اليوم»
function todayStrip() {
  const ph = phaseObj(), per = bookingDays(), t = todayKey(), y = addDays(t, -1);
  const people = Object.values(per).reduce((s, x) => s + x, 0), total = A().employees.length || 1;
  const end = dayKey(ph.End_DateTime), start = dayKey(ph.Start_DateTime);
  const left = end && end >= t ? daysBetween(t, end) : null;
  const ran = start ? Math.max(1, daysBetween(start, t < end || !end ? t : end) + 1) : 1;
  const rate = people / ran, proj = left !== null ? Math.round(people + rate * left) : people;
  const items = phaseItems(), money0 = items.reduce((s, i) => s + n(i.Requested_Qty) * n(i.Unit_Emp_Price), 0);
  // آخر 14 يوماً
  const days = Array.from({ length: 14 }, (_, k) => addDays(t, k - 13)), mx = Math.max(1, ...days.map(d => per[d] || 0));
  const chart = `<div class="flex items-end gap-1 h-24 mt-2" dir="ltr">${days.map(d => `<div class="flex-1 flex flex-col items-center justify-end h-full" title="${d}: ${per[d] || 0}">
      <span class="text-[10px] num text-slate-500 mb-0.5">${per[d] || ""}</span><div class="w-full rounded-t-md ${d === t ? "bg-gold-400" : "bg-brand-500/80"}" style="height:${Math.max(3, (per[d] || 0) / mx * 100)}%"></div></div>`).join("")}</div>
    <div class="flex justify-between text-[10.5px] text-slate-400 num mt-1" dir="ltr"><span>${days[0].slice(5)}</span><span>اليوم</span></div>`;
  const diff = (per[t] || 0) - (per[y] || 0);
  return `<div class="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_1.2fr] mt-4 sm:mt-6">
    <div class="grid grid-cols-2 gap-3 sm:gap-4">
      ${UI.kpi("حجوزات جديدة اليوم", fmt(per[t] || 0), { icon: "sparkles", tone: "brand", foot: (per[y] || diff) ? `${diff >= 0 ? "▲" : "▼"} ${fmt(Math.abs(diff))} عن أمس (${fmt(per[y] || 0)})` : "أول حجز اليوم يظهر هنا" })}
      ${UI.kpi("نسبة المشاركة", Math.round(people / total * 100) + "%", { icon: "users", tone: "blue", pct: people / total * 100, foot: `${fmt(people)} من ${fmt(total)} عضو` })}
      ${UI.kpi("أيام الحجز الباقية", left === null ? "—" : fmt(left), { icon: "calendar-clock", tone: left !== null && left <= 2 ? "red" : "amber", foot: end ? `يقفل ${esc(day(ph.End_DateTime))}` : "" })}
      ${UI.kpi("التوقع عند الإغلاق", fmt(proj) + " موظف", { icon: "trending-up", tone: "green", foot: `بمعدل ${fmt(Math.round(rate * 10) / 10)} يومياً · قيمة الحجز الآن ${moneyTxt(money0)}` })}
    </div>
    ${UI.section(`${ic("chart-column", "text-brand-600")} الحجز يوماً بيوم`, "موظفون جدد حجزوا كل يوم — آخر 14 يوماً", chart)}
  </div>`;
}

// ---------------------------------------------------------------- الجاهزية للخطوة التالية
function readinessBox() {
  const ph = phaseObj(), st = ph.Effective_Status || ph.Phase_Status, res = reservedQty(), { b } = maps();
  const unpriced = Object.keys(res).filter(id => (b[id] || {}).Book_Status === "Pricing" || !n((b[id] || {}).Emp_Selling_Price));
  const loss = Object.keys(res).filter(id => n((b[id] || {}).Emp_Selling_Price) && n(b[id].Emp_Selling_Price) < n(b[id].Standard_Net_Cost));
  const dr = poDrift(APP.phaseId), drift = dr && (dr.rows.length || dr.changed.length);
  const invs = A().empInvoices.filter(i => i.Phase_ID === APP.phaseId);
  const items = phaseItems(), waiting = items.reduce((s, i) => s + Math.max(0, n(i.Requested_Qty) - Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty))), 0);
  const noPO = !A().poSnapshots.some(p => p.Phase_ID === APP.phaseId), noInv = !A().supInvHeaders.some(h => h.Phase_ID === APP.phaseId);
  const C = (ok, txt, fix, href) => ({ ok, txt, fix, href });
  const GATES = {
    Open: ["قبل إغلاق الحجز", [C(Object.keys(res).length > 0, "توجد حجوزات في المرحلة", "لا حجوزات بعد", "/a/res"), C(!loss.length, "لا كتب محجوزة تُباع بخسارة", `${loss.length} كتاب محجوز سعره أقل من تكلفته`, "/a/books")]],
    Closed: ["قبل طلب التوريد", [C(!unpriced.length, "كل الكتب المحجوزة مسعّرة", `${unpriced.length} كتاب محجوز بلا سعر — لن يُعرف المبلغ المطلوب`, "/a/books"), C(!loss.length, "لا كتب تُباع بخسارة", `${loss.length} كتاب سعره أقل من تكلفته`, "/a/books")]],
    Ordered: ["قبل التوزيع", [C(!noPO, "طلب التوريد مُجمَّد", "لم يُجمَّد طلب التوريد", "/a/po"), C(!drift, "لا تغييرات بعد التجميد", "تغيّرت الحجوزات بعد طلب التوريد", "/a/po"), C(!unpriced.length, "كل الكتب المحجوزة مسعّرة", `${unpriced.length} كتاب بلا سعر — سعّرها قبل التوزيع وإلا صدرت فواتير بصفر`, "/a/books")]],
    Receiving: ["قبل التوزيع", [C(!noInv, "فاتورة المكتبة مُدخلة", "لم تُدخل فاتورة المكتبة", "/a/receive"), C(!unpriced.length, "كل الكتب المحجوزة مسعّرة", `${unpriced.length} كتاب بلا سعر — سعّرها قبل التوزيع`, "/a/books"), C(!drift, "لا تغييرات بعد التجميد", "تغيّرت الحجوزات بعد طلب التوريد", "/a/po")]],
    Delivering: ["قبل إغلاق المرحلة", [C(!waiting, "لا أحد في قائمة الانتظار", `${fmt(waiting)} نسخة لم تُخصَّص`, "/a/alloc"), C(!invs.some(i => n(i.Remaining_Balance) > 0), "لا مديونيات متبقية", `${invs.filter(i => n(i.Remaining_Balance) > 0).length} موظف عليه رصيد`, "/a/collect")]]
  };
  const g = GATES[st]; if (!g) return "";
  const ok = g[1].every(c => c.ok);
  return `<section class="card mt-4 sm:mt-6 ${ok ? "" : "ring-2 ring-amber-200"}"><div class="px-4 sm:px-5 py-4 flex items-center gap-3">
      <span class="w-10 h-10 rounded-xl flex items-center justify-center text-lg ${ok ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}">${ic(ok ? "shield-check" : "shield-alert")}</span>
      <div class="flex-1"><h2 class="card-title">جاهزية الخطوة التالية — ${g[0]}</h2><p class="card-sub">${ok ? "كل الشروط مكتملة، تقدر تكمل بأمان." : "في حاجات لازم تتظبط الأول عشان ما يحصلش خطأ مكلف."}</p></div></div>
    <ul class="px-4 sm:px-5 pb-4 space-y-2">${g[1].map(c => `<li>${c.ok ? `<div class="flex items-center gap-2.5 text-[13.5px] text-emerald-700">${ic("circle-check")} ${esc(c.txt)}</div>`
      : `<a href="#${c.href}" class="flex items-center gap-2.5 text-[13.5px] text-rose-700 font-semibold rounded-xl bg-rose-50 px-3 py-2">${ic("circle-x")}<span class="flex-1">${esc(c.fix)}</span>${ic("chevron-left")}</a>`}</li>`).join("")}</ul></section>`;
}

// ---------------------------------------------------------------- سعّر الأهم أولاً
function pricingPriority() {
  const res = reservedQty(), bk = A().books.filter(x => x.Book_Status === "Pricing");
  if (!bk.length) return "";
  const rows = bk.map(x => ({ b: x, q: res[x.Book_ID] || 0 })).sort((a, b) => b.q - a.q).slice(0, 8);
  const hot = bk.filter(x => res[x.Book_ID]).length;
  return `<div class="mt-4 sm:mt-6">${UI.section(`${ic("hourglass", "text-amber-500")} سعّر الأهم أولاً`, `${fmt(bk.length)} كتاب بانتظار السعر — منها ${fmt(hot)} محجوزة فعلاً. مرتبة بعدد النسخ المحجوزة.`,
    `<ul class="divide-y divide-slate-100">${rows.map(r => `<li class="flex items-center gap-3 py-2.5"><span class="w-10 text-center"><b class="num text-[17px] ${r.q ? "text-brand-800" : "text-slate-300"}">${fmt(r.q)}</b><span class="block text-[10px] text-slate-400">نسخة</span></span>
      <div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px] truncate">${esc(r.b.Book_Name)}</div><div class="text-[11.5px] text-slate-400 truncate">${esc(r.b.Grade || r.b.Stage || "")} · ${esc(r.b.Publisher || "")}</div></div>
      ${can("SAVE_BOOK") ? `<button class="btn btn-outline btn-xs" data-act="bookForm" data-id="${esc(r.b.Book_ID)}">${ic("pencil")} سعّر</button>` : ""}</li>`).join("")}</ul>`,
    `<a href="#/a/books" data-act="goPricing" class="btn btn-ghost btn-sm">الكل ${ic("chevron-left")}</a>`)}</div>`;
}

// ---------------------------------------------------------------- فجوة التوريد لكل كتاب
function gapRows() {
  const { b } = maps(), res = reservedQty(), po = {}, rec = {}, al = {}, dl = {};
  A().poSnapshots.filter(p => p.Phase_ID === APP.phaseId).forEach(p => { po[p.Book_ID] = (po[p.Book_ID] || 0) + n(p.Net_Order_To_Supplier_Qty); rec[p.Book_ID] = (rec[p.Book_ID] || 0) + n(p.Received_Qty_To_Date); });
  phaseItems().forEach(i => { al[i.Book_ID] = (al[i.Book_ID] || 0) + n(i.Allocated_Qty); dl[i.Book_ID] = (dl[i.Book_ID] || 0) + n(i.Delivered_Qty); });
  const stock = A().stockMap || {};
  return [...new Set([...Object.keys(res), ...Object.keys(po)])].map(id => {
    const bk = b[id] || {}, x = { id, name: bk.Book_Name || id, pub: bk.Publisher || "", grade: bk.Grade || "", res: res[id] || 0, po: po[id] || 0, rec: rec[id] || 0, al: al[id] || 0, dl: dl[id] || 0, stock: n(stock[id]) };
    // قبل الطلب: لا فجوة تُحسب؛ بعده: المتاح (وارد أو مخصص) مقابل المحجوز
    x.gap = x.po || x.rec || x.al ? Math.max(x.rec, x.al) - x.res : 0; return x;
  });
}
const GAP = { f: "all", q: "" };
function gapTable() {
  let rows = gapRows();
  const q = GAP.q.trim(); if (q) rows = rows.filter(r => (r.name + " " + r.pub + " " + r.id).includes(q));
  if (GAP.f === "short") rows = rows.filter(r => r.gap < 0); else if (GAP.f === "over") rows = rows.filter(r => r.gap > 0);
  rows.sort((a, b) => a.gap - b.gap || b.res - a.res);
  return UI.table([
    { t: "الكتاب", v: r => `<b>${esc(r.name)}</b><div class="text-[11px] text-slate-400">${esc(r.grade)} · ${esc(r.pub)} · <span class="num">${esc(r.id)}</span></div>` },
    { t: "محجوز", cls: "num", v: r => fmt(r.res) }, { t: "مطلوب من المكتبة", cls: "num", v: r => fmt(r.po) }, { t: "وارد", cls: "num", v: r => fmt(r.rec) },
    { t: "مخصص", cls: "num", v: r => fmt(r.al) }, { t: "مُسلَّم", cls: "num", v: r => fmt(r.dl) },
    { t: "الفرق", cls: "num", v: r => r.gap < 0 ? `<b class="text-rose-600">نقص ${fmt(-r.gap)}</b>` : r.gap > 0 ? `<b class="text-amber-600">زيادة ${fmt(r.gap)}</b>` : `<span class="text-emerald-600">${ic("check")}</span>` }
  ], rows, { empty: "لا كتب في هذا الفلتر", emptyIcon: "package" });
}
Router.add("/a/gap", view => {
  const rows = gapRows(), short = rows.filter(r => r.gap < 0), over = rows.filter(r => r.gap > 0);
  view.innerHTML = UI.pageHead("فجوة التوريد", `${esc(phaseObj().Phase_Name || "")} — لكل كتاب: المحجوز مقابل المطلوب والوارد والمسلَّم. الأحمر نقص والأصفر زيادة.`,
    `<button class="btn btn-outline btn-sm" data-act="gapCsv">${ic("file-spreadsheet")} Excel</button>`)
  + `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
      ${UI.kpi("كتب محجوزة", fmt(rows.filter(r => r.res).length), { icon: "book-open", tone: "brand", foot: `${fmt(sum(rows, "res"))} نسخة` })}
      ${UI.kpi("كتب بها نقص", fmt(short.length), { icon: "triangle-alert", tone: short.length ? "red" : "green", foot: `${fmt(-short.reduce((s, r) => s + r.gap, 0))} نسخة ناقصة` })}
      ${UI.kpi("كتب بها زيادة", fmt(over.length), { icon: "package-plus", tone: over.length ? "amber" : "green", foot: `${fmt(over.reduce((s, r) => s + r.gap, 0))} نسخة زائدة` })}
      ${UI.kpi("نسبة التسليم", (sum(rows, "res") ? Math.round(sum(rows, "dl") / sum(rows, "res") * 100) : 0) + "%", { icon: "package-check", tone: "green", pct: sum(rows, "res") ? sum(rows, "dl") / sum(rows, "res") * 100 : 0 })}
    </div>
    <div class="card p-3 mb-3 flex flex-wrap items-center gap-2">${searchBox("gapQ", GAP.q, "ابحث باسم الكتاب أو الناشر")}
      ${[["all", "الكل"], ["short", "النقص فقط"], ["over", "الزيادة فقط"]].map(f => `<button class="btn btn-sm ${GAP.f === f[0] ? "btn-primary" : "btn-outline"}" data-act="gapF" data-id="${f[0]}">${f[1]}</button>`).join("")}</div>
    <div id="gapList">${gapTable()}</div>`;
});
on("gapF", v => { GAP.f = v; Shell.rerender(); });
on("gapQ", v => { GAP.q = v; rerenderList("gapList", gapTable); });
on("gapCsv", () => exportCSV("فجوة التوريد", ["الكود", "الكتاب", "الصف", "الناشر", "محجوز", "مطلوب", "وارد", "مخصص", "مسلم", "الفرق"], gapRows().map(r => [r.id, r.name, r.grade, r.pub, r.res, r.po, r.rec, r.al, r.dl, r.gap])));

// ---------------------------------------------------------------- متابعة الأعضاء: من لم يحجز + من تجاوزتهم المزامنة
const PPL = { tab: "none", dept: "", q: "", skipped: null };
function nonBookers() {
  const booked = new Set(A().resHeaders.filter(h => h.Phase_ID === APP.phaseId && h.Res_Status !== "Cancelled").map(h => h.Emp_ID));
  return A().employees.filter(e => !booked.has(e.Emp_ID) && !/موقوف|Suspended|Inactive/i.test(e.Employment_Status || ""));
}
const WA_REMIND = e => `أهلاً أ/ ${String(e.Full_Name || "").split(/\s+/)[0]} 👋\nحجز الكتب الخارجية المخفضة لأبنائك متاح الآن على منصة النقابة${phaseObj().End_DateTime ? " ويقفل " + day(phaseObj().End_DateTime) : ""}.\nادخل برقمك الوظيفي واحجز في دقيقتين: ${location.origin}`;
function pplBody() {
  if (PPL.tab === "skip") {
    if (!PPL.skipped) { setTimeout(loadSkipped, 0); return UI.skeleton(3); }
    if (PPL.skipped.error) return UI.empty("circle-alert", PPL.skipped.error);
    const s = PPL.skipped.rows, q = PPL.q.trim(), rows = q ? s.filter(r => (r.name + " " + r.job_id + " " + r.workplace).includes(q)) : s;
    const cnt = {}; s.forEach(r => { cnt[r.missing] = (cnt[r.missing] || 0) + 1; });
    return `<div class="rounded-2xl bg-sky-50 ring-1 ring-sky-100 text-sky-900 p-3 text-[13px] mb-3 flex gap-2">${ic("info", "mt-0.5")}<span>هؤلاء أعضاء في MyNekaba لا يستطيعون الدخول للمبادرة لأن بياناتهم ناقصة هناك. أكمل الناقص في MyNekaba وستضيفهم المزامنة الليلية تلقائياً (أو اضغط «مزامنة الآن»).
      ${PPL.skipped.at ? `<span class="block text-[11.5px] text-sky-700 num mt-1">آخر مزامنة: ${esc(dt(PPL.skipped.at))}</span>` : ""}</span></div>
      <div class="flex flex-wrap gap-2 mb-3">${Object.keys(cnt).map(k => `<span class="rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200 px-3 py-1 text-[12.5px] font-semibold">ينقصه ${esc(k)}: <b class="num">${fmt(cnt[k])}</b></span>`).join("")}</div>`
      + UI.table([{ t: "العضو", v: r => `<b>${esc(r.name || "—")}</b><div class="text-[11px] text-slate-400 num">${esc(r.job_id || "")}</div>` }, { t: "جهة العمل", v: r => esc(r.workplace || "") }, { t: "الناقص", v: r => `<span class="text-amber-700 font-semibold">${esc(r.missing)}</span>` }], rows, { empty: "لا أحد — كل الأعضاء بياناتهم مكتملة 🎉", emptyIcon: "users" });
  }
  const all = nonBookers(), q = PPL.q.trim();
  const depts = {}; all.forEach(e => { const k = e.Department || "غير محدد"; depts[k] = (depts[k] || 0) + 1; });
  let rows = all.filter(e => (!PPL.dept || (e.Department || "غير محدد") === PPL.dept) && (!q || (e.Full_Name + " " + e.Emp_ID + " " + e.Mobile).includes(q)));
  return `<div class="flex flex-wrap gap-2 mb-3"><select class="input input-sm !h-10 w-full sm:w-72" data-change="pplDept"><option value="">كل جهات العمل (${fmt(all.length)})</option>${Object.keys(depts).sort((a, b) => depts[b] - depts[a]).map(k => `<option value="${esc(k)}" ${PPL.dept === k ? "selected" : ""}>${esc(k)} (${fmt(depts[k])})</option>`).join("")}</select></div>`
    + UI.table([{ t: "الموظف", v: e => `<b>${empLink(e.Emp_ID, e.Full_Name)}</b><div class="text-[11px] text-slate-400 num">${esc(e.Emp_ID)}</div>` }, { t: "جهة العمل", v: e => esc(e.Department || "") }, { t: "الموبايل", cls: "num", v: e => esc(e.Mobile || "") },
      { t: "", actions: true, v: e => e.Mobile ? `<a class="btn btn-outline btn-xs !text-emerald-700" target="_blank" rel="noopener" href="${esc(Brand.waLink(e.Mobile, WA_REMIND(e)))}">${ic("message-circle")} ذكّره</a>` : "" }], rows.slice(0, 400), { empty: "كل الموظفين حجزوا 🎉", emptyIcon: "users" })
    + (rows.length > 400 ? `<div class="text-[12px] text-slate-500 mt-2">يظهر أول 400 — صدّر القائمة كاملة إلى Excel.</div>` : "");
}
async function loadSkipped() {
  const r = await call("GET_SYNC_SKIPPED", {});
  PPL.skipped = r.success ? { rows: r.rows || [], at: r.at } : { error: r.message || "تعذر التحميل" };
  rerenderList("pplBody", pplBody);
}
Router.add("/a/people", view => {
  const nb = nonBookers().length;
  view.innerHTML = UI.pageHead("متابعة الأعضاء", "من لم يحجز بعد (للتذكير)، ومن لا يستطيع الدخول لنقص بياناته في MyNekaba", `${syncBtn("btn-sm")}<button class="btn btn-outline btn-sm" data-act="pplCsv">${ic("file-spreadsheet")} Excel</button>`)
  + `<div class="card p-3 mb-3 flex flex-wrap items-center gap-2">
      <button class="btn btn-sm ${PPL.tab === "none" ? "btn-primary" : "btn-outline"}" data-act="pplTab" data-id="none">${ic("user-x")} لم يحجزوا <span class="num">(${fmt(nb)})</span></button>
      <button class="btn btn-sm ${PPL.tab === "skip" ? "btn-primary" : "btn-outline"}" data-act="pplTab" data-id="skip">${ic("user-round-x")} بياناتهم ناقصة${PPL.skipped && PPL.skipped.rows ? ` <span class="num">(${fmt(PPL.skipped.rows.length)})</span>` : ""}</button>
      <div class="flex-1"></div>${searchBox("pplQ", PPL.q, "بحث بالاسم أو الرقم")}</div>
    <div id="pplBody">${pplBody()}</div>`;
});
on("pplTab", v => { PPL.tab = v; Shell.rerender(); });
on("pplDept", v => { PPL.dept = v; rerenderList("pplBody", pplBody); });
on("pplQ", v => { PPL.q = v; rerenderList("pplBody", pplBody); });
on("pplCsv", () => {
  if (PPL.tab === "skip") return PPL.skipped && PPL.skipped.rows ? exportCSV("أعضاء بياناتهم ناقصة", ["الرقم الوظيفي", "الاسم", "جهة العمل", "الناقص"], PPL.skipped.rows.map(r => [r.job_id, r.name, r.workplace, r.missing])) : toast("القائمة لم تُحمَّل بعد", "warning");
  exportCSV("لم يحجزوا", ["الرقم الوظيفي", "الاسم", "جهة العمل", "الموبايل"], nonBookers().map(e => [e.Emp_ID, e.Full_Name, e.Department, e.Mobile]));
});

// ---------------------------------------------------------------- تقارير المدير الإضافية
REPORTS.unshift(["R00", "presentation", "تقرير المجلس", "صفحة واحدة بالأرقام الرئيسية للطباعة"]);
REPORTS.push(["R15", "building-2", "ربحية الناشرين", "إيراد وتكلفة وهامش كل ناشر"], ["R16", "wand-sparkles", "ماذا لو؟", "أثر تغيير خصم الموظفين على النقابة"]);
const WHATIF = { pct: null };
/** مقاييس المرحلة: كل بند محجوز بسعر الكتاب الحالي (بنده إن ثُبِّت) */
function phaseMoney() {
  const { b } = maps(); let cover = 0, emp = 0, cost = 0, qty = 0, unpriced = 0;
  const pub = {};
  phaseItems().forEach(i => {
    const bk = b[i.Book_ID] || {}, q = n(i.Net_Billable_Qty) || n(i.Requested_Qty), ep = n(i.Unit_Emp_Price) || n(bk.Emp_Selling_Price), cp = n(i.Unit_Cover_Price) || n(bk.Cover_Price), co = n(bk.Standard_Net_Cost);
    if (!ep) { unpriced += q; return; }
    qty += q; cover += q * cp; emp += q * ep; cost += q * co;
    const p = pub[bk.Publisher || "غير محدد"] = pub[bk.Publisher || "غير محدد"] || { q: 0, cover: 0, emp: 0, cost: 0, books: new Set() };
    p.q += q; p.cover += q * cp; p.emp += q * ep; p.cost += q * co; p.books.add(i.Book_ID);
  });
  return { cover, emp, cost, qty, unpriced, margin: emp - cost, savings: cover - emp, pub };
}
const _renderReport = renderReport;
renderReport = async function () {
  const sel = Rep.sel, area = $("#repArea");
  if (!["R00", "R15", "R16"].includes(sel)) return _renderReport();
  if (!A() || !area) return;
  const M = phaseMoney(), ph = phaseObj(), d = A(), { e, b } = maps();
  let h = "";
  if (sel === "R00") {
    const heads = d.resHeaders.filter(x => x.Phase_ID === APP.phaseId && x.Res_Status !== "Cancelled"), invs = d.empInvoices.filter(i => i.Phase_ID === APP.phaseId);
    const paid = sum(invs, "Total_Paid_Amount"), rem = sum(invs, "Remaining_Balance"), exp = d.expenses.filter(x => x.Phase_ID === APP.phaseId).reduce((s, x) => s + n(x.Amount), 0);
    const kids = {}; phaseItems().forEach(i => { const k = (b[i.Book_ID] || {}).Stage || "أخرى"; kids[k] = (kids[k] || 0) + n(i.Requested_Qty); });
    const benef = new Set(phaseItems().map(i => i.Emp_ID + "|" + (i.Beneficiary || ""))).size;
    const dep = {}; heads.forEach(x => { const k = (e[x.Emp_ID] || {}).Department || "غير محدد"; dep[k] = (dep[k] || 0) + 1; });
    h = `<div class="text-center mb-4"><div class="text-[13px] text-slate-500">${esc(Brand.get().org || "")}</div><h3 class="text-xl font-bold text-slate-900">تقرير مبادرة الكتب المخفضة — ${esc(ph.Phase_Name || "")}</h3><div class="text-[12px] text-slate-500 num">حتى ${esc(dt(new Date().toISOString()))}</div></div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        ${UI.kpi("موظفون مستفيدون", fmt(heads.length), { icon: "users", foot: `${Math.round(heads.length / (d.employees.length || 1) * 100)}% من ${fmt(d.employees.length)} عضو` })}
        ${UI.kpi("أبناء وأقارب مستفيدون", fmt(benef), { icon: "graduation-cap", tone: "blue" })}
        ${UI.kpi("نسخ محجوزة", fmt(M.qty + M.unpriced), { icon: "book-open", tone: "gray", foot: M.unpriced ? `${fmt(M.unpriced)} نسخة بانتظار السعر` : "" })}
        ${UI.kpi("وفّرها الموظفون", money(M.savings), { icon: "piggy-bank", tone: "green", foot: M.cover ? `${Math.round(M.savings / M.cover * 100)}% من سعر الغلاف` : "" })}
      </div>
      ${kvTable([["قيمة الكتب بسعر الغلاف", money(M.cover)], ["قيمتها بسعر الموظف", money(M.emp)], ["تكلفتها على النقابة (بعد خصم المكتبة)", money(M.cost)], ["هامش النقابة من الكتب", `<b class="${M.margin < 0 ? "text-rose-600" : "text-emerald-600"}">${money(M.margin)}</b>`], ["المصروفات", money(exp)], ["الصافي التقديري", `<b>${money(M.margin - exp)}</b>`], ["المحصَّل من الموظفين", money(paid)], ["المتبقي على الموظفين", money(rem)]])}
      <div class="grid gap-4 md:grid-cols-2 mt-4">${UI.section("النسخ حسب المرحلة الدراسية", "", UI.bars(Object.keys(kids).map(k => ({ label: k, value: kids[k] }))))}
        ${UI.section("أكثر جهات العمل مشاركة", "", UI.bars(Object.keys(dep).sort((x, y) => dep[y] - dep[x]).slice(0, 8).map(k => ({ label: k, value: dep[k], tone: "bg-sky-500" }))))}</div>`;
  } else if (sel === "R15") {
    const rows = Object.keys(M.pub).map(k => Object.assign({ k, m: M.pub[k].emp - M.pub[k].cost }, M.pub[k])).sort((x, y) => y.emp - x.emp);
    h = `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">${UI.kpi("إيراد الكتب", money(M.emp), { icon: "receipt" })}${UI.kpi("التكلفة", money(M.cost), { icon: "landmark", tone: "gray" })}${UI.kpi("الهامش", money(M.margin), { icon: "trending-up", tone: M.margin < 0 ? "red" : "green" })}${UI.kpi("ناشرون بخسارة", fmt(rows.filter(r => r.m < 0).length), { icon: "triangle-alert", tone: rows.some(r => r.m < 0) ? "red" : "green" })}</div>`
      + UI.table([{ t: "الناشر", v: r => `<b>${esc(r.k)}</b><div class="text-[11px] text-slate-400">${fmt(r.books.size)} كتاب</div>` }, { t: "نسخ", cls: "num", v: r => fmt(r.q) }, { t: "بسعر الغلاف", cls: "num", v: r => fmt(Math.round(r.cover)) }, { t: "إيراد الموظفين", cls: "num", v: r => fmt(Math.round(r.emp)) }, { t: "التكلفة", cls: "num", v: r => fmt(Math.round(r.cost)) },
        { t: "الهامش", cls: "num", v: r => `<b class="${r.m < 0 ? "text-rose-600" : "text-emerald-600"}">${fmt(Math.round(r.m))}</b>` }, { t: "النسبة", cls: "num", v: r => r.emp ? Math.round(r.m / r.emp * 100) + "%" : "—" }], rows, { empty: "لا حجوزات مسعّرة بعد", emptyIcon: "building-2" });
  } else {
    const cur = M.cover ? Math.round((1 - M.emp / M.cover) * 100) : n((A().settingsMap || {}).UNIFIED_EMP_DISCOUNT_PCT);
    if (WHATIF.pct === null) WHATIF.pct = cur;
    const nEmp = M.cover * (1 - WHATIF.pct / 100), nm = nEmp - M.cost;
    h = `<p class="text-[13.5px] text-slate-600 mb-3">حرّك نسبة خصم الموظفين وشوف أثرها على الحجوزات الحالية (${fmt(M.qty)} نسخة مسعّرة). التكلفة على النقابة ثابتة = ${money(M.cost)}.</p>
      <div class="card p-4 mb-4"><div class="flex items-center justify-between"><span class="font-semibold">خصم الموظف</span><b class="text-2xl num text-brand-800">${WHATIF.pct}%</b></div>
        <input type="range" min="0" max="60" step="1" value="${WHATIF.pct}" class="w-full mt-3 accent-[#6a3aa0]" data-change="wfPct"><div class="text-[12px] text-slate-500 mt-1">الخصم الفعلي الحالي ≈ ${cur}%</div></div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">${UI.kpi("يدفعه الموظفون", money(nEmp), { icon: "wallet" })}${UI.kpi("يوفّرونه", money(M.cover - nEmp), { icon: "piggy-bank", tone: "green" })}
        ${UI.kpi(nm >= 0 ? "فائض النقابة" : "تدعمه النقابة", `<span class="${nm < 0 ? "text-rose-600" : "text-emerald-600"}">${money(Math.abs(nm))}</span>`, { icon: nm < 0 ? "hand-coins" : "trending-up", tone: nm < 0 ? "red" : "green" })}
        ${UI.kpi("الفرق عن الوضع الحالي", money(nm - M.margin), { icon: "scale", tone: "gray" })}</div>
      <div class="text-[12px] text-slate-500 mt-3">أقصى خصم بلا دعم من النقابة ≈ <b class="num">${M.cover ? Math.floor((1 - M.cost / M.cover) * 100) : 0}%</b>. الأداة للتقدير فقط ولا تغيّر أي سعر.</div>`;
  }
  if (Rep.sel === sel && $("#repArea")) $("#repArea").innerHTML = h;
};
on("wfPct", v => { WHATIF.pct = n(v); renderReport(); });
Rep.sel = "R00";

// ---------------------------------------------------------------- «اسأل البيانات»: فلاتر جاهزة + تحليل الأسر
const ASK = { dept: "", stage: "", grade: "", st: "booked" };
const ASK_ST = [["booked", "حجزوا"], ["none", "لم يحجزوا"], ["down", "لم يسددوا المقدم"], ["waiting", "لهم نسخ في الانتظار"], ["ready", "كتبهم جاهزة ولم يستلموا"], ["done", "استلموا كل كتبهم"], ["owes", "عليهم رصيد"], ["rel", "حجزوا لأقارب"]];
function askRows() {
  const d = A(), { b } = maps(), items = phaseItems(), byEmp = {};
  items.forEach(i => { (byEmp[i.Emp_ID] = byEmp[i.Emp_ID] || []).push(i); });
  const inv = {}; d.empInvoices.filter(x => x.Phase_ID === APP.phaseId).forEach(x => { inv[x.Emp_ID] = x; });
  return d.employees.filter(e => !ASK.dept || (e.Department || "غير محدد") === ASK.dept).map(e => {
    let its = byEmp[e.Emp_ID] || [];
    if (ASK.stage) its = its.filter(i => (b[i.Book_ID] || {}).Stage === ASK.stage);
    if (ASK.grade) its = its.filter(i => (b[i.Book_ID] || {}).Grade === ASK.grade);
    const v = inv[e.Emp_ID] || {}, req = its.reduce((s, i) => s + n(i.Requested_Qty), 0), al = its.reduce((s, i) => s + n(i.Allocated_Qty), 0), dl = its.reduce((s, i) => s + n(i.Delivered_Qty), 0);
    return { e, its, req, al, dl, amt: its.reduce((s, i) => s + n(i.Requested_Qty) * (n(i.Unit_Emp_Price) || n((b[i.Book_ID] || {}).Emp_Selling_Price)), 0), inv: v,
      down: Math.max(0, n(v.Down_Payment_Required) - n(v.Total_Paid_Amount)), rem: n(v.Remaining_Balance), rel: its.some(i => i.Beneficiary) };
  }).filter(r => {
    const any = (ASK.stage || ASK.grade) ? r.req > 0 : (byEmp[r.e.Emp_ID] || []).length > 0;
    return { booked: any, none: !any && !(byEmp[r.e.Emp_ID] || []).length, down: any && r.inv.Emp_Inv_ID && r.down > 0, waiting: any && r.req > Math.max(r.al, r.dl), ready: r.al > r.dl, done: any && r.dl >= r.req, owes: r.rem > 0, rel: r.rel }[ASK.st];
  });
}
function askBody() {
  const rows = askRows();
  return `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">${UI.kpi("عدد الموظفين", fmt(rows.length), { icon: "users" })}${UI.kpi("النسخ", fmt(sum(rows, "req")), { icon: "book-open", tone: "blue" })}${UI.kpi("القيمة", money(sum(rows, "amt")), { icon: "receipt", tone: "gray" })}${UI.kpi("المتبقي عليهم", money(sum(rows, "rem")), { icon: "hand-coins", tone: "amber" })}</div>`
    + UI.table([{ t: "الموظف", v: r => `<b>${empLink(r.e.Emp_ID, r.e.Full_Name)}</b><div class="text-[11px] text-slate-400 num">${esc(r.e.Emp_ID)} · ${esc(r.e.Department || "")}</div>` },
      { t: "نسخ", cls: "num", v: r => fmt(r.req) }, { t: "مُسلَّم", cls: "num", v: r => fmt(r.dl) }, { t: "القيمة", cls: "num", v: r => fmt(Math.round(r.amt)) }, { t: "المقدم الباقي", cls: "num", v: r => r.down ? `<b class="text-rose-600">${fmt(r.down)}</b>` : "" }, { t: "المتبقي", cls: "num", v: r => fmt(r.rem) },
      { t: "", actions: true, v: r => r.e.Mobile ? `<a class="btn btn-outline btn-xs !text-emerald-700" target="_blank" rel="noopener" href="${esc(Brand.waLink(r.e.Mobile, ""))}">${ic("message-circle")} واتساب</a>` : "" }], rows.slice(0, 400), { empty: "لا أحد يطابق هذا السؤال", emptyIcon: "search" });
}
function familyBox() {
  const per = {}, grades = {}, rel = {}; let fam = 0, kids = 0;
  A().employees.forEach(e => { let k = []; try { k = (JSON.parse(e.Kids_JSON || "{}").kids) || []; } catch (_) {} if (!k.length) return; fam++; kids += k.length;
    const c = Math.min(k.length, 5); per[c] = (per[c] || 0) + 1; k.forEach(x => { if (x.grade) grades[x.grade] = (grades[x.grade] || 0) + 1; if (x.rel) rel[x.rel] = (rel[x.rel] || 0) + 1; }); });
  if (!fam) return UI.empty("users", "لم يسجّل الموظفون أبناءهم بعد", "تظهر هنا بيانات الأسر بعد إضافة الأبناء من التطبيق.");
  const gl = ((A().catalog || {}).grades || []), gName = c => (gl.find(g => g.code === c) || {}).label || c, ord = c => { const i = gl.findIndex(g => g.code === c); return i < 0 ? 99 : i; };
  return `<div class="grid grid-cols-3 gap-2 mb-4">${UI.stat("أسر سجّلت أبناءها", fmt(fam))}${UI.stat("عدد الأبناء", fmt(kids))}${UI.stat("متوسط الأبناء", (Math.round(kids / fam * 10) / 10).toLocaleString("ar-EG"))}</div>
    <div class="grid gap-4 md:grid-cols-2"><div><div class="label">عدد الأبناء في الأسرة</div>${UI.bars([1, 2, 3, 4, 5].filter(c => per[c]).map(c => ({ label: c === 5 ? "5 فأكثر" : c + (c === 1 ? " ابن" : " أبناء"), value: per[c] })))}</div>
      <div><div class="label">الأبناء حسب الصف</div>${UI.bars(Object.keys(grades).sort((a, b) => ord(a) - ord(b)).map(g => ({ label: gName(g), value: grades[g], tone: "bg-sky-500" })))}</div></div>`;
}
Router.add("/a/ask", view => {
  const d = A(), { b } = maps(), depts = [...new Set(d.employees.map(e => e.Department || "غير محدد"))].sort((x, y) => x.localeCompare(y, "ar"));
  const stages = [...new Set(d.books.map(x => x.Stage).filter(Boolean))], grades = [...new Set(d.books.filter(x => !ASK.stage || x.Stage === ASK.stage).map(x => x.Grade).filter(Boolean))];
  const sel = (k, opts, all) => `<select class="input input-sm !h-10" data-change="askF" data-id="${k}"><option value="">${all}</option>${opts.map(o => `<option value="${esc(o)}" ${ASK[k] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  view.innerHTML = UI.pageHead("اسأل البيانات", "اختار السؤال من القوائم وهتطلع لك الإجابة والقائمة فوراً", `<button class="btn btn-outline btn-sm" data-act="askCsv">${ic("file-spreadsheet")} Excel</button>`)
    + `<div class="card p-4 mb-4"><div class="text-[15px] font-bold text-slate-800 leading-loose">كم موظف
      <select class="input input-sm !h-10 inline-block !w-auto mx-1" data-change="askF" data-id="st">${ASK_ST.map(s => `<option value="${s[0]}" ${ASK.st === s[0] ? "selected" : ""}>${s[1]}</option>`).join("")}</select></div>
      <div class="grid gap-2 sm:grid-cols-3 mt-2">${sel("dept", depts, "من كل جهات العمل")}${sel("stage", stages, "كل المراحل الدراسية")}${sel("grade", grades, "كل الصفوف")}</div></div>
    <div id="askBody">${askBody()}</div>
    <div class="mt-6">${UI.section(`${ic("users", "text-brand-600")} تحليل الأسر`, "من بيانات الأبناء التي سجّلها الموظفون — تفيد في تخطيط كميات العام القادم", familyBox())}</div>`;
});
on("askF", (v, el) => { ASK[el.dataset.id] = v; if (el.dataset.id === "stage") ASK.grade = ""; Shell.rerender(); });
on("askCsv", () => exportCSV("اسأل البيانات", ["الرقم", "الاسم", "جهة العمل", "الموبايل", "نسخ", "مسلم", "القيمة", "المقدم الباقي", "المتبقي"], askRows().map(r => [r.e.Emp_ID, r.e.Full_Name, r.e.Department, r.e.Mobile, r.req, r.dl, Math.round(r.amt), r.down, r.rem])));

// ---------------------------------------------------------------- رقابة: العمليات الحساسة خلال 7 أيام (في لوحة القيادة)
const SENSITIVE = { VOID_EMPLOYEE_PAYMENT: "إلغاء إيصال", DELETE_EMP_INVOICE: "حذف فاتورة", ADJUST_EMP_INVOICE: "تعديل فاتورة", MANUAL_ALLOCATION_OVERRIDE: "تخصيص يدوي استثنائي", SAVE_ROLE_PERMISSIONS: "تغيير الصلاحيات", REFUND_EMPLOYEE_CREDIT: "رد رصيد", RECORD_STOCK_ADJUSTMENT: "تسوية مخزن", CANCEL_UNDELIVERED_QTY: "إلغاء كميات", CUSTOMIZE_EMP_INSTALLMENTS: "تعديل أقساط" };
function watchBox() { if (!can("GET_AUDIT_LOG")) return ""; setTimeout(loadWatch, 0); return `<div class="mt-4 sm:mt-6">${UI.section(`${ic("shield-alert", "text-rose-500")} عمليات حساسة — آخر 7 أيام`, "إلغاء إيصالات وتعديل فواتير وصلاحيات… للمراجعة", `<div id="watchBody">${UI.skeleton(1)}</div>`, `<a href="#/a/audit" class="btn btn-ghost btn-sm">السجل ${ic("chevron-left")}</a>`)}</div>`; }
async function loadWatch() {
  const r = await call("GET_AUDIT_LOG", { days: 7, limit: 1000 }), el = $("#watchBody"); if (!el) return;
  if (!r.success) { el.innerHTML = `<div class="text-sm text-slate-500">${esc(r.message || "")}</div>`; return; }
  const rows = (r.entries || []).filter(a => SENSITIVE[a.action]);
  el.innerHTML = rows.length ? `<ul class="divide-y divide-slate-100">${rows.slice(0, 8).map(a => `<li class="flex items-center gap-3 py-2"><span class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">${ic("triangle-alert")}</span><div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px]">${esc(SENSITIVE[a.action])} <span class="text-slate-400 font-normal num">${esc(a.key || "")}</span></div><div class="text-[11.5px] text-slate-500 num">${esc(a.user || "")} · ${esc(dt(a.t))}</div></div></li>`).join("")}</ul>${rows.length > 8 ? `<div class="text-[12px] text-slate-500 mt-2">و${fmt(rows.length - 8)} عملية أخرى في السجل</div>` : ""}`
    : `<div class="rounded-2xl bg-emerald-50 text-emerald-700 p-3 text-sm font-semibold flex items-center gap-2">${ic("shield-check")} لا عمليات حساسة هذا الأسبوع</div>`;
}
