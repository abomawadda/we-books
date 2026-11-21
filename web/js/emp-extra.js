/* ============================================================================
 * إضافات الموظف: إشعار تسعير الكتب وجاهزيتها، بطاقة «وفّرت هذا العام»، قواعد بعد القفل، الخط الكبير
 * ========================================================================== */
"use strict";
// ---------------------------------------------------------------- إشعارات محسوبة للموظف
const _notifList = Notif.list;
Notif.list = function () {
  const out = _notifList.call(Notif);
  if (!(APP.user && APP.user.userType === "EMPLOYEE" && APP.emp)) return out;
  const bm = Emp.bookMap(), items = Emp.phaseItems().filter(i => !String(i.Allocation_Status).startsWith("Cancelled"));
  items.filter(i => !n(i.Unit_Emp_Price) && n((bm[i.Book_ID] || {}).Emp_Selling_Price)).forEach(i => {
    const b = bm[i.Book_ID];
    out.unshift({ id: "priced-" + i.Book_ID + "-" + b.Emp_Selling_Price, icon: "badge-percent", tone: "green", title: `اتسعّر «${bookLbl(b, i.Book_ID)}» 🎉`, body: `سعره لك ${fmt(b.Emp_Selling_Price)} ج.م بدل ${fmt(b.Cover_Price)}${i.Beneficiary ? " — لـ " + i.Beneficiary : ""}`, href: "#/e/orders" });
  });
  const ready = items.reduce((s, i) => s + Math.max(0, n(i.Allocated_Qty) - n(i.Delivered_Qty)), 0);
  if (ready) out.unshift({ id: "ready-" + ready, icon: "package-check", tone: "green", title: `كتبك جاهزة — ${booksWord(ready)} 📦`, body: "افتح «حجوزاتي» تشوف موعدك ورمز الاستلام", href: "#/e/orders" });
  return out;
};

// ---------------------------------------------------------------- «وفّرت هذا العام»
/** التوفير: الفعلي (مراحل صدرت فاتورتها — بالكميات المفوترة) والمتوقع (مراحل لسه — بالمحجوز المسعّر) + الكتب اللي لسه ما اتسعّرتش */
function saveCalc(items) {
  const r = APP.emp, bm = Emp.bookMap(), invOf = pid => (r.myInvoices || []).find(x => x.Phase_ID === pid);
  const o = { aCover: 0, aNet: 0, aBooks: 0, eCover: 0, eNet: 0, eBooks: 0, unpriced: 0, delivered: 0, phases: {} };
  items.filter(i => !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward").forEach(i => {
    const b = bm[i.Book_ID] || {}, ep = n(i.Unit_Emp_Price) || n(b.Emp_Selling_Price), cp = n(i.Unit_Cover_Price) || n(b.Cover_Price);
    o.delivered += n(i.Delivered_Qty); o.phases[i.Phase_ID] = 1;
    if (invOf(i.Phase_ID)) { const q = Math.max(0, Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)) - n(i.Returned_Qty)); if (!q || !ep || !cp) return; o.aCover += q * cp; o.aNet += q * ep; o.aBooks += q; }
    else { const q = n(i.Requested_Qty); if (!ep || !cp) { o.unpriced += q; return; } o.eCover += q * cp; o.eNet += q * ep; o.eBooks += q; }
  });
  o.aSave = Math.max(0, o.aCover - o.aNet); o.eSave = Math.max(0, o.eCover - o.eNet);
  return o;
}
function mySavings() { const c = saveCalc(Emp.phaseItems()), act = c.aBooks > 0;
  return act ? { cover: c.aCover, paid: c.aNet, save: c.aSave, books: c.aBooks, actual: true, unpriced: 0, delivered: c.delivered } : { cover: c.eCover, paid: c.eNet, save: c.eSave, books: c.eBooks, actual: false, unpriced: c.unpriced, delivered: 0 }; }
function savingsCard() {
  const s = mySavings(); if (s.save < 1) return "";
  const pct = Math.round(s.save / s.cover * 100), got = s.actual && s.delivered > 0;
  if (got) return `<section class="card overflow-hidden mb-4 text-white" style="background:linear-gradient(135deg,#059669,#065f46)"><div class="p-4 sm:p-5 flex items-center gap-4">
    <span class="text-[42px] leading-none">🎉</span>
    <div class="flex-1 min-w-0"><div class="text-[13px] font-bold text-emerald-100">${gTxt("مبروك! كتب ولادك وصلتك… ووفّرت", "مبروك! كتب ولادك وصلتك… ووفّرتي")}</div><div class="font-display font-bold text-[28px] num leading-tight">${fmt(Math.round(s.save))} <span class="text-[14px]">ج.م</span></div>
      <div class="text-[12px] text-emerald-100">على ${booksWord(s.books)} · ${pct}% أقل من سعر الغلاف — فلوس رجعت لجيبك 💚</div></div>
    <button class="btn btn-sm shrink-0 bg-white text-emerald-800" data-act="shareSave">${ic("send")} شارك</button></div></section>`;
  return `<section class="card overflow-hidden mb-4" style="background:linear-gradient(135deg,#f0fdf4,#fefce8)"><div class="p-4 sm:p-5 flex items-center gap-4">
    <span class="text-[40px] leading-none">💰</span>
    <div class="flex-1 min-w-0"><div class="text-[12.5px] font-bold text-emerald-700">${s.actual ? gTxt("وفّرت في الفاتورة", "وفّرتي في الفاتورة") : "التوفير المتوقع"}</div><div class="font-display font-bold text-[26px] text-emerald-800 num leading-tight">${s.actual ? "" : "≈ "}${fmt(Math.round(s.save))} <span class="text-[14px]">ج.م</span></div>
      <div class="text-[12px] text-slate-500">على ${booksWord(s.books)} · ${pct}% أقل من سعر الغلاف</div>
      ${s.actual ? "" : `<div class="text-[11.5px] text-amber-700 mt-1">${ic("info", "inline -mt-0.5 !w-3.5 !h-3.5")} ${s.unpriced ? `+ ${booksWord(s.unpriced)} لسه جاري تسعيرها، و` : ""}المبلغ النهائي بيتحدد في الفاتورة عند التوزيع</div>`}</div>
    ${s.actual ? `<button class="btn btn-success btn-sm shrink-0" data-act="shareSave">${ic("send")} شارك</button>` : ""}</div></section>`;
}
on("shareSave", () => {
  const s = mySavings();
  const txt = `💰 ${s.actual ? "وفّرت" : "هوفّر حوالي"} ${fmt(Math.round(s.save))} ج.م على كتب أولادي الخارجية السنة دي (${Math.round(s.save / s.cover * 100)}% أقل من السعر قبل الخصم) مع مبادرة الكتب المخفضة — ${Brand.get().org} 📚\nنقابتك معاك… من أول كتاب\n${location.origin}`;
  if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank");
});

// ---------------------------------------------------------------- قواعد التعديل بعد قفل الحجز
function closedRulesBox() {
  const ph = (APP.emp || {}).activePhase || {}, items = Emp.phaseItems().filter(i => !String(i.Allocation_Status).startsWith("Cancelled"));
  if (ph.Booking_Open || !items.length) return "";
  // بعد التوزيع/التسليم: رسالة «اتطلبت من المكتبة» مالهاش لازمة
  if (allocRan(ph, items)) {
    const left = items.reduce((s, i) => s + Math.max(0, n(i.Allocated_Qty) - n(i.Delivered_Qty)), 0);
    const st = ph.Effective_Status || ph.Phase_Status, openPh = ((APP.emp || {}).phases || []).find(p => p.Booking_Open && p.Phase_ID !== ph.Phase_ID);
    if (left > 0) return "";
    if (st !== "Completed" && !items.every(i => n(i.Delivered_Qty) >= n(i.Allocated_Qty))) return "";
    return `<div class="mb-4 rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-900 p-3.5 text-[13px] leading-relaxed flex gap-2.5">${ic("circle-check", "mt-0.5 text-emerald-600")}<div>
      <b>${esc(ph.Phase_Name || "المرحلة")} ${st === "Completed" ? "انتهت" : "خلصت عندك"}.</b> ${openPh ? `الحجز مفتوح دلوقتي في «${esc(openPh.Phase_Name)}».` : "أول ما تتفتح مرحلة جديدة هتلاقيها هنا وهنبلغك في الجرس 🔔"}
      ${openPh ? `<button class="text-brand-700 font-semibold underline mr-1" data-act="setPhase" data-id="${esc(openPh.Phase_ID)}">احجز فيها</button>` : ""}</div></div>`;
  }
  return `<div class="mb-4 rounded-2xl bg-sky-50 ring-1 ring-sky-100 text-sky-900 p-3.5 text-[13px] leading-relaxed flex gap-2.5">${ic("info", "mt-0.5 text-sky-600")}<div>
    <b>الحجز اتقفل.</b> ${st0(ph) === "Closed" ? "الطلبات بتتجمّع دلوقتي عشان تتبعت للمكتبة" : "الكتب اتطلبت من المكتبة بعدد الحجوزات"}، فأي تقليل أو إلغاء دلوقتي بيبقى عن طريق المسؤول بس وممكن يترفض لو الكتاب اتورّد.
    <button class="text-brand-700 font-semibold underline mr-1" data-act="contact">كلّم المسؤول</button> · <button class="text-brand-700 font-semibold underline" data-act="faq">أسئلة شائعة</button></div></div>`;
}
const st0 = ph => ph.Effective_Status || ph.Phase_Status;

// ---------------------------------------------------------------- تركيب الإضافات في الصفحات
const _wrap = (path, fn) => { const base = Router.routes[path]; if (base) Router.add(path, view => { base(view); fn(view); }); };
const afterHead = (view, html) => { if (!html) return; const h = view.firstElementChild; if (h) h.insertAdjacentHTML("afterend", html); else view.insertAdjacentHTML("afterbegin", html); };
_wrap("/e/orders", view => { afterHead(view, closedRulesBox()); afterHead(view, savingsCard()); });

// ---------------------------------------------------------------- خط أكبر (لكبار السن)
const BIG_KEY = "wb_bigtext";
const applyBig = () => { let on_ = false; try { on_ = localStorage.getItem(BIG_KEY) === "1"; } catch (_) {} document.documentElement.style.zoom = on_ ? "1.15" : ""; return on_; };
applyBig();
on("bigText", () => { let v = false; try { v = localStorage.getItem(BIG_KEY) !== "1"; localStorage.setItem(BIG_KEY, v ? "1" : "0"); } catch (_) {} applyBig(); toast(v ? "تم تكبير الخط 👓" : "رجع الخط لحجمه العادي", "success"); Shell.rerender(); });
_wrap("/e/me", view => {
  const btn = view.querySelector('[data-act="faq"]'); if (!btn) return;
  let big = false; try { big = localStorage.getItem(BIG_KEY) === "1"; } catch (_) {}
  btn.insertAdjacentHTML("beforebegin", `<button data-act="bigText" class="w-full flex items-center gap-3 px-4 py-3.5 text-right"><span class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-[18px] font-bold">أ</span><span class="flex-1"><b class="block text-[14.5px] text-slate-800">خط أكبر</b><span class="text-[12px] text-slate-500">أسهل في القراءة</span></span><span class="w-11 h-6 rounded-full ${big ? "bg-emerald-500" : "bg-slate-200"} relative transition"><span class="absolute top-0.5 ${big ? "left-0.5" : "right-0.5"} w-5 h-5 rounded-full bg-white shadow"></span></span></button>`);
});

// ---------------------------------------------------------------- كتب لم تصل بعد: ترحيل أو إنهاء الحجز على المتاح
function waitBox() {
  const ph = (APP.emp || {}).activePhase || {};
  if (ph.Booking_Open || !allocRan(ph, Emp.phaseItems())) return ""; // قبل التوزيع: الشحنة لسه بتتجهز — مفيش «كتب موصلتش»
  const bm = Emp.bookMap(), w = Emp.phaseItems().filter(i => !String(i.Allocation_Status).startsWith("Cancelled") && n(i.Requested_Qty) > Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)));
  if (!w.length) return "";
  const decided = w.every(i => i.Waitlist_Choice === "carry");
  const list = w.map(i => { const b = bm[i.Book_ID] || {}, g = Doc.shortGrade(b.Grade); return `<li class="flex items-center gap-2 py-1.5 min-w-0"><span class="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span><span class="flex-1 min-w-0 truncate whitespace-nowrap"><b>${esc(b.Publisher || b.Book_Name || i.Book_ID)}</b> · ${esc(b.Subject || "")}${g ? ` · <span class="text-slate-500">${esc(g)}</span>` : ""}${i.Beneficiary ? ` · <span class="text-sky-700">${esc(i.Beneficiary)}</span>` : ""}</span><span class="num text-slate-500 shrink-0">${fmt(n(i.Requested_Qty) - Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)))}</span></li>`; }).join("");
  return `<section class="card mb-4 ring-2 ring-sky-200 overflow-hidden"><div class="p-4">
    <div class="flex items-center gap-2 font-bold text-[15.5px] text-sky-900">⏳ كتب لسه موصلتش</div>
    <p class="text-[12.5px] text-slate-600 mt-1">مش داخلة في فاتورتك ومش هتدفع تمنها دلوقتي.</p>
    <ul class="mt-2 text-[13.5px] divide-y divide-slate-100">${list}</ul>
    ${decided ? `<div class="mt-3 rounded-xl bg-emerald-50 text-emerald-800 p-3 text-[13px] font-semibold">${ic("circle-check")} هتترحّل للمرحلة الجاية بأسبقيتك.</div>
      <button class="btn btn-outline btn-sm w-full mt-2" data-act="printLeftoverE">${ic("printer")} اطبع طلب الحجز بالمتبقي</button>
      <button class="btn btn-ghost btn-sm w-full mt-2 !text-rose-600" data-act="waitDecide" data-id="cancel">لا، أنهي حجزي على اللي وصل بس</button>`
    : `<div class="grid gap-2 mt-3"><button class="btn btn-primary !h-12" data-act="waitDecide" data-id="carry">${ic("check")} رحّلها للمرحلة الجاية</button>
      <button class="btn btn-outline !h-11" data-act="waitDecide" data-id="cancel">أنهي حجزي على اللي وصل بس</button></div>`}
  </div></section>`;
}
on("waitDecide", async v => {
  if (v === "cancel" && !await UI.confirm({ title: "إنهاء الحجز على المتاح", message: "الكتب اللي لسه موصلتش هتتلغي من حجزك ومش هتترحّل. متأكد؟", ok: "أيوه، ألغيها", tone: "danger" })) return;
  const r = await call("WAITLIST_DECISION", { choice: v, phaseId: APP.phaseId }, { block: true });
  if (!r.success) return toast(r.message, "danger");
  if (v === "cancel") { await reloadData(); return happyDialog("💜", "ولا يهمك أبداً!", "قفلنا حجزك على الكتب اللي وصلت. شكراً إنك كنت معانا — وأي وقت تحتاج كتب، المبادرة مستنياك 🌷"); }
  if (r.carriedTo) {
    // انتقل للمرحلة المفتوحة فوراً: كتبه المرحّلة جاهزة في حجزه الجديد لكل ابن
    APP.phaseId = r.carriedTo.id; APP.phasePicked = true; Emp.dirty = false;
    await Emp.load();
    const m = UI.open(`<div class="text-center"><div class="text-[48px] leading-none">🚚</div>
      <div class="font-display font-bold text-[19px] mt-2">كتبك اترحّلت بنجاح!</div>
      <p class="text-[13.5px] text-slate-600 mt-2 leading-relaxed">${booksWord(r.count || 0)} دخلت حجزك في <b>«${esc(r.carriedTo.name)}»</b> بأسبقيتك الأصلية، كل كتاب باسم صاحبه 👦👧</p>
      <p class="text-[13.5px] font-semibold text-slate-800 mt-3">عايز تزوّد كتب في المرحلة دي، ولا تراجع حجزك وتنهي؟</p></div>
      <div class="grid gap-2 mt-4"><button class="btn btn-primary !h-12" data-go="/e/wiz">${ic("plus")} أزوّد كتب</button>
      <button class="btn btn-outline !h-11" data-go="/e/orders">${ic("check")} أراجع حجزي وخلاص كده</button></div>`, { title: "تم الترحيل 🎉" });
    $$("[data-go]", m.root).forEach(b => b.addEventListener("click", () => { m.close(); setTimeout(() => Router.go(b.dataset.go), 300); }));
    return;
  }
  await reloadData();
  happyDialog("📦", "اتحجزت لك في الدفعة الجديدة!", "كتبك اللي لسه موصلتش محفوظة بأسبقيتك، وأول ما المرحلة الجديدة تتفتح هتلاقيها في حجزك وهنبلغك على طول 🔔");
});
/** نافذة مبهجة قصيرة */
function happyDialog(emoji, title, body, cta) {
  return UI.open(`<div class="text-center"><div class="text-[48px] leading-none">${emoji}</div><div class="font-display font-bold text-[19px] mt-2">${esc(title)}</div>
    <p class="text-[13.5px] text-slate-600 mt-2 leading-relaxed">${esc(body)}</p><button class="btn btn-primary w-full mt-4 !h-11" data-close>${esc(cta || "تمام 👌")}</button></div>`, { title: " " });
}
_wrap("/e/orders", view => afterHead(view, waitBox()));

// ---------------------------------------------------------------- الانتقال بين المراحل: الموظف في قلب الحدث
/** ملخص حجز الموظف في مرحلة: محجوز/مُسلَّم/منتظر/مُرحَّل */
function phaseSummary(pid) {
  const its = (APP.emp.myReservationItems || []).filter(i => i.Phase_ID === pid && !String(i.Allocation_Status).startsWith("Cancelled"));
  const s = { req: 0, deliv: 0, wait: 0, carried: 0, ready: 0 };
  its.forEach(i => { const rq = n(i.Requested_Qty), al = n(i.Allocated_Qty), dl = n(i.Delivered_Qty);
    const carried = i.Allocation_Status === "Carried_Forward" || /رُحِّلت/.test(i.Unallocated_Reason || "");
    const kids = (APP.emp.myReservationItems || []).filter(x => x.Carried_From_Item_ID === i.Res_Item_ID), dead = kids.length && kids.every(x => String(x.Allocation_Status).startsWith("Cancelled"));
    s.req += rq; s.deliv += dl; s.ready += Math.max(0, al - dl); if (!carried) s.wait += Math.max(0, rq - Math.max(al, dl)); // المُرحَّل خرج من المرحلة دي
    if (carried && !dead) s.carried += 1; });
  return s;
}
/** بطاقة «مرحلة جديدة»: تظهر في الرئيسية عند فتح مرحلة والموظف له حجز في مرحلة سابقة */
function newPhaseCard() {
  const r = APP.emp, ph = r.activePhase; if (!ph || !ph.Booking_Open) return "";
  const prev = (r.phases || []).filter(p => p.Phase_ID !== ph.Phase_ID && (r.myReservationItems || []).some(i => i.Phase_ID === p.Phase_ID)).pop();
  if (!prev) return "";
  const s = phaseSummary(prev.Phase_ID), carriedHere = Emp.activeItems().filter(i => i.Carried_From_Item_ID).reduce((t, i) => t + n(i.Requested_Qty), 0); // الملغي بعد الترحيل لا يُحسب
  const line = [s.deliv ? `استلمت ${booksWord(s.deliv)}` : "", s.ready ? `${booksWord(s.ready)} جاهزة للاستلام` : "", s.wait ? `${booksWord(s.wait)} لسه موصلتش` : ""].filter(Boolean).join(" · ");
  return `<section class="card mb-4 overflow-hidden ring-2 ring-emerald-200"><div class="p-4" style="background:linear-gradient(135deg,#ecfdf5,#f5f3ff)">
    <div class="text-[12px] font-bold text-emerald-700">🎉 مرحلة جديدة مفتوحة للحجز</div>
    <div class="font-display font-bold text-[18px] text-slate-900 mt-0.5">${esc(ph.Phase_Name)}</div>
    <div class="text-[12.5px] text-slate-600 mt-1">الحجز لحد ${esc(day(ph.End_DateTime))} — تقدر تحجز كتب جديدة أو تكمّل اللي ناقصك.</div>
    ${carriedHere ? `<div class="mt-2 rounded-xl bg-white/80 ring-1 ring-emerald-200 px-3 py-2 text-[13px] text-emerald-800 font-semibold">${ic("arrow-left-right")} ${booksWord(carriedHere)} من المرحلة اللي فاتت اترحّلت لحجزك هنا بأسبقيتك.</div>` : ""}
    <div class="mt-2 rounded-xl bg-white/80 ring-1 ring-slate-200 px-3 py-2 text-[12.5px]"><b>حجزك في «${esc(prev.Phase_Name)}»:</b> ${line || "مكتمل"}</div>
    <div class="grid grid-cols-2 gap-2 mt-3"><a href="#/e/books" class="btn btn-primary !h-11">${ic("plus")} احجز دلوقتي</a><button class="btn btn-outline !h-11" data-act="setPhase" data-id="${esc(prev.Phase_ID)}">${ic("history")} حجزي السابق</button></div>
  </div></section>`;
}
_wrap("/e/home", view => { const c = newPhaseCard(); if (!c) return; const h = view.firstElementChild; if (h) h.insertAdjacentHTML("afterend", c); else view.insertAdjacentHTML("afterbegin", c); });
/** وأنت في مرحلة قديمة والحجز مفتوح في مرحلة أحدث: شريط يرجّعك لها */
function backToOpenBar() {
  const r = APP.emp, open = (r.phases || []).find(p => p.Booking_Open);
  if (!open || open.Phase_ID === APP.phaseId) return "";
  return `<button data-act="setPhase" data-id="${esc(open.Phase_ID)}" class="w-full mb-3 rounded-2xl bg-emerald-600 text-white px-4 py-3 text-right flex items-center gap-2 font-semibold text-[14px]">${ic("sparkles")}<span class="flex-1">الحجز مفتوح الآن في «${esc(open.Phase_Name)}» — اضغط للانتقال</span>${ic("chevron-left")}</button>`;
}
["/e/home", "/e/orders", "/e/books", "/e/pay"].forEach(p => _wrap(p, view => { const b = backToOpenBar(); if (b) view.insertAdjacentHTML("afterbegin", b); }));
// جرس الإشعارات: فتح مرحلة جديدة
const _notifList2 = Notif.list;
Notif.list = function () {
  const out = _notifList2.call(Notif);
  if (APP.user && APP.user.userType === "EMPLOYEE" && APP.emp) (APP.emp.phases || []).filter(p => p.Booking_Open).forEach(p => out.unshift({ id: "open-" + p.Phase_ID, icon: "calendar-check", tone: "green", title: `فُتح الحجز: ${p.Phase_Name} 🎉`, body: `الحجز متاح لحد ${day(p.End_DateTime)}`, href: "#/e/books" }));
  return out;
};

// ---------------------------------------------------------------- كلمة شكر عند كل محطة
function thanksCard() {
  const items = Emp.phaseItems().filter(i => !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward");
  if (!items.length) return "";
  const inv = Emp.invoice(), req = items.reduce((s, i) => s + n(i.Requested_Qty), 0), dl = items.reduce((s, i) => s + n(i.Delivered_Qty), 0);
  const allDelivered = req > 0 && dl >= req, paid = inv && n(inv.Net_Final_Invoice_Amount) > 0 && n(inv.Remaining_Balance) <= 0;
  let m = null;
  if (allDelivered && paid) m = ["🏆", "خلّصت كل حاجة — شكراً من القلب!", "استلمت كل الكتب وسددت بالكامل. ربنا يوفّق ولادك في سنة مليانة نجاح 📚✨"];
  else if (paid) m = ["💳", "شكراً على السداد الكامل!", "حسابك مقفول تماماً — ومفيش عليك ولا قرش 🎉"];
  else if (allDelivered) m = ["📚", "شكراً لاستلامك كتبك!", "كل كتب أولادك وصلتك. بالتوفيق ليهم، ومتنساش متابعة الأقساط من «مدفوعاتي» 💜"];
  if (!m) return "";
  return `<section class="card mb-4 overflow-hidden"><div class="p-4 flex items-center gap-3" style="background:linear-gradient(135deg,#fef9c3,#ede9fe)"><span class="text-[38px] leading-none">${m[0]}</span><div class="flex-1 min-w-0"><div class="font-display font-bold text-[16px] text-slate-900">${m[1]}</div><div class="text-[12.5px] text-slate-600 mt-0.5 leading-relaxed">${m[2]}</div></div></div></section>`;
}
_wrap("/e/home", view => { const c = thanksCard(); if (!c) return; const h = view.firstElementChild; if (h) h.insertAdjacentHTML("afterend", c); else view.insertAdjacentHTML("afterbegin", c); });

// ---------------------------------------------------------------- إلغاء الطلب (قبل وبعد الإرسال) — بحسب مرحلة الطلب
function cancelRequestOf() { const h = (APP.emp.myReservations || []).find(x => x.Phase_ID === APP.phaseId); try { return h && JSON.parse(h.Cancel_Request || "null"); } catch (_) { return null; } }
/** بطاقة «إدارة طلبي»: ملخص + تعديل + إلغاء (في الرئيسية وحجوزاتي)، والحالة لو فيه طلب إلغاء معلّق/مرفوض */
function cancelBox(where) {
  const ph = (APP.emp || {}).activePhase || {}, st = ph.Effective_Status || ph.Phase_Status;
  const items = Emp.phaseItems().filter(i => !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward");
  const und = items.reduce((s, i) => s + Math.max(0, n(i.Requested_Qty) - n(i.Delivered_Qty)), 0);
  const cr = cancelRequestOf(), wrap = where === "home" ? "card p-4 mb-4" : "card p-4 mt-5";
  if (cr && cr.status === "Pending") return `<div class="${wrap} ring-1 ring-amber-200 bg-amber-50/60 text-[13px] text-amber-900 flex items-center gap-2">${ic("hourglass", "text-lg")}<div><b>طلب الإلغاء عند المسؤول</b><div class="text-[12px] opacity-80">اتسجّل ${esc(String(cr.at || "").slice(0, 10))} — طلبك فاضل زي ما هو لحد الرد.</div></div></div>`;
  if (!und || st === "Completed") return cr && cr.status === "Rejected" && where !== "home" ? `<div class="${wrap} text-[13px] text-slate-600">${ic("info")} المسؤول ما وافقش على الإلغاء${cr.note ? ": " + esc(cr.note) : ""}.</div>` : "";
  const direct = ph.Booking_Open || !ph.Po_Frozen;
  const how = direct ? "الإلغاء فوري ومن غير أي التزام 👌" : st === "Delivering" ? "الإلغاء بموافقة المسؤول، واللي استلمته يتعامل كمرتجع." : "الكتب اتطلبت من المكتبة — الإلغاء بموافقة المسؤول.";
  const kids = new Set(items.map(i => i.Beneficiary || "")).size;
  return `<section class="${wrap}"><div class="flex items-center gap-3"><span class="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">${ic("settings")}</span>
    <div class="flex-1 min-w-0"><div class="font-bold text-[14.5px] text-slate-900">إدارة طلبي</div><div class="text-[12px] text-slate-500">${booksWord(und)} لسه ما استلمتهاش${kids > 1 ? ` · لـ ${kids} أفراد` : ""}</div></div></div>
    <div class="grid ${ph.Booking_Open ? "grid-cols-2" : "grid-cols-1"} gap-2 mt-3">${ph.Booking_Open ? `<a href="#/e/wiz" data-act="wizStart" class="btn btn-outline !h-11">${ic("pencil")} تعديل الحجز</a>` : ""}
      <button class="btn !h-11 bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100" data-act="empCancel">${ic("x")} ${direct ? "إلغاء الطلب" : "طلب إلغاء"}</button></div>
    <div class="text-[11.5px] text-slate-500 mt-2 text-center">${how}</div>
    ${cr && cr.status === "Rejected" ? `<div class="text-[12px] text-slate-500 mt-2">${ic("info")} آخر طلب إلغاء اترفض${cr.note ? ": " + esc(cr.note) : ""}.</div>` : ""}</section>`;
}
on("empCancel", async () => {
  const ph = APP.emp.activePhase || {}, direct = ph.Booking_Open || !ph.Po_Frozen;
  const items = Emp.phaseItems().filter(i => !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward" && n(i.Requested_Qty) > n(i.Delivered_Qty));
  const by = {}; items.forEach(i => { const k = i.Beneficiary || "العضو"; by[k] = (by[k] || 0) + n(i.Requested_Qty) - n(i.Delivered_Qty); });
  const sumTxt = Object.keys(by).map(k => `${k}: ${booksWord(by[k])}`).join(" · ");
  const v = await UI.form({ title: direct ? "إلغاء الطلب" : "طلب إلغاء", danger: true,
    intro: `<b>هيتلغي:</b> ${esc(sumTxt)}<br>` + (direct ? "هنلغي كل الكتب اللي في طلبك في المرحلة دي. تقدر تحجز تاني في أي وقت طول ما الحجز مفتوح." : "طلبك هيروح للمسؤول يراجعه. لو اتوافق عليه هيتلغي اللي ما استلمتهوش بس، وأي فلوس زيادة دفعتها هترجعلك كرصيد."),
    fields: [{ name: "reason", label: "السبب (اختياري)", placeholder: "مثال: اشتريت الكتب من مكان تاني" }], ok: direct ? "إلغاء الطلب" : "إرسال الطلب", icon: "x" });
  if (!v) return;
  const r = await call("EMP_CANCEL_REQUEST", { phaseId: APP.phaseId, reason: v.reason }, { block: true });
  if (!r.success) return toast(r.message, "danger");
  await reloadData();
  r.immediate ? happyDialog("💜", "اتلغى طلبك", "ولا يهمك — شكراً إنك كنت معانا، والمبادرة مستنياك في أي وقت 🌷") : happyDialog("📨", "طلبك وصل للمسؤول", "هيراجعه ويبلغك — وطلبك فاضل زي ما هو لحد ما يتم الرد.");
});
_wrap("/e/orders", view => { const c = cancelBox("orders"); if (c) view.insertAdjacentHTML("beforeend", c); });
_wrap("/e/home", view => { const c = cancelBox("home"); if (c) view.insertAdjacentHTML("beforeend", c); });

// ---------------------------------------------------------------- إلغاء قبل التأكيد: يرجع السلة لآخر حجز محفوظ (أو يفرّغها)
on("discardDraft", async () => {
  const had = (APP.emp.myReservations || []).some(x => x.Phase_ID === APP.phaseId);
  if (!await UI.confirm({ title: had ? "تراجع عن التعديلات" : "إلغاء الطلب", message: had ? "هنرجّع حجزك زي ما كان محفوظ آخر مرة." : "هنفضّي السلة ومش هيتسجل أي حجز.", ok: "أيوه", tone: "danger" })) return;
  if (Emp._cartSheet) { Emp._cartSheet.close(); Emp._cartSheet = null; }
  Emp.resetCart(); try { wzClear(); } catch (_) {} Emp.wzManual = false;
  Router.go("/e/home");
  toast(had ? "رجعنا حجزك زي ما كان 👌" : "اتلغى الطلب — ولا يهمك 🌷", "success");
});

// ---------------------------------------------------------------- نفس الكتاب لنفس الابن في نفس المرحلة: تنبيه لطيف قبل زيادة العدد
const _cartIncBase = ACTIONS.cartInc;
on("cartInc", async id => {
  const key = keyFor(id), [bid, ben] = [bk(key), bn(key)];
  const saved = Emp.activeItems().filter(i => i.Book_ID === bid && (i.Beneficiary || "") === (ben || "")).reduce((s, i) => s + n(i.Requested_Qty), 0);
  Emp._dupOk = Emp._dupOk || {};
  if (saved > 0 && (APP.cart[key] || 0) >= saved && !Emp._dupOk[key]) {
    const b = Emp.bookMap()[bid] || {};
    const yes = await UI.confirm({ title: "حجزته قبل كده 👀", message: `«${bookLbl(b, bid)}» محجوز${ben ? " لـ " + ben : ""} بالفعل (${booksWord(saved)}). عايز تزوّد نسخة كمان؟`, ok: "أيوه، زوّد نسخة", cancel: "لا، كفاية كده" });
    if (!yes) return;
    Emp._dupOk[key] = true;
  }
  return _cartIncBase(id);
});

// ---------------------------------------------------------------- طلب مرتجع بعد الاستلام (خلال المدة) — يعتمده المسؤول
/** اسم الكتاب كاملاً للعرض: الناشر — المادة — الصف (قاعدة ثابتة في كل الشاشات) */
function bookLbl(b, id) { b = b || {}; const nm = b.Book_Name || id || "", g = Doc.shortGrade(b.Grade || ""); return g && !String(nm).includes(g) ? nm + " — " + g : nm; }
function retReq(i) { try { return JSON.parse(i.Return_Request || "null"); } catch (_) { return null; } }
function retLine(i) {
  const can = n(i.Delivered_Qty) - n(i.Returned_Qty), r = retReq(i);
  if (r && r.status === "Pending") return `<div class="mt-2.5 text-[12px] rounded-lg bg-amber-50 text-amber-800 px-2.5 py-1.5">${ic("hourglass")} طلب مرتجع ${booksWord(r.qty)} عند المسؤول</div>`;
  const tail = r && r.status === "Approved" ? `<div class="mt-2.5 text-[12px] rounded-lg bg-emerald-50 text-emerald-800 px-2.5 py-1.5">${ic("circle-check")} اتقبل المرتجع واتخصم من فاتورتك</div>` : r && r.status === "Rejected" ? `<div class="mt-2.5 text-[12px] rounded-lg bg-slate-50 text-slate-600 px-2.5 py-1.5">${ic("info")} طلب المرتجع ما اتقبلش${r.note ? ": " + esc(r.note) : ""}</div>` : "";
  if (can <= 0) return tail;
  return tail + `<button class="mt-2.5 text-[12.5px] text-brand-700 font-semibold" data-act="retReq" data-id="${esc(i.Res_Item_ID)}">${ic("undo-2")} طلب مرتجع</button>`;
}
on("retReq", async (id, kind0) => {
  const it = (APP.emp.myReservationItems || []).find(x => x.Res_Item_ID === id); if (!it) return;
  const can = n(it.Delivered_Qty) - n(it.Returned_Qty), b = Emp.bookMap()[it.Book_ID] || {}, win = n((APP.emp.settings || {}).EMP_RETURN_WINDOW_DAYS) || 7, dl = retDaysLeft(it);
  const v = await UI.form({ title: "مرتجع أو استبدال", sub: bookLbl(b, it.Book_ID), intro: `• <b>مرتجع:</b> ترجّع الكتاب سليم خلال ${win} أيام من الاستلام، وتمنه يتخصم من فاتورتك (ولو دافع يرجعلك رصيد).<br>• <b>استبدال:</b> لو في الكتاب عيب (صفحات ناقصة/مقطوعة/طباعة) تاخد نسخة سليمة بدلها وفاتورتك زي ما هي.${dl !== null ? `<br>⏳ فاضل لك <b>${dl}</b> ${dl === 1 ? "يوم" : "أيام"} على انتهاء المدة.` : ""}`,
    fields: [{ name: "kind", label: "نوع الطلب", type: "select", value: kind0 || "RETURN", options: [["RETURN", "مرتجع — رجّع الكتاب واخصم تمنه"], ["EXCHANGE", "استبدال — نسخة سليمة بدل المعيبة"]] },
      { name: "qty", label: "العدد", type: "number", value: 1, min: 1, max: can }, { name: "condition", label: "حالة الكتاب (للمرتجع)", type: "select", value: "GOOD", options: [["GOOD", "سليم"], ["DAMAGED", "فيه عيب"]] },
      { name: "reason", label: "السبب / العيب", placeholder: "مثال: مكرر / صفحات ناقصة من 40 لـ 56" }],
    ok: "إرسال الطلب", icon: "undo-2" });
  if (!v) return;
  if (v.kind === "EXCHANGE" && !String(v.reason || "").trim()) return toast("اكتب العيب اللي في الكتاب", "warning");
  const r = await call("EMP_RETURN_REQUEST", { resItemId: id, qty: n(v.qty), condition: v.condition, reason: v.reason, kind: v.kind }, { block: true });
  if (!r.success) return toast(r.message, "danger");
  await reloadData(); v.kind === "EXCHANGE" ? happyDialog("🔁", "طلب الاستبدال وصل", "هات النسخة اللي فيها العيب للمسؤول وتاخد نسخة سليمة — فاتورتك مش هتتغير 👌") : happyDialog("📦", "طلب المرتجع وصل", "هات الكتاب للمسؤول، وبعد المراجعة هيتخصم من فاتورتك تلقائياً 👌");
});
/** الأيام الباقية على انتهاء مدة المرتجع (من تاريخ الاستلام) أو null لو غير معروف */
function retDaysLeft(i) { const win = n(((APP.emp || {}).settings || {}).EMP_RETURN_WINDOW_DAYS) || 7, d = new Date(String(i.Delivered_At || "").replace(" ", "T")); if (!i.Delivered_At || isNaN(d)) return null; return Math.max(0, Math.ceil(win - (Date.now() - d) / 864e5)); }

// ---------------------------------------------------------------- ترحيل تلقائي للكتب المعلّقة لما تتفتح مرحلة جديدة
/** بنود في مرحلة قديمة اختار الموظف ترحيلها ولم تُنقل بعد (اختار قبل فتح المرحلة الجديدة) */
function pendingCarry() {
  const r = APP.emp || {}, open = (r.phases || []).find(p => p.Booking_Open);
  if (!open) return null;
  const its = (r.myReservationItems || []).filter(i => i.Phase_ID !== open.Phase_ID && i.Waitlist_Choice === "carry" && !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward" && n(i.Requested_Qty) > Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)));
  if (!its.length) return null;
  return { open, from: [...new Set(its.map(i => i.Phase_ID))], qty: its.reduce((s, i) => s + n(i.Requested_Qty) - Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)), 0) };
}
let _carrying = false;
async function autoCarry() {
  const pc = pendingCarry(); if (!pc || _carrying) return false;
  _carrying = true;
  try {
    for (const pid of pc.from) await call("WAITLIST_DECISION", { choice: "carry", phaseId: pid });
    APP.phaseId = pc.open.Phase_ID; APP.phasePicked = true; Emp.dirty = false;
    await Emp.load();
    toast(`🚚 ${booksWord(pc.qty)} من حجزك السابق اترحّلت لـ «${pc.open.Phase_Name}» بأسبقيتك`, "success");
    return true;
  } finally { _carrying = false; }
}
const _empLoadBase = Emp.load;
Emp.load = async function () {
  await _empLoadBase.apply(Emp, arguments);
  if (pendingCarry()) await autoCarry();
};
/** «كمّل الحجز» من مرحلة مقفولة يفتح المرحلة المفتوحة بكتبه المرحّلة */
const _wizStartBase = ACTIONS.wizStart;
on("wizStart", async (...a) => {
  const r = APP.emp || {}, open = (r.phases || []).find(p => p.Booking_Open);
  if (open && open.Phase_ID !== APP.phaseId) {
    await autoCarry();
    if (APP.phaseId !== open.Phase_ID) { APP.phaseId = open.Phase_ID; APP.phasePicked = true; Emp.dirty = false; await Emp.load(); }
    try { wzClear(); } catch (_) {}
  }
  return _wizStartBase(...a);
});

// ---------------------------------------------------------------- «محجوز بالفعل» أعلى الدليل للابن المختار
function bookedForKidHTML() {
  const f = Emp.filter, ben = Emp.ben || "", bm = Emp.bookMap();
  if (!f.grade || f.q || !Emp.open()) return ""; // الحجز مقفول: التصفّح للعلم بس، والحجز في «حجوزاتي»
  const saved = {}; Emp.activeItems().filter(i => (i.Beneficiary || "") === ben).forEach(i => { (saved[i.Book_ID] = saved[i.Book_ID] || { qty: 0, carried: null }).qty += n(i.Requested_Qty); if (i.Carried_From_Item_ID) saved[i.Book_ID].carried = i; });
  const ids = Object.keys(saved).filter(id => (bm[id] || {}).Grade === f.grade || !bm[id]);
  if (!ids.length) return "";
  const rows = ids.map(id => { const b = bm[id] || {}, k = ck(id, ben), q = APP.cart[k] || 0;
    return `<li class="flex items-center gap-2 py-2 min-w-0"><span class="w-1.5 h-1.5 rounded-full ${q ? "bg-emerald-500" : "bg-slate-300"} shrink-0"></span>
      <span class="flex-1 min-w-0 truncate text-[13.5px]"><b>${esc(b.Publisher || b.Book_Name || id)}</b> · ${esc(b.Subject || "")} · ${esc(Doc.shortGrade(b.Grade || ""))}${carriedTag(saved[id].carried)}</span>
      <span class="inline-flex items-center gap-1 shrink-0"><button class="icon-btn w-8 h-8 ring-1 ring-slate-200" data-act="cartDec" data-id="${esc(k)}" aria-label="أقل">${ic("minus")}</button><b class="num w-5 text-center">${q}</b><button class="icon-btn w-8 h-8 ring-1 ring-slate-200" data-act="cartInc" data-id="${esc(k)}" aria-label="أكتر">${ic("plus")}</button></span></li>`; }).join("");
  return `<section id="bookedKid" class="card p-4 mb-3 ring-1 ring-emerald-200"><div class="flex items-center gap-2"><span class="text-[20px]">✅</span><div class="flex-1"><div class="font-bold text-[15px] text-slate-900">محجوز بالفعل${ben ? " لـ " + esc(ben) : ""}</div><div class="text-[12px] text-slate-500">${booksWord(ids.length)} — تقدر تزوّد أو تقلّل، وتحت تكمّل من الدليل</div></div></div><ul class="mt-1 divide-y divide-slate-100">${rows}</ul></section>`;
}
_wrap("/e/books", view => {
  const h = bookedForKidHTML(); if (!h) return;
  const hero = view.querySelector('div[style*="#552c83"]');
  if (hero) hero.insertAdjacentHTML("afterend", h); else afterHead(view, h);
});
if (typeof refreshCartViews === "function") { const _rcv = refreshCartViews; refreshCartViews = function () { const r = _rcv.apply(this, arguments); const el = document.getElementById("bookedKid"); if (el) { const h = bookedForKidHTML(); if (h) el.outerHTML = h; } return r; }; }

// ---------------------------------------------------------------- مدفوعاتي: الحساب كله عبر كل المراحل
Router.add("/e/pay", view => {
  const r = APP.emp, invs = (r.myInvoices || []).slice(), phName = id => ((r.phases || []).find(p => p.Phase_ID === id) || {}).Phase_Name || id;
  const allInst = (r.myInstallments || []).slice().sort((a, b) => String(a.Due_Date).localeCompare(b.Due_Date));
  const pays = (r.myPayments || []).slice().reverse();
  const net = sum(invs, "Net_Final_Invoice_Amount"), paid = sum(invs, "Total_Paid_Amount");
  const acc = typeof empNetAccount === "function" ? empNetAccount() : { alayh: sum(invs, "Remaining_Balance"), lah: sum(invs, "Credit_Balance"), net: sum(invs, "Remaining_Balance") - sum(invs, "Credit_Balance"), netDue: Math.max(0, sum(invs, "Remaining_Balance") - sum(invs, "Credit_Balance")), netCredit: Math.max(0, sum(invs, "Credit_Balance") - sum(invs, "Remaining_Balance")) };
  const overdue = sum(allInst.filter(i => i.Status === "Overdue"), "Remaining_Inst_Amount");
  const next = allInst.find(i => n(i.Remaining_Inst_Amount) > 0);
  const netNextDue = next ? Math.max(0, Math.round((n(next.Remaining_Inst_Amount) - acc.lah) * 100) / 100) : 0;
  const instRow = (s, i) => { const st = s.Status === "Scheduled" ? (n(s.Remaining_Inst_Amount) ? "Scheduled" : "Paid") : s.Status;
    const dot = st === "Paid" ? "bg-emerald-500 text-white" : st === "Overdue" ? "bg-rose-500 text-white" : st === "Partial" ? "bg-amber-400 text-white" : "bg-white ring-2 ring-slate-200 text-slate-400";
    return `<li class="flex items-center gap-3 py-2"><span class="w-7 h-7 rounded-full flex items-center justify-center text-[12px] shrink-0 ${dot}">${st === "Paid" ? ic("check") : i + 1}</span>
      <div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px] truncate">${esc(s.Admin_Custom_Notes || "قسط " + s.Installment_No)}</div><div class="text-[11.5px] text-slate-500 num">${esc(day(s.Due_Date))}</div></div>
      <div class="text-left num"><b>${fmt(s.Scheduled_Amount)}</b>${n(s.Remaining_Inst_Amount) && st !== "Scheduled" ? `<div class="text-[11px] text-rose-600">باقي ${fmt(s.Remaining_Inst_Amount)}</div>` : ""}</div></li>`; };
  const byInv = invs.map(inv => { const its = allInst.filter(i => i.Emp_Inv_ID === inv.Emp_Inv_ID), invCr = n(inv.Credit_Balance), invRem = n(inv.Remaining_Balance);
    return `<div class="rounded-2xl ring-1 ring-slate-200 p-3 mb-3"><div class="flex items-center justify-between gap-2"><b class="text-[14px]">${esc(phName(inv.Phase_ID))}</b><span class="text-[12px] num ${invRem ? "text-rose-600" : invCr ? "text-emerald-700 font-bold" : "text-emerald-600"}">${invRem ? "عليها " + fmt(invRem) + " ج.م" : invCr ? "لك رصيد " + fmt(invCr) + " ج.م" : "مسددة ✅"}</span></div>
      <div class="text-[12px] text-slate-500 num mt-0.5">فاتورة ${fmt(inv.Net_Final_Invoice_Amount)} · مسدد ${fmt(inv.Total_Paid_Amount)}${invCr ? ` · <span class="text-emerald-700 font-semibold">رصيد لك ${fmt(invCr)}</span>` : ""}</div>
      ${planIsInst(inv) ? (its.length ? `<ol class="mt-1 divide-y divide-slate-100">${its.map(instRow).join("")}</ol>` : "") : `<div class="text-[12px] text-slate-500 mt-1">${ic("banknote", "inline -mt-0.5 !w-3.5 !h-3.5")} كاش — مرة واحدة${invRem ? " عند الاستلام" : ""}</div>`}</div>`; }).join("");
  view.innerHTML = `${UI.pageHead("مدفوعاتي", "حسابك في كل المراحل: الفواتير والأقساط والإيصالات")}
  ${next && acc.netDue > 0.004 ? `<div class="mb-4 rounded-2xl bg-brand-50 ring-1 ring-brand-200 p-3.5 flex items-center gap-3">${ic("calendar-clock", "text-brand-700 text-xl")}<div class="flex-1 text-[13.5px]"><b>${planIsInst(invs.find(v => v.Emp_Inv_ID === next.Emp_Inv_ID)) ? "صافي القسط الجاي" : "الصافي المطلوب عند الاستلام"}:</b> <span class="num font-bold">${fmt(netNextDue)}</span> ج.م — <span class="num">${esc(day(next.Due_Date))}</span>${acc.lah > 0 ? `<div class="text-[11.5px] text-emerald-700 mt-0.5 num">بعد خصم رصيد لك ${fmt(acc.lah)} ج.م من أصل ${fmt(next.Remaining_Inst_Amount)} ج.م</div>` : ""}</div></div>` : ""}
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
    ${invs.length ? UI.kpi("إجمالي فواتيرك", money(net), { icon: "receipt", tone: "brand", foot: invs.length > 1 ? `${invs.length} مراحل` : "" }) : (() => { const c = saveCalc(r.myReservationItems || []); return UI.kpi("قيمة حجزك المتوقعة", money(c.eNet), { icon: "receipt", tone: "brand", foot: "الفاتورة بتصدر عند التوزيع" + (c.unpriced ? ` · ${booksWord(c.unpriced)} بدون سعر` : "") }); })()}
    ${UI.kpi("المسدد", money(paid), { icon: "circle-check", tone: "green", pct: net ? paid / net * 100 : 0 })}
    ${acc.netCredit > 0.004
      ? UI.kpi("صافي رصيدك (لك)", money(acc.netCredit), { icon: "wallet", tone: "green", foot: acc.alayh ? `لك ${fmt(acc.lah)} − عليك ${fmt(acc.alayh)}` : "رصيد دائن محفوظ" })
      : UI.kpi("صافي المتبقي عليك", money(acc.netDue), { icon: "hourglass", tone: acc.netDue ? "amber" : "green", foot: acc.lah ? `فاتورة ${fmt(acc.alayh)} − رصيد لك ${fmt(acc.lah)}` : "" })}
    ${UI.kpi("متأخرات", money(overdue), { icon: "triangle-alert", tone: overdue ? "red" : "gray" })}
  </div>
  <div class="grid gap-4 lg:gap-6 lg:grid-cols-2 items-start">
    ${UI.section(`${ic("calendar-check", "text-brand-600")} الفواتير والأقساط`, "", invs.length ? byInv : Art.empty("wallet", "لسه مفيش فاتورة", "الفاتورة بتصدر لما كتبك تتجهّز للاستلام."))}
    ${UI.section(`${ic("receipt", "text-brand-600")} إيصالات السداد`, pays.length ? `${pays.length} إيصال` : "", pays.length ? `<ul class="space-y-2.5">${pays.map(p => `<li class="flex items-center gap-3 rounded-2xl ring-1 ring-slate-100 p-3">
        <span class="w-11 h-11 rounded-xl ${n(p.Amount) < 0 ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600"} flex items-center justify-center text-lg">${ic(p.Payment_Method === "CASH" ? "banknote" : "smartphone")}</span>
        <div class="flex-1 min-w-0"><div class="font-semibold text-slate-800 text-[14px]">${n(p.Amount) < 0 ? "رد رصيد" : "سداد"} · ${esc(ar(p.Payment_Method))}${isTrue(p.Is_Voided) ? ` <span class="text-rose-600 text-[11px]">(ملغى)</span>` : ""}</div><div class="text-[11.5px] text-slate-400 num truncate">${esc(p.Receipt_No)} · ${esc(dt(p.Payment_Date))} · ${esc(phName((invs.find(i => i.Emp_Inv_ID === p.Emp_Inv_ID) || {}).Phase_ID || ""))}</div></div>
        <div class="font-bold num ${n(p.Amount) < 0 ? "text-sky-600" : "text-slate-900"}">${fmt(Math.abs(n(p.Amount)))}</div><button class="icon-btn w-9 h-9" data-act="printRcptE" data-id="${esc(p.Receipt_No)}" aria-label="الإيصال">${ic("printer")}</button></li>`).join("")}</ul>` : Art.empty("receipt", "لا توجد إيصالات بعد", "إيصالات السداد هتظهر هنا."))}
  </div>`;
});
_wrap("/e/pay", view => { const b = backToOpenBar(); if (b) view.insertAdjacentHTML("afterbegin", b); });

// ---------------------------------------------------------------- مدفوعاتي: بطاقات لكل ابن/قريب ولكل مرحلة
function payBreakdownHTML() {
  const r = APP.emp, bm = Emp.bookMap(), phName = id => ((r.phases || []).find(p => p.Phase_ID === id) || {}).Phase_Name || id;
  const items = (r.myReservationItems || []).filter(i => !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward");
  if (!items.length) return "";
  const kidsArr = (r.employee && r.employee.kids) || [];
  const who = {}, ph = {};
  let cover = 0, emp = 0;
  items.forEach(i => {
    const b = bm[i.Book_ID] || {}, ep = n(i.Unit_Emp_Price) || n(b.Emp_Selling_Price), cp = n(i.Unit_Cover_Price) || n(b.Cover_Price);
    const billed = Math.max(0, Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)) - n(i.Returned_Qty)), booked = n(i.Requested_Qty);
    const pr = personOf(i, b), k = pr.key;
    const w = who[k] = who[k] || { books: 0, billed: 0, value: 0, cover: 0, delivered: 0, grade: pr.grade || b.Grade, label: pr.label, name: pr.name, emoji: pr.emoji, ord: pr.ord };
    w.books += booked; w.billed += billed * ep; w.value += booked * ep; w.cover += booked * cp; w.delivered += n(i.Delivered_Qty);
    const p = ph[i.Phase_ID] = ph[i.Phase_ID] || { books: 0, value: 0 }; p.books += booked; p.value += booked * ep;
    cover += booked * cp; emp += booked * ep;
  });

  const total = Object.values(who).reduce((s, w) => s + w.value, 0) || 1;
  const kidCards = Object.keys(who).sort((a, b) => who[a].ord - who[b].ord || who[b].value - who[a].value).map(k => { const w = who[k], pct = Math.round(w.value / total * 100), sv = Math.max(0, w.cover - w.value);
    return `<div class="rounded-2xl ring-1 ring-slate-200 p-3"><div class="flex items-center gap-2"><span class="text-[26px] leading-none">${w.emoji}</span><div class="flex-1 min-w-0"><div class="truncate text-[14px]"><span class="text-slate-500">${esc(w.label)} …</span> <b>${esc(w.name)}</b></div><span class="text-[11.5px] text-slate-500">${booksWord(w.books)}${w.grade ? " · " + esc(Doc.shortGrade(w.grade)) : ""}</span></div><button class="btn btn-outline btn-xs shrink-0" data-act="printPerson" data-id="${esc(k)}">${ic("printer")} فاتورته</button></div>
      <div class="grid grid-cols-3 gap-1.5 mt-2.5 text-center"><div class="rounded-xl bg-slate-50 py-1.5"><div class="text-[10.5px] text-slate-500">قبل الخصم</div><div class="num text-[13px] text-slate-500 line-through">${fmt(Math.round(w.cover))}</div></div>
        <div class="rounded-xl bg-brand-50 py-1.5"><div class="text-[10.5px] text-brand-700">بعد الخصم</div><div class="num text-[14px] font-bold text-brand-800">${fmt(Math.round(w.value))}</div></div>
        <div class="rounded-xl bg-emerald-50 py-1.5"><div class="text-[10.5px] text-emerald-700">وفّرت</div><div class="num text-[14px] font-bold text-emerald-700">${fmt(Math.round(sv))}</div></div></div>
      <div class="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-brand-500 rounded-full" style="width:${pct}%"></div></div>
      <div class="flex justify-between text-[11px] text-slate-500 mt-1"><span>${pct}% من إجمالي حجزك</span><span>${w.delivered ? `استلم ${fmt(w.delivered)}` : "لسه ما استلمش"}</span></div></div>`; }).join("");
  const phCards = Object.keys(ph).map(pid => { const inv = (r.myInvoices || []).find(x => x.Phase_ID === pid);
    return `<div class="rounded-2xl bg-slate-50 p-3"><div class="text-[12px] text-slate-500 truncate">${esc(phName(pid))}</div><div class="font-bold num text-[17px] mt-0.5">${fmt(Math.round(inv ? n(inv.Net_Final_Invoice_Amount) : ph[pid].value))} <span class="text-[11px] font-normal text-slate-500">ج.م</span></div>
      <div class="text-[11.5px] mt-0.5 ${inv ? (n(inv.Remaining_Balance) ? "text-rose-600" : "text-emerald-600") : "text-slate-500"}">${inv ? (n(inv.Remaining_Balance) ? `مسدد ${fmt(inv.Total_Paid_Amount)} · باقي ${fmt(inv.Remaining_Balance)}` : "مسددة بالكامل ✅") : `${booksWord(ph[pid].books)} · الفاتورة لسه ما صدرتش`}</div></div>`; }).join("");
  const kidsN = Object.keys(who).length, c = saveCalc(items), hasA = c.aBooks > 0, hasE = c.eBooks > 0 || c.unpriced > 0;
  const tile = (bg, dark, t, v, f) => `<div class="rounded-2xl p-3 ${dark ? "text-white" : "text-brand-950"}" style="background:${bg}"><div class="text-[11px] opacity-85">${t}</div><div class="font-bold num text-[18px]">${v}</div><div class="text-[10.5px] opacity-85">${f}</div></div>`;
  const pct = (sv, cv) => cv ? Math.round(sv / cv * 100) : 0;
  const tot = c.aNet + c.eNet, totCov = c.aCover + c.eCover;
  const saveT = hasA ? tile("linear-gradient(135deg,#059669,#047857)", 1, gTxt("وفّرت", "وفّرتي"), fmt(Math.round(c.aSave)), `${pct(c.aSave, c.aCover)}% من الغلاف${hasE ? ` · + ≈${fmt(Math.round(c.eSave))} متوقع` : ""}`)
    : tile("linear-gradient(135deg,#10b981,#047857)", 1, "التوفير المتوقع", "≈ " + fmt(Math.round(c.eSave)), `${pct(c.eSave, c.eCover)}% من الغلاف`);
  const valT = tile("linear-gradient(135deg,#fde08a,#f9b224)", 0, hasA && !hasE ? "قيمة الكتب" : hasA ? "قيمة الكتب (فعلي + متوقع)" : "قيمة الكتب المتوقعة", fmt(Math.round(tot)), `<span class="line-through num">${fmt(Math.round(totCov))}</span>`);
  const avgT = tile("linear-gradient(135deg,#6a3aa0,#3b1d63)", 1, "متوسط الفرد", fmt(Math.round(tot / (kidsN || 1))), `${kidsN} ${kidsN > 2 ? "أفراد" : kidsN === 2 ? "فردين" : "فرد"}`);
  return `<div class="grid grid-cols-3 gap-2 sm:gap-3 ${hasE ? "mb-2" : "mb-4"}">${saveT}${avgT}${valT}</div>
    ${hasE ? `<div class="mb-4 rounded-2xl bg-amber-50 ring-1 ring-amber-100 text-amber-900 px-3.5 py-2.5 text-[12.5px] leading-relaxed flex gap-2">${ic("info", "mt-0.5 shrink-0")}<span>${hasA ? "فيه مرحلة لسه فاتورتها ما صدرتش — أرقامها تقديرية. " : "الأرقام دي تقديرية لحد ما الفاتورة تصدر عند التوزيع. "}${c.unpriced ? `<b>${booksWord(c.unpriced)}</b> لسه جاري تسعيرها ومش محسوبة.` : ""}</span></div>` : ""}
    ${payMethodsHTML()}
    ${UI.section(`${ic("users", "text-brand-600")} تكلفة كل فرد`, "قيمة كتب كل ابن أو قريب في كل المراحل", `${grpBtns(who)}<div class="grid gap-2 sm:grid-cols-2">${kidCards}</div>`)}
    <div class="mt-4">${UI.section(`${ic("calendar-range", "text-brand-600")} مدفوعات كل مرحلة`, "", `<div class="grid grid-cols-2 gap-2">${phCards}</div>`)}</div><div class="h-4"></div>`;
}
_wrap("/e/pay", view => { const h = payBreakdownHTML(); if (!h) return; const kpis = view.querySelector(".grid.grid-cols-2.lg\\:grid-cols-4"); if (kpis) kpis.insertAdjacentHTML("afterend", h); else view.insertAdjacentHTML("beforeend", h); });

/** تحليل السداد حسب الوسيلة + عدد الإيصالات + آخر سداد + متوسط الدفعة */
function payMethodsHTML() {
  const pays = (APP.emp.myPayments || []).filter(p => !isTrue(p.Is_Voided) && n(p.Amount) > 0);
  if (!pays.length) return "";
  const M = { CASH: ["💵", "نقدي", "#059669"], INSTAPAY: ["⚡", "إنستاباي", "#7c4bb6"], WALLET: ["📱", "محفظة", "#0ea5e9"], PAYROLL: ["🏢", "خصم من المرتب", "#f0930b"] };
  const by = {}; pays.forEach(p => { const k = p.Payment_Method || "CASH"; (by[k] = by[k] || { sum: 0, cnt: 0 }); by[k].sum += n(p.Amount); by[k].cnt++; });
  const total = pays.reduce((s, p) => s + n(p.Amount), 0), last = pays.slice().sort((a, b) => String(b.Payment_Date).localeCompare(String(a.Payment_Date)))[0];
  const refunds = (APP.emp.myPayments || []).filter(p => !isTrue(p.Is_Voided) && n(p.Amount) < 0).reduce((s, p) => s - n(p.Amount), 0);
  const cards = Object.keys(by).sort((a, b) => by[b].sum - by[a].sum).map(k => { const m = M[k] || ["💳", ar(k), "#64748b"], pct = Math.round(by[k].sum / total * 100);
    return `<div class="rounded-2xl ring-1 ring-slate-200 p-3"><div class="flex items-center gap-2"><span class="text-[22px]">${m[0]}</span><div class="flex-1 min-w-0"><div class="text-[12px] text-slate-500">${m[1]}</div><div class="font-bold num text-[17px]">${fmt(by[k].sum)} <span class="text-[11px] font-normal text-slate-500">ج.م</span></div></div></div>
      <div class="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full" style="width:${pct}%;background:${m[2]}"></div></div>
      <div class="flex justify-between text-[11px] text-slate-500 mt-1"><span>${pct}%</span><span>${by[k].cnt} ${by[k].cnt > 2 ? "إيصالات" : by[k].cnt === 2 ? "إيصالين" : "إيصال"}</span></div></div>`; }).join("");
  return `<div class="mb-4">${UI.section(`${ic("wallet", "text-brand-600")} دفعت إزاي؟`, `${pays.length} إيصال · متوسط الدفعة ${fmt(Math.round(total / pays.length))} ج.م · آخر سداد ${esc(day(last.Payment_Date))}${refunds ? ` · رُدّ لك ${fmt(refunds)} ج.م` : ""}`, `<div class="grid grid-cols-2 gap-2">${cards}</div>`)}</div>`;
}

/** صاحب البند: ابنك/بنتك (بصف الكتاب) أو القريب بصلته — «ابنك … محمد»، «ابن أخوك … يوسف» */
const REL_YOU = { "ابن أخ": "ابن أخوك", "بنت أخ": "بنت أخوك", "ابن أخت": "ابن أختك", "بنت أخت": "بنت أختك", "حفيد": "حفيدك", "حفيدة": "حفيدتك", "ابن عم": "ابن عمك", "بنت عم": "بنت عمك", "ابن خال": "ابن خالك", "بنت خال": "بنت خالك", "أخ": "أخوك", "أخت": "أختك", "زوجة": "زوجتك" };
function personOf(i, b) {
  const ks = (APP.emp.employee && APP.emp.employee.kids) || [];
  if (i.Beneficiary) {
    const rk = ks.find(k => k.rel && (String(k.name).trim() + " — " + k.rel) === i.Beneficiary);
    const name = rk ? rk.name : String(i.Beneficiary).split(" — ")[0], rel = rk ? rk.rel : (String(i.Beneficiary).split(" — ")[1] || "قريبك");
    return { key: "ben:" + i.Beneficiary, label: relYou(rel), name, emoji: rk && rk.gender === "g" ? "👧" : "🧒", grade: rk ? rk.grade : b.Grade, ord: 50 + ks.indexOf(rk) };
  }
  const own = ks.map((k, ix) => ({ k, ix })).filter(x => !x.k.rel && x.k.grade && x.k.grade === b.Grade);
  if (own.length) { const k0 = own[0].k, girls = own.every(x => x.k.gender === "g");
    return { key: "kid:" + b.Grade, label: own.length > 1 ? (girls ? "بناتك" : "ولادك") : (k0.gender === "g" ? "بنتك" : "ابنك"), name: own.map(x => x.k.name || (x.k.gender === "g" ? "بنتي" : "ابني")).join(" و"), emoji: k0.gender === "g" ? "👧" : "👦", grade: b.Grade, ord: own[0].ix }; }
  return { key: "g:" + (b.Grade || ""), label: "كتب", name: b.Grade ? Doc.shortGrade(b.Grade) : "أخرى", emoji: "📚", grade: "", ord: 99 };
}

/** صلة القرابة بضمير المخاطب: «ابن أخت»/«ابن الأخت» ← «ابن أختك»، «حفيدة» ← «حفيدتك»، «أخ» ← «أخوك» */
function relYou(rel) {
  rel = String(rel || "").trim(); if (!rel || rel === "أخرى") return "قريبك";
  if (REL_YOU[rel]) return REL_YOU[rel];
  const w = rel.split(/\s+/); let last = w.pop().replace(/^ال/, "");
  if (/ك$/.test(last)) return rel;
  last = last === "أخ" ? "أخوك" : last === "أب" ? "أبوك" : /ة$/.test(last) ? last.slice(0, -1) + "تك" : last + "ك";
  return w.concat(last).join(" ");
}
// ---------------------------------------------------------------- فاتورة منفصلة لكل ابن/قريب
const isFam = k => String(k).startsWith("ben:");
function personLines(key) {
  const r = APP.emp, bm = Emp.bookMap(), m = k => key === "grp:kids" ? !isFam(k) : key === "grp:fam" ? isFam(k) : k === key;
  return (r.myReservationItems || []).filter(i => !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward").filter(i => m(personOf(i, bm[i.Book_ID] || {}).key));
}
/** أزرار فاتورة مجمّعة: ولادي مع بعض · باقي العيلة مع بعض (تظهر لما يكون فيه أكتر من فرد في المجموعة أو المجموعتين موجودين) */
function grpBtns(who) {
  const ks = Object.keys(who), kids = ks.filter(k => !isFam(k)).length, fam = ks.filter(isFam).length;
  if (!(kids && fam) && kids < 2 && fam < 2) return "";
  return `<div class="grid grid-cols-2 gap-2 mb-3">${kids ? `<button class="btn btn-outline btn-sm" data-act="printPerson" data-id="grp:kids">${ic("printer")} فاتورة ولادي (${kids})</button>` : ""}${fam ? `<button class="btn btn-outline btn-sm" data-act="printPerson" data-id="grp:fam">${ic("printer")} فاتورة باقي العيلة (${fam})</button>` : ""}</div>`;
}
on("printPerson", key => {
  const r = APP.emp, bm = Emp.bookMap(), its = personLines(key); if (!its.length) return;
  const grp = key.startsWith("grp:"), names = [...new Set(its.map(i => personOf(i, bm[i.Book_ID] || {}).name))];
  const pr = grp ? { label: key === "grp:kids" ? "ولادك" : "عيلتك", name: names.join(" و") } : personOf(its[0], bm[its[0].Book_ID] || {}), billedQ = i => Math.max(0, Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)) - n(i.Returned_Qty));
  const anyBilled = its.some(i => billedQ(i) > 0);
  const lines = its.map(i => { const b = bm[i.Book_ID] || {}; return { ben: grp ? personOf(i, b).name : i.Beneficiary, code: i.Book_ID, name: b.Book_Name || i.Book_ID, grade: b.Grade, qty: anyBilled ? billedQ(i) : n(i.Requested_Qty), cover: n(i.Unit_Cover_Price) || n(b.Cover_Price), price: n(i.Unit_Emp_Price) || n(b.Emp_Selling_Price) }; }).filter(l => l.qty > 0);
  const phases = [...new Set(its.map(i => i.Phase_ID))].map(id => ((r.phases || []).find(p => p.Phase_ID === id) || {}).Phase_Name || id).join(" + ");
  const who = `${pr.label} ${pr.name}`;
  const e = { name: APP.user.fullName, id: APP.user.empId, dept: APP.user.department || "", mobile: APP.user.mobile || "" };
  Doc.show("فاتورة " + who, Doc.reservation({ title: "فاتورة كتب — " + who, no: (APP.user.empId || "") + "-" + (grp ? (key === "grp:kids" ? "KIDS" : "FAMILY") : (pr.name || "").replace(/\s+/g, "")), date: new Date().toISOString(), phase: phases, status: anyBilled ? "مؤكد" : "محجوز", emp: e, lines,
    note: `• فاتورة تفصيلية لكتب <b>${esc(who)}</b> فقط — جزء من حساب العضو، والسداد والأقساط على الفاتورة المجمّعة في «مدفوعاتي».<br>• ${anyBilled ? "الكمية = المخصص/المُسلَّم بعد خصم المرتجع." : "الكتب لسه في مرحلة الحجز؛ الكمية = المحجوز."}` }), { file: "invoice-" + (grp ? key.slice(4) : (pr.name || "member")) });
});

// ================================================================ مدفوعاتي: أدوات السداد والمتابعة
const payS = () => (APP.emp && APP.emp.settings) || {};
const nextInst = () => (APP.emp.myInstallments || []).filter(i => n(i.Remaining_Inst_Amount) > 0).sort((a, b) => String(a.Due_Date).localeCompare(b.Due_Date))[0];
const daysTo = d => Math.ceil((new Date(String(d).slice(0, 10) + "T12:00:00") - new Date()) / 864e5);
const creditTotal = () => (APP.emp.myInvoices || []).reduce((s, i) => s + n(i.Credit_Balance), 0);

// (1) ادفع الآن + (2) رصيد مستحق الرد + (3) تقويم الأقساط + (5) كشف حساب
function payToolsHTML() {
  const s = payS(), nx = nextInst(), cr = creditTotal(), rem = (APP.emp.myInvoices || []).reduce((t, i) => t + n(i.Remaining_Balance), 0);
  const holder = s.CASH_ACCOUNT_HOLDER || "", insta = s.PAY_INSTAPAY || "", wallet = s.PAY_WALLET || "";
  const due = nx ? n(nx.Remaining_Inst_Amount) : rem, d = nx ? daysTo(nx.Due_Date) : null;
  const when = d === null ? "" : d < 0 ? `<span class="text-rose-600 font-bold">متأخر ${-d} يوم</span>` : d === 0 ? "<b>النهارده</b>" : `بعد ${d} يوم`;
  return `${due > 0 ? `<section class="card overflow-hidden mb-4 ring-2 ring-brand-200"><div class="p-4" style="background:linear-gradient(135deg,#f5f3ff,#fff)">
      <div class="flex items-center gap-3"><span class="text-[30px]">💳</span><div class="flex-1"><div class="text-[12px] text-slate-500">${nx && planIsInst((APP.emp.myInvoices || []).find(v => v.Emp_Inv_ID === nx.Emp_Inv_ID)) ? "القسط الجاي " + (when ? "· " + when : "") : "المتبقي عليك"}</div><div class="font-display font-bold text-[22px] num text-brand-900">${fmt(due)} <span class="text-[12px]">ج.م</span></div>${nx ? `<div class="text-[11.5px] text-slate-500 num">${esc(day(nx.Due_Date))}</div>` : ""}</div>
      <button class="btn btn-primary !h-11" data-act="payNow">${ic("send")} ادفع الآن</button></div>
      <div class="grid grid-cols-2 gap-2 mt-3">${(APP.emp.myInvoices || []).some(v => planIsInst(v) && n(v.Remaining_Balance) > 0) ? `<button class="btn btn-outline btn-sm" data-act="instIcs">${ic("calendar-check")} أضف الأقساط للتقويم</button>` : ""}<button class="btn btn-outline btn-sm" data-act="stmtPdf">${ic("file-text")} كشف حساب PDF</button></div></div></section>`
    : `<div class="grid grid-cols-1 gap-2 mb-4"><button class="btn btn-outline btn-sm" data-act="stmtPdf">${ic("file-text")} كشف حساب PDF</button></div>`}
    ${cr > 0 ? `<section class="card p-4 mb-4 ring-1 ring-emerald-200 bg-emerald-50/50 flex items-center gap-3"><span class="text-[28px]">💰</span><div class="flex-1"><b class="text-emerald-800">ليك رصيد ${fmt(cr)} ج.م</b><div class="text-[12px] text-slate-600">فلوس زيادة عن قيمة كتبك (مرتجع أو إلغاء أو سداد زيادة).</div></div><button class="btn btn-success btn-sm" data-act="askRefund">اطلب استرداد</button></section>` : ""}`;
}
on("payNow", () => {
  const s = payS(), nx = nextInst(), due = nx ? n(nx.Remaining_Inst_Amount) : 0, holder = s.CASH_ACCOUNT_HOLDER || "";
  const row = (icon, t, v) => v ? `<div class="flex items-center gap-3 rounded-2xl ring-1 ring-slate-200 p-3"><span class="text-[22px]">${icon}</span><div class="flex-1 min-w-0"><div class="text-[12px] text-slate-500">${t}</div><b class="num text-[16px] select-all" dir="ltr">${esc(v)}</b></div><button class="btn btn-ghost btn-xs" data-copy="${esc(v)}">${ic("copy")} نسخ</button></div>` : "";
  const msg = `السلام عليكم، حوّلت قسط مبادرة الكتب${due ? " بمبلغ " + due + " ج.م" : ""}\nالاسم: ${APP.user.fullName}\nالرقم: ${APP.user.empId}\n(مرفق صورة التحويل)`;
  const m = UI.open(`<div class="text-center mb-3"><div class="text-[13px] text-slate-500">المطلوب الآن</div><div class="font-display font-bold text-[28px] num text-brand-900">${fmt(due)} <span class="text-[13px]">ج.م</span></div>${holder ? `<div class="text-[12px] text-slate-500">باسم: <b>${esc(holder)}</b></div>` : ""}</div>
    <div class="grid gap-2">${row("⚡", "إنستاباي", s.PAY_INSTAPAY)}${row("📱", "محفظة إلكترونية", s.PAY_WALLET)}${!s.PAY_INSTAPAY && !s.PAY_WALLET ? `<div class="text-[13px] text-slate-600 text-center">ادفع نقداً للمسؤول، أو كلّمه ياخد منك التحويل.</div>` : ""}</div>
    <a class="btn btn-success w-full mt-4 !h-12" target="_blank" rel="noopener" href="${esc(Brand.waLink(Brand.get().whatsapp || Brand.get().phone, msg))}">${ic("message-circle")} بعد التحويل ابعت الصورة على واتساب</a>
    <p class="text-[11.5px] text-slate-500 text-center mt-2">الإيصال بيظهر هنا أول ما المسؤول يسجّل التحويل.</p>`, { title: "ادفع الآن" });
  $$("[data-copy]", m.root).forEach(b => b.addEventListener("click", () => { try { navigator.clipboard.writeText(b.dataset.copy); toast("اتنسخ 👌", "success"); } catch (_) {} }));
});
on("askRefund", () => {
  const cr = creditTotal(), msg = `السلام عليكم، عندي رصيد ${cr} ج.م في مبادرة الكتب وعايز أسترده\nالاسم: ${APP.user.fullName}\nالرقم: ${APP.user.empId}`;
  window.open(Brand.waLink(Brand.get().whatsapp || Brand.get().phone, msg), "_blank");
});
on("instIcs", () => {
  const its = (APP.emp.myInstallments || []).filter(i => n(i.Remaining_Inst_Amount) > 0); if (!its.length) return toast("مفيش أقساط متبقية 🎉", "success");
  const d8 = d => String(d).slice(0, 10).replace(/-/g, ""), now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const ev = its.map(i => ["BEGIN:VEVENT", "UID:" + i.Inst_ID + "@we-books", "DTSTAMP:" + now, "DTSTART;VALUE=DATE:" + d8(i.Due_Date), "SUMMARY:قسط مبادرة الكتب " + fmt(i.Remaining_Inst_Amount) + " ج.م",
    "BEGIN:VALARM", "TRIGGER:-P2D", "ACTION:DISPLAY", "DESCRIPTION:قسط الكتب بعد يومين", "END:VALARM", "END:VEVENT"].join("\r\n")).join("\r\n");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//we-books//AR", ev, "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "أقساط-الكتب.ics"; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500);
  toast("افتح الملف وهيتضاف للتقويم بتذكير قبل كل قسط بيومين 📅", "success");
});
// (5) كشف حساب شامل
on("stmtPdf", () => {
  const r = APP.emp, phName = id => ((r.phases || []).find(p => p.Phase_ID === id) || {}).Phase_Name || id, invs = r.myInvoices || [];
  const instInv = new Set(invs.filter(planIsInst).map(i => i.Emp_Inv_ID));
  const pays = (r.myPayments || []).filter(p => !isTrue(p.Is_Voided)), inst = (r.myInstallments || []).filter(i => instInv.has(i.Emp_Inv_ID)).slice().sort((a, b) => String(a.Due_Date).localeCompare(b.Due_Date));
  const t = (h, rows) => `<table><thead><tr>${h.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${h.length}" class="c sub">—</td></tr>`}</tbody></table>`;
  const net = sum(invs, "Net_Final_Invoice_Amount"), paid = sum(invs, "Total_Paid_Amount"), rem = sum(invs, "Remaining_Balance");
  const html = Doc.page(`${Doc.head("كشف حساب", APP.user.empId)}
    <div class="meta"><div class="box"><h4>العضو</h4>${Doc.kv("الاسم", esc(APP.user.fullName))}${Doc.kv("الرقم", `<span class="num">${esc(APP.user.empId)}</span>`)}</div>
      <div class="box"><h4>الملخص</h4>${Doc.kv("إجمالي الفواتير", `<span class="num">${Doc.money(net)}</span>`)}${Doc.kv("المسدد", `<span class="num">${Doc.money(paid)}</span>`)}${Doc.kv("المتبقي", `<b class="num">${Doc.money(rem)}</b>`)}</div></div>
    <h4 style="margin:2mm 0 1mm">الفواتير</h4>${t(["المرحلة", "الفاتورة", "الصافي", "المسدد", "المتبقي"], invs.map(i => `<tr><td>${esc(phName(i.Phase_ID))}</td><td class="num">${esc(i.Emp_Inv_ID)}</td><td class="l num">${Doc.money(i.Net_Final_Invoice_Amount)}</td><td class="l num">${Doc.money(i.Total_Paid_Amount)}</td><td class="l num"><b>${Doc.money(i.Remaining_Balance)}</b></td></tr>`).join(""))}
    ${inst.length ? "" : "<!--"}<h4 style="margin:2mm 0 1mm">الأقساط</h4>${t(["القسط", "الاستحقاق", "القيمة", "المسدد", "الباقي"], inst.map(i => `<tr><td>${esc(i.Admin_Custom_Notes || "قسط " + i.Installment_No)}</td><td class="c num">${esc(Doc.date(i.Due_Date))}</td><td class="l num">${Doc.money(i.Scheduled_Amount)}</td><td class="l num">${Doc.money(i.Paid_Amount)}</td><td class="l num">${Doc.money(i.Remaining_Inst_Amount)}</td></tr>`).join(""))}
    ${inst.length ? "" : "-->"}
    <h4 style="margin:2mm 0 1mm">الإيصالات</h4>${t(["الإيصال", "التاريخ", "الوسيلة", "المبلغ"], pays.map(p => `<tr><td class="num">${esc(p.Receipt_No)}</td><td class="c num">${esc(String(p.Payment_Date).slice(0, 10))}</td><td>${esc(ar(p.Payment_Method))}</td><td class="l num">${Doc.money(p.Amount)}</td></tr>`).join(""))}
    ${Doc.foot(APP.user.empId)}`, "", "", "dense");
  Doc.show("كشف حساب", html, { file: "statement-" + APP.user.empId });
});
// (7) تفاصيل الإيصال
on("rcptInfo", no => {
  const r = APP.emp, p = (r.myPayments || []).find(x => x.Receipt_No === no); if (!p) return;
  const inv = (r.myInvoices || []).find(i => i.Emp_Inv_ID === p.Emp_Inv_ID) || {}, phName = ((r.phases || []).find(x => x.Phase_ID === inv.Phase_ID) || {}).Phase_Name || "";
  const inst = (r.myInstallments || []).filter(i => i.Emp_Inv_ID === p.Emp_Inv_ID).sort((a, b) => String(a.Due_Date).localeCompare(b.Due_Date));
  UI.open(`<div class="grid grid-cols-2 gap-2">${UI.stat("المبلغ", fmt(Math.abs(n(p.Amount))) + " ج.م")}${UI.stat("الوسيلة", esc(ar(p.Payment_Method)))}${UI.stat("التاريخ", esc(dt(p.Payment_Date)))}${UI.stat("المرحلة", esc(phName))}</div>
    ${p.Transaction_Ref ? `<div class="text-[12.5px] text-slate-600 mt-2">رقم التحويل: <b class="num">${esc(p.Transaction_Ref)}</b></div>` : ""}
    <div class="label mt-4">فاتورة ${esc(p.Emp_Inv_ID)} بعد السداد</div><div class="grid grid-cols-3 gap-2">${UI.stat("الصافي", fmt(inv.Net_Final_Invoice_Amount))}${UI.stat("المسدد", fmt(inv.Total_Paid_Amount))}${UI.stat("الباقي", fmt(inv.Remaining_Balance))}</div>
    ${inst.length && planIsInst(inv) ? `<div class="label mt-4">أقساط الفاتورة</div><ul class="divide-y divide-slate-100 text-[13px]">${inst.map(i => `<li class="flex justify-between py-1.5"><span>${esc(i.Admin_Custom_Notes || "قسط " + i.Installment_No)} · <span class="num">${esc(day(i.Due_Date))}</span></span><span class="${n(i.Remaining_Inst_Amount) ? "text-amber-700" : "text-emerald-600"}">${n(i.Remaining_Inst_Amount) ? "باقي " + fmt(i.Remaining_Inst_Amount) : "مسدد ✓"}</span></li>`).join("")}</ul>` : ""}
    <button class="btn btn-outline w-full mt-4" data-act="printRcptE" data-id="${esc(no)}">${ic("printer")} الإيصال</button>`, { title: "إيصال " + no });
});
// (4) مقارنة بالسنة الدراسية اللي فاتت
function yearCompareHTML() {
  const r = APP.emp, bm = Emp.bookMap(), yr = id => { const p = (r.phases || []).find(x => x.Phase_ID === id); const d = p ? new Date(String(p.Start_DateTime).slice(0, 10)) : null; if (!d || isNaN(d)) return null; return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; };
  const by = {}; (r.myReservationItems || []).filter(i => !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward").forEach(i => { const y = yr(i.Phase_ID); if (y === null) return; const b = bm[i.Book_ID] || {}, q = n(i.Requested_Qty);
    const o = by[y] = by[y] || { save: 0, books: 0 }; o.books += q; o.save += q * Math.max(0, (n(i.Unit_Cover_Price) || n(b.Cover_Price)) - (n(i.Unit_Emp_Price) || n(b.Emp_Selling_Price))); });
  const ys = Object.keys(by).map(Number).sort(); if (ys.length < 2) return "";
  const a = by[ys[ys.length - 2]], c = by[ys[ys.length - 1]];
  return `<div class="mb-4 rounded-2xl bg-white ring-1 ring-slate-200 p-3.5 text-[13px]">📈 <b>السنة دي</b> وفّرت <b class="num text-emerald-700">${fmt(Math.round(c.save))}</b> ج.م على ${booksWord(c.books)} — مقابل <b class="num">${fmt(Math.round(a.save))}</b> ج.م السنة اللي فاتت.</div>`;
}
_wrap("/e/pay", view => {
  const kpis = view.querySelector(".grid.grid-cols-2.lg\\:grid-cols-4");
  const h = payToolsHTML() + yearCompareHTML();
  if (kpis) kpis.insertAdjacentHTML("beforebegin", h); else view.insertAdjacentHTML("afterbegin", h);
  $$('[data-act="printRcptE"]', view).forEach(b => { const li = b.closest("li"); if (li && !li.dataset.ri) { li.dataset.ri = 1; li.classList.add("cursor-pointer"); li.addEventListener("click", e => { if (e.target.closest("button")) return; ACTIONS.rcptInfo(b.dataset.id); }); } });
});
// (6) تنبيه قبل القسط في الجرس
const _notifList3 = Notif.list;
Notif.list = function () {
  const out = _notifList3.call(Notif);
  if (APP.user && APP.user.userType === "EMPLOYEE" && APP.emp) {
    const nx = nextInst();
    if (nx) { const d = daysTo(nx.Due_Date);
      if (d <= 3) out.unshift({ id: "inst-" + nx.Inst_ID + "-" + (d < 0 ? "late" : d), icon: d < 0 ? "triangle-alert" : "calendar-clock", tone: d < 0 ? "red" : "amber", title: d < 0 ? `قسطك متأخر ${-d} يوم` : d === 0 ? "قسطك النهارده" : `قسطك بعد ${d} يوم`, body: `${fmt(nx.Remaining_Inst_Amount)} ج.م — ادفع من «مدفوعاتي»`, href: "#/e/pay" }); }
    const cr = creditTotal(); if (cr > 0) out.unshift({ id: "credit-" + cr, icon: "wallet", tone: "green", title: `ليك رصيد ${fmt(cr)} ج.م`, body: "تقدر تطلب استرداده من «مدفوعاتي»", href: "#/e/pay" });
  }
  return out;
};

// ================================================================ فتح تطبيق إنستاباي
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
// بطاقة الدفع بإنستاباي: رمز QR نظيف (يُعاد توليده من رابط الدفع) + عنوان الدفع IPA بنسخ سريع + فتح التطبيق + حفظ الرمز كصورة
const INSTA_DEFAULT = { link: "https://ipn.eg/C/Q/mahmoud.aliraky/instapay?ISIGN=23052601MEQCIBZG2PIdL9Sw+02NldtaUIAkuwpiY81zB8j7m+WLKGHeAiB6eWQDCbq4OTL0M7KUpdeMAhyHVZI0ImBgwbwg61/qjw==", ipa: "mahmoud.aliraky@instapay" };
const instaInfo = () => { const s = Object.assign({}, (APP.adm && APP.adm.settingsMap) || {}, payS()); return { link: s.PAY_INSTAPAY_LINK || INSTA_DEFAULT.link, ipa: s.PAY_INSTAPAY_IPA || INSTA_DEFAULT.ipa, num: s.PAY_INSTAPAY || "", holder: s.CASH_ACCOUNT_HOLDER || "" }; };
async function instaQrSvg(link) {
  try { if (!window.qrcode) await qrLib(); const q = window.qrcode(0, "H"); q.addData(link); q.make();
    const n = q.getModuleCount(), c = 10, pad = 2, sz = (n + pad * 2) * c; let path = "";
    const hole = k => { const m = Math.floor(n * 0.22), a = Math.floor((n - m) / 2); return k >= a && k < a + m; };
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k) && !(hole(r) && hole(k))) path += `M${(k + pad) * c} ${(r + pad) * c}h${c}v${c}h-${c}z`;
    const lg = sz * 0.2, lo = (sz - lg) / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sz} ${sz}" width="100%" height="100%"><defs><linearGradient id="ig" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b1d63"/><stop offset="1" stop-color="#6a3aa0"/></linearGradient></defs><rect width="${sz}" height="${sz}" fill="#fff"/><path d="${path}" fill="url(#ig)"/>
      <rect x="${lo}" y="${lo}" width="${lg}" height="${lg}" rx="${lg * 0.22}" fill="#fff" stroke="#f97316" stroke-width="${c * 0.6}"/><text x="${sz / 2}" y="${sz / 2 + lg * 0.16}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="${lg * 0.42}" fill="#5b2a91">IPN</text></svg>`; } catch (_) { return ""; }
}
const _payNow0 = ACTIONS.payNow;
on("payNow", async () => {
  _payNow0();
  const m = UI._stack[UI._stack.length - 1]; if (!m || !m.root) return;
  const I = instaInfo(), g = m.root.querySelector(".grid.gap-2"); if (!g) return;
  g.insertAdjacentHTML("afterbegin", `<section class="rounded-3xl overflow-hidden ring-1 ring-brand-200 bg-white shadow-sm">
      <div class="px-4 py-2.5 text-white flex items-center justify-between" style="background:linear-gradient(90deg,#3b1d63,#6a3aa0)"><b class="text-[15px]">⚡ ادفع بإنستاباي</b><span class="text-[11.5px] opacity-80">امسح أو اضغط</span></div>
      <div class="p-4 text-center"><div id="ipQr" class="mx-auto w-[210px] h-[210px] rounded-2xl ring-1 ring-slate-100 p-1.5 bg-white"></div>
        ${I.holder ? `<div class="text-[13px] text-slate-500 mt-2">باسم <b class="text-slate-800">${esc(I.holder)}</b></div>` : ""}
        <button class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 ring-1 ring-brand-200 px-3 h-9 text-[13.5px] font-bold text-brand-800" data-ipcopy="${esc(I.ipa)}" dir="ltr">${esc(I.ipa)} ${ic("copy")}</button>
        <div class="grid grid-cols-2 gap-2 mt-3"><a class="btn btn-primary !h-11" href="${esc(I.link)}" target="_blank" rel="noopener">${ic("send")} افتح إنستاباي</a><button class="btn btn-outline !h-11" data-ipsave>${ic("download")} احفظ الرمز</button></div>
        <p class="text-[11.5px] text-slate-500 mt-2">من موبايل تاني: امسح الرمز من تطبيق إنستاباي. من نفس الموبايل: «افتح إنستاباي» أو احفظ الرمز وارفعه من التطبيق.</p></div></section>`);
  const svg = await instaQrSvg(I.link), box = m.root.querySelector("#ipQr"); if (box) box.innerHTML = svg || "";
  m.root.querySelector("[data-ipcopy]").onclick = e => { try { navigator.clipboard.writeText(I.ipa); } catch (_) {} toast("اتنسخ عنوان الدفع 👌", "success"); };
  m.root.querySelector("[data-ipsave]").onclick = () => { if (!svg) return; const img = new Image(), cv = document.createElement("canvas"); cv.width = cv.height = 900;
    img.onload = () => { const x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 900, 900); x.drawImage(img, 30, 30, 840, 840); const a = document.createElement("a"); a.href = cv.toDataURL("image/png"); a.download = "instapay-qr.png"; a.click(); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); };
});

// ================================================================ نزّل التطبيق على الشاشة الرئيسية
let _installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); _installEvt = e; });
const isStandalone = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
on("installApp", async () => {
  if (_installEvt) { _installEvt.prompt(); const c = await _installEvt.userChoice; _installEvt = null; if (c && c.outcome === "accepted") toast("اتنزل التطبيق 🎉 هتلاقيه على الشاشة الرئيسية", "success"); return; }
  UI.open(isIOS() ? `<ol class="list-decimal pr-5 space-y-2 text-[14px]"><li>افتح الموقع من <b>Safari</b>.</li><li>اضغط زر المشاركة <b>⬆️</b> تحت.</li><li>اختار <b>«إضافة إلى الشاشة الرئيسية»</b>.</li></ol>`
    : `<ol class="list-decimal pr-5 space-y-2 text-[14px]"><li>افتح الموقع من <b>Chrome</b>.</li><li>اضغط النقط التلاتة <b>⋮</b> فوق.</li><li>اختار <b>«تثبيت التطبيق»</b> أو «إضافة إلى الشاشة الرئيسية».</li></ol>`, { title: "نزّل التطبيق على موبايلك" });
});
const installCard = () => isStandalone() ? "" : `<section class="card p-3.5 mb-4 flex items-center gap-3"><span class="text-[26px]">📲</span><div class="flex-1 text-[13px]"><b>نزّل التطبيق على موبايلك</b><div class="text-slate-500 text-[12px]">يفتح أسرع ويشتغل حتى لو النت فاصل.</div></div><button class="btn btn-primary btn-sm" data-act="installApp">نزّله</button></section>`;
_wrap("/e/me", view => afterHead(view, installCard()));
_wrap("/e/home", view => { let hide = false; try { hide = localStorage.getItem("wb_inst_hide") === "1"; } catch (_) {} if (!hide) view.insertAdjacentHTML("beforeend", installCard().replace("</section>", `<button class="icon-btn w-8 h-8" data-act="installHide" aria-label="إخفاء">✕</button></section>`)); });
on("installHide", () => { try { localStorage.setItem("wb_inst_hide", "1"); } catch (_) {} Shell.rerender(); });

// ================================================================ تقييم بعد الاستلام
function feedbackCard() {
  const r = APP.emp; if (!r) return "";
  // التقييم للمرحلة المعروضة فقط، وبعد ما يستلم كل كتبها الجاهزة (مش أول كتاب)
  const h = (r.myReservations || []).find(x => x.Phase_ID === APP.phaseId && x.Res_Status !== "Cancelled" && !x.Feedback); if (!h) return "";
  const its = (r.myReservationItems || []).filter(i => i.Res_ID === h.Res_ID && !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward");
  const dl = its.reduce((a, i) => a + n(i.Delivered_Qty), 0), pend = its.reduce((a, i) => a + Math.max(0, n(i.Allocated_Qty) - n(i.Delivered_Qty)), 0);
  if (!dl || pend) return "";
  const phName = ((r.activePhase || {}).Phase_Name) || "المرحلة دي";
  return `<section class="card p-4 mb-4 ring-1 ring-amber-200 bg-amber-50/40"><b class="text-[14.5px]">استلمت كتب ${esc(phName)} — قيّم المرحلة دي 🙏</b><div class="text-[12.5px] text-slate-600 mt-0.5">رأيك بيساعد النقابة تحسّن المبادرة السنة الجاية.</div>
    <div class="flex justify-center gap-1.5 mt-3" dir="ltr">${[1, 2, 3, 4, 5].map(s => `<button class="text-[30px] leading-none hover:scale-110 transition" data-act="rate" data-id="${esc(h.Res_ID)}|${s}" aria-label="${s} نجوم">⭐</button>`).join("")}</div></section>`;
}
on("rate", async v => {
  const [resId, stars] = v.split("|");
  const f = await UI.form({ title: "⭐".repeat(+stars), sub: +stars >= 4 ? "مبسوطين إنك مبسوط 💜" : "آسفين — قولنا إيه اللي ممكن نحسّنه", fields: [{ name: "note", label: "عندك اقتراح أو ملاحظة؟ (اختياري)", type: "textarea" }], ok: "إرسال" });
  if (!f) return;
  const r = await call("EMP_FEEDBACK", { resId, stars: +stars, note: f.note }, { block: true });
  if (!r.success) return toast(r.message, "danger");
  await reloadData(); happyDialog("💜", "شكراً على رأيك", "وصل للمسؤولين، وهيتاخد في الاعتبار.");
});
_wrap("/e/home", view => afterHead(view, feedbackCard()));
_wrap("/e/orders", view => afterHead(view, feedbackCard()));

// خطوات المعالج لمسار الحجز (funnel)
_wrap("/e/wiz", () => { try { const st = WZ.step; Track.send(st === "review" ? "review" : st === "pay" ? "pay" : "wiz"); } catch (_) {} });

// ---------------------------------------------------------------- الشعبة: تذكير الموظف بتحديد شعبة ابن الثانوي (علمي/أدبي/بكالوريا)
function trackAskCard() {
  const ks = myKids(), miss = ks.map((k, i) => ({ k, i })).filter(x => gradeTracks(x.k.grade).length && !x.k.track);
  if (!miss.length) return "";
  return `<section class="card p-4 mb-4 ring-1 ring-sky-200 bg-sky-50/50 flex items-center gap-3"><span class="text-[28px]">🎓</span><div class="flex-1 min-w-0"><b class="text-slate-900 text-[14.5px]">حدد شعبة ${miss.map(x => esc(kidName(x.k, x.i))).join(" و")}</b><div class="text-[12.5px] text-slate-600">علمي ولا أدبي ولا بكالوريا؟ عشان نعرضله كتب شعبته بس + الكتب المشتركة.</div></div><button class="btn btn-primary btn-sm" data-act="kidsEdit">حدّد</button></section>`;
}
_wrap("/e/home", view => afterHead(view, trackAskCard()));
_wrap("/e/wiz", view => { if (WZ.step === "family") afterHead(view, trackAskCard()); });

// ================================================================ حسابي: ليك / عليك + صافي الحساب
_wrap("/e/pay", view => {
  const r = APP.emp || {}, invs = r.myInvoices || []; if (!invs.length) return;
  const acc = typeof empNetAccount === "function" ? empNetAccount() : { alayh: invs.reduce((x, i) => x + n(i.Remaining_Balance), 0), lah: invs.reduce((x, i) => x + n(i.Credit_Balance), 0), net: 0, netDue: 0, netCredit: 0 };
  const alayh = acc.alayh, lah = acc.lah, net = acc.net;
  const st = net > 0.004 ? ["عليك", "rose", `صافي المتبقي عليك <b class="num">${fmt(net)}</b> ج.م`] : net < -0.004 ? ["ليك", "emerald", `صافي رصيدك <b class="num">${fmt(-net)}</b> ج.م`] : ["متزن", "emerald", "حسابك متزن — مفيش عليك ولا ليك 👌"];
  const hint = lah > 0 && alayh > 0 ? `<p class="text-[12px] text-slate-600 mt-2.5">${ic("info", "inline -mt-0.5 text-brand-600")} تم خصم رصيدك السابق (<b class="num">${fmt(lah)}</b> ج.م) من الفاتورة (<b class="num">${fmt(alayh)}</b> ج.م) — ${net > 0.004 ? `الصافي المطلوب سداده هو <b class="num text-rose-700">${fmt(net)}</b> ج.م فقط.` : net < -0.004 ? `الفاتورة مغطاة بالكامل ويتبقى لك رصيد <b class="num text-emerald-700">${fmt(-net)}</b> ج.م.` : "الفاتورة مغطاة بالكامل من رصيدك."}</p>`
    : lah > 0 ? `<p class="text-[12px] text-slate-600 mt-2.5">${ic("info", "inline -mt-0.5 text-emerald-600")} رصيدك محفوظ: يتخصم تلقائياً من فاتورتك الجاية، أو تطلب استرداده.</p>` : "";
  view.insertAdjacentHTML("afterbegin", `<section class="card p-4 mb-4 ring-1 ring-${st[1]}-200"><div class="flex flex-wrap items-center justify-between gap-2"><b class="text-[15px] text-slate-900">${ic("scale", "inline -mt-0.5 text-brand-600")} صافي حسابك</b><span class="text-[13px] text-${st[1]}-700">${st[2]}</span></div>
    <div class="grid grid-cols-3 gap-2 mt-3 text-center">
      <div class="rounded-xl bg-rose-50 p-2.5"><div class="text-[11.5px] text-rose-700">عليك (فواتير)</div><b class="num text-[16px] text-rose-700">${fmt(alayh)}</b></div>
      <div class="rounded-xl bg-emerald-50 p-2.5"><div class="text-[11.5px] text-emerald-700">لك (رصيد)</div><b class="num text-[16px] text-emerald-700">${fmt(lah)}</b></div>
      <div class="rounded-xl bg-slate-100 ring-1 ring-${st[1]}-200 p-2.5"><div class="text-[11.5px] text-slate-600">الصافي (${st[0]})</div><b class="num text-[16px] text-${st[1]}-700">${fmt(Math.abs(net))}</b></div>
    </div>${hint}</section>`);
});
on("printLeftoverE", () => {
  const r = APP.emp || {}, bm = Emp.bookMap(), invPh = new Set((r.myInvoices || []).map(i => i.Phase_ID));
  const lo = (r.myReservationItems || []).filter(i => invPh.has(i.Phase_ID) && !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward" && i.Waitlist_Choice !== "cancel" && n(i.Requested_Qty) > Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)));
  if (!lo.length) return toast("مفيش كتب متبقية", "info");
  const ph = id => ((r.phases || []).find(p => p.Phase_ID === id) || {}).Phase_Name || id, from = [...new Set(lo.map(i => ph(i.Phase_ID)))].join(" + ");
  const next = ((r.phases || []).find(p => p.Phase_Status === "Open") || {}).Phase_Name || "المرحلة التالية";
  Doc.show("طلب الحجز بالمتبقي", Doc.reservation({ title: "طلب حجز بالمتبقي", no: (APP.user.empId || "") + "-REM", date: new Date().toISOString(), phase: next, status: "متبقي",
    emp: { name: APP.user.fullName, id: APP.user.empId, dept: APP.user.department || "", mobile: APP.user.mobile || "" },
    lines: lo.map(i => { const b = bm[i.Book_ID] || {}; return { code: i.Book_ID, name: b.Book_Name, grade: b.Grade, ben: i.Beneficiary, qty: n(i.Requested_Qty) - Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)), cover: b.Cover_Price, price: b.Emp_Selling_Price }; }),
    note: `• كتب حُجزت في «${esc(from)}» ولم تُسلَّم لعدم وصولها، وتُرحَّل إلى «${esc(next)}» بأسبقية الحجز الأصلية.<br>• الأسعار تقديرية وتُثبَّت عند التوزيع، ولا تدخل أي فاتورة سابقة.`,
    plan: { method: "", down: 0, count: 0, per: 0 } }), { file: "طلب-المتبقي-" + (APP.user.empId || "") });
});

// ================================================================ مرتجعاتي: كل الطلبات وحالتها + الكتب المتاح إرجاعها + إشعار القرار في الرئيسية
const RET_SEEN = "wb_ret_seen";
const retSeen = () => { try { return JSON.parse(localStorage.getItem(RET_SEEN) || "{}"); } catch (_) { return {}; } };
const myRetData = () => {
  const r = APP.emp || {}, bm = Emp.bookMap(), ph = id => ((r.phases || []).find(p => p.Phase_ID === id) || {}).Phase_Name || id;
  const win = n((r.settings || {}).EMP_RETURN_WINDOW_DAYS) || 7, its = r.myReservationItems || [];
  const list = its.map(i => ({ i, r: retReq(i), b: bm[i.Book_ID] || {}, ph: ph(i.Phase_ID) })).filter(x => x.r || n(x.i.Returned_Qty) > 0);
  const elig = its.filter(i => n(i.Delivered_Qty) - n(i.Returned_Qty) > 0 && (retReq(i) || {}).status !== "Pending").map(i => ({ i, b: bm[i.Book_ID] || {}, ph: ph(i.Phase_ID) }));
  return { list, elig, win };
};
Router.add("/e/returns", view => {
  const { list, elig, win } = myRetData();
  const val = list.reduce((s, x) => s + n(x.i.Returned_Qty) * n(x.i.Unit_Emp_Price), 0), pend = list.filter(x => x.r && x.r.status === "Pending").length;
  const ex = x => x.r && x.r.kind === "EXCHANGE";
  const st = x => !x.r ? ["مرتجع مسجّل", "emerald", "circle-check"] : x.r.status === "Pending" ? [ex(x) ? "استبدال عند المسؤول" : "عند المسؤول", "amber", "hourglass"] : x.r.status === "Approved" ? [ex(x) ? "اتبدّلت بنسخة سليمة" : "اتقبل واتخصم", "emerald", "circle-check"] : ["مرفوض", "rose", "circle-x"];
  const card = x => { const s = st(x), who = x.i.Beneficiary || "";
    return `<li class="card p-3.5 mb-2.5"><div class="flex items-start gap-3"><span class="w-10 h-10 rounded-xl bg-${s[1]}-50 text-${s[1]}-600 flex items-center justify-center shrink-0">${ic(s[2])}</span>
      <div class="flex-1 min-w-0"><div class="font-bold text-[14px] text-slate-900 leading-snug">${esc(bookLbl(x.b, x.i.Book_ID))}</div>
        <div class="text-[12px] text-slate-500 mt-0.5">${esc(Doc.shortGrade(x.b.Grade || ""))} · ${esc(x.ph)}${who ? " · لـ " + esc(who) : ""}</div>
        <div class="flex flex-wrap gap-1.5 mt-2 text-[12px]"><span class="rounded-full bg-${s[1]}-50 text-${s[1]}-700 px-2.5 py-0.5 font-semibold">${s[0]}</span>
          ${x.r ? `<span class="rounded-full bg-slate-100 px-2.5 py-0.5">${booksWord(x.r.qty)}</span><span class="rounded-full bg-slate-100 px-2.5 py-0.5">${x.r.condition === "DAMAGED" ? "فيه عيب" : "سليم"}</span>` : ""}
          ${n(x.i.Returned_Qty) ? `<span class="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5">اتخصم <b class="num">${fmt(n(x.i.Returned_Qty) * n(x.i.Unit_Emp_Price))}</b> ج.م</span>` : ""}</div>
        ${x.r ? `<div class="text-[12px] text-slate-600 mt-2">السبب: ${esc(x.r.reason)} <span class="text-slate-400 num">· ${esc(String(x.r.at || "").slice(0, 16))}</span></div>` : ""}
        ${x.r && x.r.status !== "Pending" ? `<div class="text-[12px] mt-1 ${x.r.status === "Approved" ? "text-emerald-700" : "text-rose-700"}">القرار ${esc(String(x.r.resolvedAt || "").slice(0, 16))}${x.r.note ? " — " + esc(x.r.note) : ""}</div>` : ""}
        ${x.r && (x.r.history || []).length ? `<details class="mt-2 text-[12px] text-slate-500"><summary class="cursor-pointer">طلبات سابقة على نفس الكتاب (${x.r.history.length})</summary><ul class="mt-1 space-y-1">${x.r.history.map(h => `<li>• ${h.kind === "EXCHANGE" ? "استبدال" : "مرتجع"} ${booksWord(h.qty)} — ${h.status === "Approved" ? "اتقبل" : h.status === "Rejected" ? "اترفض" : "معلّق"} ${esc(String(h.resolvedAt || h.at || "").slice(0, 10))}${h.note ? " (" + esc(h.note) + ")" : ""}</li>`).join("")}</ul></details>` : ""}</div></div></li>`; };
  view.innerHTML = `<div class="flex items-center gap-2 mb-3"><button class="icon-btn" onclick="history.back()" aria-label="رجوع">${ic("arrow-right")}</button><h1 class="text-[20px] font-extrabold text-slate-900">مرتجعاتي</h1></div>
    <div class="grid grid-cols-3 gap-2 mb-3 text-center"><div class="card p-2.5"><div class="text-[11.5px] text-slate-500">طلبات</div><b class="num text-[18px]">${fmt(list.length)}</b></div><div class="card p-2.5"><div class="text-[11.5px] text-slate-500">عند المسؤول</div><b class="num text-[18px] text-amber-600">${fmt(pend)}</b></div><div class="card p-2.5"><div class="text-[11.5px] text-slate-500">اتخصم من فواتيرك</div><b class="num text-[18px] text-emerald-700">${fmt(val)}</b></div></div>
    <div class="rounded-2xl bg-sky-50 ring-1 ring-sky-100 p-3 mb-4 text-[12.5px] text-sky-900 leading-relaxed">${ic("info", "inline -mt-0.5")} تقدر ترجّع الكتاب خلال <b>${win} أيام</b> من استلامه وهو سليم. بعد ما المسؤول يستلمه ويعتمده، قيمته بتتخصم من فاتورتك، ولو كنت دافع أكتر بيبقى ليك رصيد يتخصم من الجاي أو يترد لك.</div>
    ${list.length ? `<h2 class="text-[14px] font-bold text-slate-700 mb-2">طلباتي</h2><ul>${list.map(card).join("")}</ul>` : `<div class="card p-6 text-center text-slate-500 mb-4">${ic("package-check", "mx-auto mb-1")}<div>مفيش مرتجعات — كل كتبك معاك 👌</div></div>`}
    ${elig.length ? `<h2 class="text-[14px] font-bold text-slate-700 mt-4 mb-2">كتب استلمتها وممكن ترجّعها</h2><ul class="card divide-y divide-slate-100">${elig.map(x => `<li class="flex items-center gap-2 p-3"><div class="flex-1 min-w-0"><div class="text-[13.5px] font-semibold truncate">${esc(bookLbl(x.b, x.i.Book_ID))}</div><div class="text-[11.5px] text-slate-500">${esc(x.ph)}${x.i.Beneficiary ? " · لـ " + esc(x.i.Beneficiary) : ""}${(d => d === null ? "" : d > 0 ? ` · <span class="${d <= 2 ? "text-rose-600 font-semibold" : "text-amber-700"}">فاضل ${d} ${d === 1 ? "يوم" : "أيام"}</span>` : ` · <span class="text-slate-400">المدة خلصت</span>`)(retDaysLeft(x.i))}</div></div><button class="btn btn-outline btn-xs" data-act="retReq" data-id="${esc(x.i.Res_Item_ID)}">${ic("undo-2")} مرتجع / استبدال</button></li>`).join("")}</ul><p class="text-[11.5px] text-slate-400 mt-1.5">لو مدة المرتجع خلصت هيظهرلك ده لما تبعت الطلب.</p>` : ""}`;
});
// مدخل «مرتجعاتي» من «حسابي» و«حجوزاتي»
_wrap("/e/me", view => { const btn = view.querySelector('[data-act="faq"]'); if (!btn) return;
  btn.insertAdjacentHTML("beforebegin", `<a href="#/e/returns" class="w-full flex items-center gap-3 px-4 py-3.5 text-right"><span class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">${ic("undo-2")}</span><span class="flex-1"><b class="block text-[14.5px] text-slate-900">مرتجعاتي</b><span class="text-[12px] text-slate-500">طلبات المرتجع وحالتها</span></span>${ic("chevron-left", "text-slate-300")}</a>`); });
_wrap("/e/orders", view => { if (!myRetData().list.length) return; view.insertAdjacentHTML("beforeend", `<a href="#/e/returns" class="btn btn-outline w-full mt-3">${ic("undo-2")} مرتجعاتي</a>`); });
// إشعار القرار في الرئيسية لحد ما الموظف يقفله (بديل مؤقت للإشعارات خارج التطبيق)
_wrap("/e/home", view => {
  const seen = retSeen(), res = myRetData().list.filter(x => x.r && x.r.status !== "Pending" && x.r.resolvedAt && !seen[x.i.Res_Item_ID + "@" + x.r.resolvedAt]);
  if (!res.length) return;
  const html = res.map(x => { const okd = x.r.status === "Approved";
    return `<section class="card p-4 mb-3 ring-2 ${okd ? "ring-emerald-200 bg-emerald-50/40" : "ring-rose-200 bg-rose-50/40"}"><div class="flex items-start gap-3"><span class="text-[28px]">${okd ? "✅" : "❌"}</span><div class="flex-1 min-w-0">
      <b class="text-[14.5px] ${okd ? "text-emerald-800" : "text-rose-800"}">${x.r.kind === "EXCHANGE" ? (okd ? "اتقبل طلب الاستبدال" : "اترفض طلب الاستبدال") : (okd ? "اتقبل طلب المرتجع" : "اترفض طلب المرتجع")}</b>
      <div class="text-[13px] text-slate-700 mt-0.5">${esc(bookLbl(x.b, x.i.Book_ID))} — ${booksWord(x.r.qty)}</div>
      <div class="text-[12.5px] text-slate-600 mt-1">${x.r.kind === "EXCHANGE" ? (okd ? "خدت نسخة سليمة بدل المعيبة، وفاتورتك زي ما هي." : "النسخة فاضلة معاك.") : okd ? `اتخصم <b class="num">${fmt(n(x.r.qty) * n(x.i.Unit_Emp_Price))}</b> ج.م من فاتورتك.` : "الكتاب فاضل معاك وفاتورتك زي ما هي."}${x.r.note ? `<br>ملاحظة المسؤول: ${esc(x.r.note)}` : ""}</div>
      <div class="flex gap-2 mt-2.5"><a href="#/e/returns" class="btn btn-outline btn-xs">التفاصيل</a><button class="btn btn-primary btn-xs" data-act="retSeen" data-id="${esc(x.i.Res_Item_ID + "@" + x.r.resolvedAt)}">تمام</button></div></div></div></section>`; }).join("");
  afterHead(view, html);
});
on("retSeen", k => { const s = retSeen(); s[k] = 1; try { localStorage.setItem(RET_SEEN, JSON.stringify(s)); } catch (_) {} Router.render(); });

// ================================================================ السلة بعد التسليم: الكتب المتبقية فقط (الحجز الكامل يُرى في «حجوزاتي»)
/** المرحلة الحالية مقفولة واتوزعت (فيه فاتورة) ⇒ السلة تعرض المتبقي فقط */
const cartPostDelivery = () => { const r = APP.emp || {}; return !!(r.activePhase && !Emp.open() && (r.myInvoices || []).some(i => i.Phase_ID === APP.phaseId)); };
const cartLeftover = () => Emp.activeItems().filter(i => i.Waitlist_Choice !== "cancel" && n(i.Requested_Qty) > Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)));
function leftoverCartHTML() {
  const r = APP.emp, bm = Emp.bookMap(), lo = cartLeftover(), openPh = (r.phases || []).find(p => p.Booking_Open && p.Phase_ID !== APP.phaseId);
  const got = Emp.activeItems().reduce((s, i) => s + Math.max(0, n(i.Delivered_Qty) - n(i.Returned_Qty)), 0);
  const head = `<div class="rounded-2xl bg-emerald-50 ring-1 ring-emerald-100 p-3 mb-3 text-[13px] text-emerald-900">${ic("circle-check", "inline -mt-0.5")} حجز «${esc(r.activePhase.Phase_Name)}» اتقفل واتوزّع${got ? ` — استلمت <b class="num">${got}</b> ${got === 1 ? "كتاب" : "كتب"}` : ""}. حجزك كامل وفاتورته في <a href="#/e/orders" class="font-bold underline">حجوزاتي</a>.</div>`;
  const list = lo.length ? `<h3 class="text-[14px] font-bold text-slate-800 mb-1.5">${ic("hourglass", "inline -mt-0.5 text-sky-600")} الكتب المتبقية (${lo.length})</h3>
    <ul class="rounded-2xl ring-1 ring-slate-200 divide-y divide-slate-100 px-3 mb-3">${lo.map(i => { const b = bm[i.Book_ID] || {}, q = n(i.Requested_Qty) - Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty));
      return `<li class="flex items-center gap-2 py-2.5"><div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px] text-slate-800 truncate">${esc(bookLbl(b, i.Book_ID))}</div><div class="text-[11.5px] text-slate-500">${i.Beneficiary ? " · لـ " + esc(i.Beneficiary) : ""} · ${i.Waitlist_Choice === "carry" ? "هيترحّل بأسبقيتك" : "مستني قرارك"}</div></div><span class="pill pill-blue num">${q}</span></li>`; }).join("")}</ul>
    <div class="grid gap-2"><button class="btn btn-outline btn-sm" data-act="printLeftoverE">${ic("printer")} اطبع طلب الحجز بالمتبقي</button></div>`
    : `<div class="text-center text-slate-500 text-[13.5px] py-4">${ic("package-check", "mx-auto mb-1")} مفيش كتب متبقية — كل حجزك اتسلّم 👌</div>`;
  const next = openPh ? `<button class="btn btn-primary w-full mt-3" data-act="setPhase" data-id="${esc(openPh.Phase_ID)}">${ic("plus")} الحجز مفتوح في «${esc(openPh.Phase_Name)}» — ضيف كتب</button>`
    : `<div class="rounded-2xl bg-slate-50 p-3 mt-3 text-[12.5px] text-slate-600">${ic("calendar-clock", "inline -mt-0.5")} عايز تضيف كتب تانية؟ استنى فتح المرحلة الجاية — هيوصلك إشعار في الجرس أول ما تفتح.</div>`;
  return head + list + next;
}
if (typeof cartHTML === "function") { const _cartHTML0 = cartHTML; cartHTML = function () { return cartPostDelivery() && !Emp._noList ? leftoverCartHTML() : _cartHTML0(); }; }
if (typeof refreshCartViews === "function") { const _rcv0 = refreshCartViews; refreshCartViews = function () { _rcv0();
  if (!cartPostDelivery()) return; const lo = cartLeftover().length, bar = $("#cartBar"); if (bar) bar.classList.add("hidden");
  const badge = $("#cartBadge"); if (badge) { badge.textContent = lo; badge.classList.toggle("hidden", !lo); } const hc = $("#cartCount"); if (hc) hc.textContent = lo; }; }

// ================================================================ تحسينات السلة: تنبيهات قبل التأكيد + ملخص الدفع + مسودة على الخادم + تذكير القفل
/** تنبيهات السلة: تغيّر السعر/التسعير، كتاب موقوف، نفس الكتاب لأكتر من ابن، تجاوز الحد الائتماني */
function cartAlerts() {
  const r = APP.emp || {}, bm = Emp.bookMap(), saved = {};
  Emp.activeItems().forEach(i => { saved[ck(i.Book_ID, i.Beneficiary)] = i; });
  const out = [], byBook = {};
  Object.keys(APP.cart).forEach(k => { const id = bk(k), b = bm[id], it = saved[k];
    (byBook[id] = byBook[id] || []).push(bn(k) || "");
    if (!b) out.push(["rose", "ban", `«${esc(id)}» مش متاح دلوقتي في الدليل — شيله من السلة.`]);
    else if (String(b.Book_Status || b.Status || "").match(/Discontinued|موقوف/i)) out.push(["rose", "ban", `«${esc(bookLbl(b, id))}» اتوقف — شيله أو بدّله.`]);
    else if (it && n(it.Unit_Emp_Price) && n(b.Emp_Selling_Price) && Math.abs(n(it.Unit_Emp_Price) - n(b.Emp_Selling_Price)) > 0.004)
      out.push(["amber", "badge-percent", `سعر «${esc(bookLbl(b, id))}» اتغيّر من <b class="num">${fmt(it.Unit_Emp_Price)}</b> لـ <b class="num">${fmt(b.Emp_Selling_Price)}</b> ج.م.`]);
    else if (it && !n(it.Unit_Emp_Price) && n(b.Emp_Selling_Price)) out.push(["emerald", "badge-percent", `«${esc(bookLbl(b, id))}» اتسعّر: <b class="num">${fmt(b.Emp_Selling_Price)}</b> ج.م.`]);
  });
  Object.keys(byBook).filter(id => byBook[id].length > 1).forEach(id => { const who = byBook[id].map(x => x || "ابنك").join(" و");
    out.push(["sky", "users", `«${esc(bookLbl(bm[id], id))}» في السلة لأكتر من فرد (${esc(who)}) — اتأكد إنك قاصد.`]); });
  // الحد الائتماني: المؤجل في هذا الحجز + المتبقي عليك من مراحل تانية
  const t = Emp.totals(), p = APP.plan || {};
  if (p.method === "INSTALLMENT" && t.net > 0) { const pc = Emp.planCalc(t.net), deferred = Math.max(0, t.net - n(pc.down)),
      other = (r.myInvoices || []).filter(i => i.Phase_ID !== APP.phaseId).reduce((s, i) => s + n(i.Remaining_Balance), 0), lim = n((r.employee || {}).creditLimit);
    if (lim && deferred + other > lim) out.push(["rose", "triangle-alert", `المؤجل (<b class="num">${fmt(deferred)}</b>${other ? ` + <b class="num">${fmt(other)}</b> عليك من مراحل سابقة` : ""}) أكبر من حد التقسيط المسموح <b class="num">${fmt(lim)}</b> ج.م — زوّد المقدم أو قلّل الكتب أو ادفع نقداً.`]); }
  return out;
}
function cartPaySummary() {
  const t = Emp.totals(), p = APP.plan || {}; if (!t.count || !t.net) return "";
  if (p.method !== "INSTALLMENT") return `<div class="rounded-2xl bg-brand-50 ring-1 ring-brand-100 p-3 mt-3 text-[13px] text-brand-900">${ic("wallet", "inline -mt-0.5")} هتدفع <b class="num">${fmt(t.net)}</b> ج.م ${p.method === "CASH" ? "نقداً عند الاستلام" : "تحويل"} — ووفّرت <b class="num">${fmt(t.cover - t.net)}</b> ج.م.</div>`;
  const pc = Emp.planCalc(t.net), d = new Date(); d.setMonth(d.getMonth() + 1);
  return `<div class="rounded-2xl bg-brand-50 ring-1 ring-brand-100 p-3 mt-3 text-[13px] text-brand-900 leading-relaxed">${ic("calendar-check", "inline -mt-0.5")} المقدم <b class="num">${fmt(pc.down)}</b> ج.م، وبعده <b class="num">${pc.cnt}</b> ${pc.cnt === 1 ? "قسط" : "أقساط"} كل شهر <b class="num">${fmt(pc.per)}</b> ج.م — أول قسط تقريباً <b class="num">${d.toISOString().slice(0, 10)}</b> (التاريخ النهائي يتحدد مع الفاتورة).</div>`;
}
if (typeof cartHTML === "function") { const _cartHTML1 = cartHTML; cartHTML = function () {
  const html = _cartHTML1(); if (cartPostDelivery() || Emp._noList || !Emp.open()) return html;
  const al = cartAlerts(), box = al.length ? `<div class="space-y-1.5 mb-3">${al.map(a => `<div class="rounded-xl bg-${a[0]}-50 ring-1 ring-${a[0]}-100 text-${a[0]}-800 px-3 py-2 text-[12.5px] flex gap-2">${ic(a[1], "shrink-0 mt-0.5")}<span>${a[2]}</span></div>`).join("")}</div>` : "";
  const sum = cartPaySummary(), btn = '<button data-act="submitRes"';
  return box + (sum && html.includes(btn) ? html.replace(btn, sum + btn) : html); // ملخص الدفع في خطوة التأكيد فقط
}; }

// مسودة السلة على الخادم: تُحفظ بعد كل تعديل (بعد 5 ثوانٍ من آخر تغيير) وتُستعاد من أي جهاز
let _draftT = null, _draftLast = "";
const draftSave = () => { if (!APP.emp || !Emp.open() || !APP.user || APP.user.userType !== "EMPLOYEE") return;
  const body = Emp.dirty ? JSON.stringify(APP.cart) : ""; if (body === _draftLast) return; _draftLast = body;
  call("SAVE_CART_DRAFT", { phaseId: APP.phaseId, cart: Emp.dirty ? APP.cart : null }).catch(() => {}); };
if (typeof refreshCartViews === "function") { const _rcv1 = refreshCartViews; refreshCartViews = function () { _rcv1(); clearTimeout(_draftT); _draftT = setTimeout(draftSave, 5000); }; }
/** استعادة المسودة لو الجهاز ده مفيهوش تعديلات والمسودة أحدث من الحجز المحفوظ */
function draftRestore() {
  const r = APP.emp || {}, d = (r.employee || {}).cartDraft; if (!d || !d.cart || !Emp.open() || Emp.dirty || d.phaseId !== APP.phaseId) return;
  const h = (r.myReservations || []).find(x => x.Phase_ID === APP.phaseId), savedAt = String((h && (h.Last_Modified_At || h.Created_At)) || "");
  if (savedAt && String(d.at) <= savedAt) return;
  const cur = JSON.stringify(APP.cart), nx = JSON.stringify(d.cart); if (cur === nx || !Object.keys(d.cart).length) return;
  APP.cart = Object.assign({}, d.cart); Emp.dirty = true; _draftLast = nx;
  toast("رجّعنا سلتك اللي ما اتأكدتش (من آخر جهاز) — راجعها وأكّد 👌", "info"); if (typeof refreshCartViews === "function") refreshCartViews();
}
_wrap("/e/home", () => setTimeout(draftRestore, 50));
_wrap("/e/books", () => setTimeout(draftRestore, 50));
// بعد التأكيد: امسح المسودة
if (ACTIONS.submitRes) { const _sr0 = ACTIONS.submitRes; on("submitRes", async (...a) => { const r = await _sr0(...a); if (!Emp.dirty) { _draftLast = ""; call("SAVE_CART_DRAFT", { phaseId: APP.phaseId, cart: null }).catch(() => {}); } return r; }); }

// تذكير قبل قفل الحجز: سلة ما اتأكدتش والحجز بيقفل خلال يومين
_wrap("/e/home", view => {
  const dl = Emp.daysLeft(); if (!Emp.open() || !Emp.dirty || dl === null || dl > 2) return;
  afterHead(view, `<section class="card p-4 mb-3 ring-2 ring-rose-200 bg-rose-50/50 flex items-center gap-3"><span class="text-[28px]">⏰</span><div class="flex-1"><b class="text-[14.5px] text-rose-800">عندك كتب في السلة لسه ما أكدتهاش</b><div class="text-[12.5px] text-slate-600">الحجز بيقفل ${dl <= 0 ? "النهارده" : dl === 1 ? "بكرة" : "بعد يومين"} — أكّد قبلها عشان أسبقيتك تتحسب.</div></div><button class="btn btn-primary btn-sm" data-act="openCart">أكّد</button></section>`);
});

// ================================================================ مرحلة مقفولة ومكانش ليه فيها حجز (وصلها من رابط/إشعار قديم): رسالة لطيفة بدل صفحة فاضية
function noBookingPhaseCard() {
  const r = APP.emp || {}, ph = r.activePhase; if (!ph || Emp.open()) return "";
  if ((r.myReservationItems || []).some(i => i.Phase_ID === ph.Phase_ID) || (r.myInvoices || []).some(i => i.Phase_ID === ph.Phase_ID)) return "";
  const open = (r.phases || []).find(p => p.Booking_Open), mine = Shell.empPhases(r).filter(p => p.Phase_ID !== ph.Phase_ID).pop();
  const go = open ? `<button class="btn btn-primary btn-sm" data-act="setPhase" data-id="${esc(open.Phase_ID)}">${ic("sparkles")} الحجز مفتوح في «${esc(open.Phase_Name)}»</button>`
    : mine ? `<button class="btn btn-outline btn-sm" data-act="setPhase" data-id="${esc(mine.Phase_ID)}">${ic("package-check")} حجزك في «${esc(mine.Phase_Name)}»</button>` : "";
  return `<section class="card p-4 mb-4 ring-1 ring-slate-200"><div class="flex items-start gap-3"><span class="text-[26px]">📘</span><div class="flex-1 min-w-0">
    <b class="text-[14.5px] text-slate-900">«${esc(ph.Phase_Name)}» اتقفلت ومكانش ليك فيها حجز</b>
    <div class="text-[12.5px] text-slate-600 mt-0.5">${open ? "مفيش مشكلة — تقدر تحجز دلوقتي في المرحلة المفتوحة." : "أول ما تفتح مرحلة جديدة هيوصلك إشعار في الجرس."}</div>${go ? `<div class="mt-2.5">${go}</div>` : ""}</div></div></section>`;
}
["/e/home", "/e/orders", "/e/books"].forEach(p => _wrap(p, view => afterHead(view, noBookingPhaseCard())));

// ================================================================ «زي اللي فات بضغطة»: نفس الناشرين والمواد لصف كل ابن الحالي
/** اقتراحات لكل فرد من حجوزاته السابقة (السنة اللي فاتت بصفها السابق، أو ترم سابق بنفس الصف) */
function repeatSuggestions() {
  const r = APP.emp || {}; if (!Emp.open()) return [];
  const grades = ((r.catalog || {}).grades || []).map(g => g.label), bm = Emp.bookMap(), books = r.books || [];
  const past = (r.myReservationItems || []).filter(i => i.Phase_ID !== APP.phaseId && !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward" && n(i.Requested_Qty) > 0);
  if (!past.length) return [];
  const owned = new Set(past.map(i => i.Book_ID + "|" + (i.Beneficiary || "")));
  return myKids().map((k, ix) => {
    const ben = kidBen(k), gi = grades.indexOf(k.grade), prev = gi > 0 ? grades[gi - 1] : null;
    const mine = past.filter(i => (i.Beneficiary || "") === ben && bm[i.Book_ID] && [k.grade, prev].includes(bm[i.Book_ID].Grade));
    const seen = new Set(), picks = [];
    mine.forEach(i => { const o = bm[i.Book_ID], key = o.Publisher + "|" + o.Subject + "|" + (o.Book_Part || ""); if (seen.has(key)) return; seen.add(key);
      const nb = books.find(b => b.Grade === k.grade && b.Publisher === o.Publisher && b.Subject === o.Subject && (b.Book_Part || "") === (o.Book_Part || "") && typeOk(b, k.type, k.track || "") && !owned.has(b.Book_ID + "|" + ben))
        || books.find(b => b.Grade === k.grade && b.Publisher === o.Publisher && b.Subject === o.Subject && typeOk(b, k.type, k.track || "") && !owned.has(b.Book_ID + "|" + ben));
      if (nb && !(APP.cart || {})[ck(nb.Book_ID, ben)]) picks.push(nb); });
    return { k, ix, ben, picks, fromLastYear: mine.some(i => bm[i.Book_ID].Grade === prev) };
  }).filter(x => x.picks.length);
}
function repeatCard() {
  const sg = repeatSuggestions(); if (!sg.length) return "";
  return `<section class="card p-4 mb-4 ring-1 ring-gold-200 bg-gold-50/40"><div class="flex items-center gap-2 mb-2"><span class="text-[24px]">🔁</span><div class="flex-1"><b class="text-[15px] text-slate-900">احجز زي اللي فات بضغطة</b><div class="text-[12px] text-slate-600">نفس الناشرين والمواد اللي اخترتها قبل كده — لصف كل واحد دلوقتي</div></div></div>
    <ul class="space-y-2">${sg.map(x => `<li class="rounded-2xl bg-white ring-1 ring-slate-200 p-3"><div class="flex items-center gap-2"><span class="text-[20px]">${kidEmoji(x.k)}</span><div class="flex-1 min-w-0"><b class="text-[13.5px]">${esc(kidName(x.k, x.ix))}</b> <span class="text-[12px] text-slate-500">· ${esc(Doc.shortGrade(x.k.grade))}${x.fromLastYear ? " · من السنة اللي فاتت" : ""}</span>
        <div class="text-[11.5px] text-slate-500 truncate">${x.picks.map(b => esc(b.Publisher + " " + b.Subject)).join("، ")}</div></div>
        <button class="btn btn-primary btn-sm shrink-0" data-act="repeatAdd" data-id="${x.ix}">${ic("plus")} ضيف ${x.picks.length}</button></div></li>`).join("")}</ul>
    <p class="text-[11.5px] text-slate-500 mt-2">${ic("info", "inline -mt-0.5")} بتتضاف للسلة بس — تقدر تشيل أي كتاب قبل ما تأكد.</p></section>`;
}
on("repeatAdd", v => { const x = repeatSuggestions().find(s => s.ix === +v); if (!x) return;
  x.picks.forEach(b => { const key = ck(b.Book_ID, x.ben); APP.cart[key] = Math.max(APP.cart[key] || 0, 1); });
  Emp.dirty = true; if (x.ben && !Emp.bens.includes(x.ben)) Emp.bens.push(x.ben);
  toast(`اتضاف ${x.picks.length} ${x.picks.length > 2 ? "كتب" : "كتاب"} لـ ${kidName(x.k, x.ix)} 🎉 — راجع السلة وأكّد`, "success"); refreshCartViews(); Router.render(); });
["/e/home", "/e/books"].forEach(p => _wrap(p, view => afterHead(view, repeatCard())));

// ================================================================ ميزانيتان اختياريتان: للأسرة (ولادك) وللأقارب — تنبيه لكل واحدة في السلة
const BUDGET_KEY = g => "wb_budget_" + (g === "rel" ? "rel_" : "") + ((APP.user && APP.user.empId) || "");
const budgetGet = g => { try { return n(localStorage.getItem(BUDGET_KEY(g))); } catch (_) { return 0; } };
/** صافي السلة لكل مجموعة: fam = كتب ولادك، rel = كتب الأقارب */
const budgetSpent = () => { const bm = Emp.bookMap(), o = { fam: 0, rel: 0 }; Object.keys(APP.cart || {}).forEach(k => { o[bn(k) ? "rel" : "fam"] += n(APP.cart[k]) * n((bm[bk(k)] || {}).Emp_Selling_Price); }); return o; };
on("setBudget", async () => {
  const hasRel = relOn();
  const v = await UI.form({ title: "ميزانية الكتب", intro: "حط أقصى مبلغ عايز تصرفه المرحلة دي — هننبهك لو السلة عدّته. محفوظة على موبايلك بس، وسيب الخانة فاضية عشان تشيلها.",
    fields: [{ name: "fam", label: "ميزانية الأسرة — ولادك (ج.م)", type: "number", value: budgetGet("fam") || "", min: 0 }].concat(hasRel ? [{ name: "rel", label: "ميزانية الأقارب (ج.م)", type: "number", value: budgetGet("rel") || "", min: 0 }] : []), ok: "حفظ" });
  if (!v) return;
  ["fam", "rel"].forEach(g => { if (g === "rel" && !hasRel) return; try { n(v[g]) > 0 ? localStorage.setItem(BUDGET_KEY(g), String(n(v[g]))) : localStorage.removeItem(BUDGET_KEY(g)); } catch (_) {} });
  toast(n(v.fam) > 0 || n(v.rel) > 0 ? "اتحفظت الميزانية 👌" : "اتشالت الميزانية", "success"); refreshCartViews();
});
function budgetBar(g, label, emoji, spent) {
  const bud = budgetGet(g); if (!bud) return "";
  const pct = Math.min(100, Math.round(spent / bud * 100)), over = spent > bud;
  return `<div class="rounded-2xl ${over ? "bg-rose-50 ring-rose-200" : "bg-emerald-50 ring-emerald-100"} ring-1 p-3 mb-2"><div class="flex items-center justify-between gap-2 text-[12.5px]"><span class="${over ? "text-rose-800" : "text-emerald-800"} font-semibold">${emoji} ${label}: ${over ? `عديتها بـ <b class="num">${fmt(spent - bud)}</b> ج.م` : `فاضل <b class="num">${fmt(bud - spent)}</b> ج.م`}</span><button class="text-brand-700 font-semibold shrink-0" data-act="setBudget">تعديل</button></div>
    <div class="mt-2 h-2 rounded-full bg-white overflow-hidden"><div class="h-full rounded-full ${over ? "bg-rose-500" : pct > 85 ? "bg-amber-500" : "bg-emerald-500"}" style="width:${pct}%"></div></div><div class="text-[11px] text-slate-500 mt-1 num">${fmt(spent)} من ${fmt(bud)} ج.م</div></div>`;
}
if (typeof cartHTML === "function") { const _cartHTML2 = cartHTML; cartHTML = function () {
  const html = _cartHTML2(); if (cartPostDelivery() || Emp._noList || !Emp.open() || (Emp.cartStep && Emp.cartStep !== "list")) return html;
  const sp = budgetSpent(), bars = budgetBar("fam", "ميزانية الأسرة", "👨‍👩‍👧", sp.fam) + budgetBar("rel", "ميزانية الأقارب", "🧒", sp.rel);
  const hasRel = Object.keys(APP.cart || {}).some(k => bn(k)), missing = !budgetGet("fam") && !budgetGet("rel"); // مفيش ميزانية خالص ← رابط صغير بس
  return (bars ? `<div class="mb-1">${bars}</div>` : "") + html + (missing ? `<button class="w-full text-center text-[12px] text-slate-500 hover:text-brand-700 font-semibold mt-3" data-act="setBudget">${ic("piggy-bank", "inline -mt-0.5")} ${hasRel ? "حط ميزانية لأولادك وللأقارب (اختياري)" : "حط ميزانية لأولادك (اختياري)"}</button>` : (bars ? `<button class="w-full text-center text-[11.5px] text-slate-400 hover:text-brand-700 mt-2" data-act="setBudget">${ic("pencil", "inline -mt-0.5 !w-3 !h-3")} تعديل الميزانية</button>` : ""));
}; }
