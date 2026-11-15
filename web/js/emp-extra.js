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
    out.unshift({ id: "priced-" + i.Book_ID + "-" + b.Emp_Selling_Price, icon: "badge-percent", tone: "green", title: `اتسعّر «${b.Book_Name}» 🎉`, body: `سعره لك ${fmt(b.Emp_Selling_Price)} ج.م بدل ${fmt(b.Cover_Price)}${i.Beneficiary ? " — لـ " + i.Beneficiary : ""}`, href: "#/e/orders" });
  });
  const ready = items.reduce((s, i) => s + Math.max(0, n(i.Allocated_Qty) - n(i.Delivered_Qty)), 0);
  if (ready) out.unshift({ id: "ready-" + ready, icon: "package-check", tone: "green", title: `كتبك جاهزة — ${booksWord(ready)} 📦`, body: "افتح «حجوزاتي» تشوف موعدك ورمز الاستلام", href: "#/e/orders" });
  return out;
};

// ---------------------------------------------------------------- «وفّرت هذا العام»
function mySavings() {
  const bm = Emp.bookMap(); let cover = 0, paid = 0, books = 0;
  Emp.phaseItems().filter(i => !String(i.Allocation_Status).startsWith("Cancelled")).forEach(i => {
    const b = bm[i.Book_ID] || {}, q = n(i.Requested_Qty), ep = n(i.Unit_Emp_Price) || n(b.Emp_Selling_Price), cp = n(i.Unit_Cover_Price) || n(b.Cover_Price);
    if (!ep || !cp) return; cover += q * cp; paid += q * ep; books += q;
  });
  return { cover, paid, save: Math.max(0, cover - paid), books };
}
function savingsCard() {
  const s = mySavings(); if (s.save < 1) return "";
  return `<section class="card overflow-hidden mb-4" style="background:linear-gradient(135deg,#f0fdf4,#fefce8)"><div class="p-4 sm:p-5 flex items-center gap-4">
    <span class="text-[40px] leading-none">💰</span>
    <div class="flex-1 min-w-0"><div class="text-[12.5px] font-bold text-emerald-700">وفّرت السنة دي</div><div class="font-display font-bold text-[26px] text-emerald-800 num leading-tight">${fmt(Math.round(s.save))} <span class="text-[14px]">ج.م</span></div>
      <div class="text-[12px] text-slate-500">على ${booksWord(s.books)} · ${Math.round(s.save / s.cover * 100)}% أقل من السعر قبل الخصم</div></div>
    <button class="btn btn-success btn-sm shrink-0" data-act="shareSave">${ic("send")} شارك</button></div></section>`;
}
on("shareSave", () => {
  const s = mySavings();
  const txt = `💰 وفّرت ${fmt(Math.round(s.save))} ج.م على كتب أولادي الخارجية السنة دي (${Math.round(s.save / s.cover * 100)}% أقل من السعر قبل الخصم) مع مبادرة الكتب المخفضة — ${Brand.get().org} 📚\nنقابتك معاك… من أول كتاب\n${location.origin}`;
  if (navigator.share) navigator.share({ text: txt }).catch(() => {}); else window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank");
});

// ---------------------------------------------------------------- قواعد التعديل بعد قفل الحجز
function closedRulesBox() {
  const ph = (APP.emp || {}).activePhase || {};
  if (ph.Booking_Open || !Emp.phaseItems().length) return "";
  return `<div class="mb-4 rounded-2xl bg-sky-50 ring-1 ring-sky-100 text-sky-900 p-3.5 text-[13px] leading-relaxed flex gap-2.5">${ic("info", "mt-0.5 text-sky-600")}<div>
    <b>الحجز اتقفل.</b> الكتب اتطلبت من المكتبة بعدد الحجوزات، فأي تقليل أو إلغاء دلوقتي بيبقى عن طريق المسؤول بس وممكن يترفض لو الكتاب اتورّد.
    <button class="text-brand-700 font-semibold underline mr-1" data-act="contact">كلّم المسؤول</button> · <button class="text-brand-700 font-semibold underline" data-act="faq">أسئلة شائعة</button></div></div>`;
}

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
  if (ph.Booking_Open) return "";
  const bm = Emp.bookMap(), w = Emp.phaseItems().filter(i => !String(i.Allocation_Status).startsWith("Cancelled") && n(i.Requested_Qty) > Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)));
  if (!w.length) return "";
  const decided = w.every(i => i.Waitlist_Choice === "carry");
  const list = w.map(i => { const b = bm[i.Book_ID] || {}, g = Doc.shortGrade(b.Grade); return `<li class="flex items-center gap-2 py-1.5 min-w-0"><span class="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span><span class="flex-1 min-w-0 truncate whitespace-nowrap"><b>${esc(b.Publisher || b.Book_Name || i.Book_ID)}</b> · ${esc(b.Subject || "")}${g ? ` · <span class="text-slate-500">${esc(g)}</span>` : ""}${i.Beneficiary ? ` · <span class="text-sky-700">${esc(i.Beneficiary)}</span>` : ""}</span><span class="num text-slate-500 shrink-0">${fmt(n(i.Requested_Qty) - Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)))}</span></li>`; }).join("");
  return `<section class="card mb-4 ring-2 ring-sky-200 overflow-hidden"><div class="p-4">
    <div class="flex items-center gap-2 font-bold text-[15.5px] text-sky-900">⏳ كتب لسه موصلتش</div>
    <p class="text-[12.5px] text-slate-600 mt-1">مش داخلة في فاتورتك ومش هتدفع تمنها دلوقتي.</p>
    <ul class="mt-2 text-[13.5px] divide-y divide-slate-100">${list}</ul>
    ${decided ? `<div class="mt-3 rounded-xl bg-emerald-50 text-emerald-800 p-3 text-[13px] font-semibold">${ic("circle-check")} هتترحّل للمرحلة الجاية بأسبقيتك.</div>
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
    s.req += rq; s.deliv += dl; s.ready += Math.max(0, al - dl); s.wait += Math.max(0, rq - Math.max(al, dl));
    if (i.Allocation_Status === "Carried_Forward" || /رُحِّلت/.test(i.Unallocated_Reason || "")) s.carried += 1; });
  return s;
}
/** بطاقة «مرحلة جديدة»: تظهر في الرئيسية عند فتح مرحلة والموظف له حجز في مرحلة سابقة */
function newPhaseCard() {
  const r = APP.emp, ph = r.activePhase; if (!ph || !ph.Booking_Open) return "";
  const prev = (r.phases || []).filter(p => p.Phase_ID !== ph.Phase_ID && (r.myReservationItems || []).some(i => i.Phase_ID === p.Phase_ID)).pop();
  if (!prev) return "";
  const s = phaseSummary(prev.Phase_ID), carriedHere = Emp.phaseItems().filter(i => i.Carried_From_Item_ID).length;
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
function cancelBox() {
  const ph = (APP.emp || {}).activePhase || {}, st = ph.Effective_Status || ph.Phase_Status;
  const items = Emp.phaseItems().filter(i => !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward");
  const und = items.reduce((s, i) => s + Math.max(0, n(i.Requested_Qty) - n(i.Delivered_Qty)), 0);
  const cr = cancelRequestOf();
  if (cr && cr.status === "Pending") return `<div class="mt-4 rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-3.5 text-[13px] text-amber-900">${ic("hourglass")} <b>طلب الإلغاء عند المسؤول</b> — اتسجّل ${esc(String(cr.at || "").slice(0, 10))} وهيتراجع قريب.</div>`;
  if (cr && cr.status === "Rejected") return `<div class="mt-4 rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-3.5 text-[13px] text-slate-700">${ic("info")} المسؤول ما وافقش على الإلغاء${cr.note ? ": " + esc(cr.note) : ""}.</div>`;
  if (!und || st === "Completed") return "";
  const how = ph.Booking_Open || !ph.Po_Frozen ? "الإلغاء فوري ومن غير أي التزام 👌" : st === "Delivering" ? "الكتب اتطلبت ووصلت — الإلغاء محتاج موافقة المسؤول، واللي استلمته يتعامل كمرتجع." : "الكتب اتطلبت من المكتبة — الإلغاء محتاج موافقة المسؤول.";
  return `<div class="mt-5 text-center"><button class="text-[13px] text-rose-600 font-semibold underline underline-offset-4" data-act="empCancel">${ic("x")} ${ph.Booking_Open || !ph.Po_Frozen ? "إلغاء طلبي" : "طلب إلغاء"}</button><div class="text-[11.5px] text-slate-500 mt-1">${how}</div></div>`;
}
on("empCancel", async () => {
  const ph = APP.emp.activePhase || {}, direct = ph.Booking_Open || !ph.Po_Frozen;
  const v = await UI.form({ title: direct ? "إلغاء الطلب" : "طلب إلغاء", danger: true,
    intro: direct ? "هنلغي كل الكتب اللي في طلبك في المرحلة دي. تقدر تحجز تاني في أي وقت طول ما الحجز مفتوح." : "طلبك هيروح للمسؤول يراجعه. لو اتوافق عليه هيتلغي اللي ما استلمتهوش بس، وأي فلوس زيادة دفعتها هترجعلك كرصيد.",
    fields: [{ name: "reason", label: "السبب (اختياري)", placeholder: "مثال: اشتريت الكتب من مكان تاني" }], ok: direct ? "إلغاء الطلب" : "إرسال الطلب", icon: "x" });
  if (!v) return;
  const r = await call("EMP_CANCEL_REQUEST", { phaseId: APP.phaseId, reason: v.reason }, { block: true });
  if (!r.success) return toast(r.message, "danger");
  await reloadData();
  r.immediate ? happyDialog("💜", "اتلغى طلبك", "ولا يهمك — شكراً إنك كنت معانا، والمبادرة مستنياك في أي وقت 🌷") : happyDialog("📨", "طلبك وصل للمسؤول", "هيراجعه ويبلغك — وطلبك فاضل زي ما هو لحد ما يتم الرد.");
});
_wrap("/e/orders", view => { const c = cancelBox(); if (c) view.insertAdjacentHTML("beforeend", c); });

// ---------------------------------------------------------------- إلغاء قبل التأكيد: يرجع السلة لآخر حجز محفوظ (أو يفرّغها)
on("discardDraft", async () => {
  const had = (APP.emp.myReservations || []).some(x => x.Phase_ID === APP.phaseId);
  if (!await UI.confirm({ title: had ? "تراجع عن التعديلات" : "إلغاء الطلب", message: had ? "هنرجّع حجزك زي ما كان محفوظ آخر مرة." : "هنفضّي السلة ومش هيتسجل أي حجز.", ok: "أيوه", tone: "danger" })) return;
  if (Emp._cartSheet) { Emp._cartSheet.close(); Emp._cartSheet = null; }
  Emp.resetCart(); try { wzClear(); } catch (_) {} Emp.wzManual = false;
  Router.go("/e/home"); Shell.rerender();
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
    const yes = await UI.confirm({ title: "حجزته قبل كده 👀", message: `«${b.Book_Name || bid}» محجوز${ben ? " لـ " + ben : ""} بالفعل (${booksWord(saved)}). عايز تزوّد نسخة كمان؟`, ok: "أيوه، زوّد نسخة", cancel: "لا، كفاية كده" });
    if (!yes) return;
    Emp._dupOk[key] = true;
  }
  return _cartIncBase(id);
});

// ---------------------------------------------------------------- طلب مرتجع بعد الاستلام (خلال المدة) — يعتمده المسؤول
function retReq(i) { try { return JSON.parse(i.Return_Request || "null"); } catch (_) { return null; } }
function retLine(i) {
  const can = n(i.Delivered_Qty) - n(i.Returned_Qty), r = retReq(i);
  if (r && r.status === "Pending") return `<div class="mt-2.5 text-[12px] rounded-lg bg-amber-50 text-amber-800 px-2.5 py-1.5">${ic("hourglass")} طلب مرتجع ${booksWord(r.qty)} عند المسؤول</div>`;
  const tail = r && r.status === "Approved" ? `<div class="mt-2.5 text-[12px] rounded-lg bg-emerald-50 text-emerald-800 px-2.5 py-1.5">${ic("circle-check")} اتقبل المرتجع واتخصم من فاتورتك</div>` : r && r.status === "Rejected" ? `<div class="mt-2.5 text-[12px] rounded-lg bg-slate-50 text-slate-600 px-2.5 py-1.5">${ic("info")} طلب المرتجع ما اتقبلش${r.note ? ": " + esc(r.note) : ""}</div>` : "";
  if (can <= 0) return tail;
  return tail + `<button class="mt-2.5 text-[12.5px] text-brand-700 font-semibold" data-act="retReq" data-id="${esc(i.Res_Item_ID)}">${ic("undo-2")} طلب مرتجع</button>`;
}
on("retReq", async id => {
  const it = Emp.phaseItems().find(x => x.Res_Item_ID === id); if (!it) return;
  const can = n(it.Delivered_Qty) - n(it.Returned_Qty), b = Emp.bookMap()[it.Book_ID] || {}, win = n((APP.emp.settings || {}).EMP_RETURN_WINDOW_DAYS) || 7;
  const v = await UI.form({ title: "طلب مرتجع", sub: b.Book_Name, intro: `المرتجع متاح خلال ${win} أيام من الاستلام، والكتاب لازم يكون سليم. بعد موافقة المسؤول بيتخصم تمنه من فاتورتك (ولو كنت دافع، يرجعلك رصيد).`,
    fields: [{ name: "qty", label: "العدد", type: "number", value: 1, min: 1, max: can }, { name: "condition", label: "حالة الكتاب", type: "select", value: "GOOD", options: [["GOOD", "سليم"], ["DAMAGED", "فيه عيب"]] }, { name: "reason", label: "السبب", placeholder: "مثال: الكتاب مكرر / غلط في الصف" }],
    ok: "إرسال الطلب", icon: "undo-2" });
  if (!v) return;
  const r = await call("EMP_RETURN_REQUEST", { resItemId: id, qty: n(v.qty), condition: v.condition, reason: v.reason }, { block: true });
  if (!r.success) return toast(r.message, "danger");
  await reloadData(); happyDialog("📦", "طلب المرتجع وصل", "هات الكتاب للمسؤول، وبعد المراجعة هيتخصم من فاتورتك تلقائياً 👌");
});
