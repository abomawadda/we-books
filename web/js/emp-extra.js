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
      <div class="text-[12px] text-slate-500">على ${booksWord(s.books)} · ${Math.round(s.save / s.cover * 100)}% أقل من سعر الغلاف</div></div>
    <button class="btn btn-success btn-sm shrink-0" data-act="shareSave">${ic("send")} شارك</button></div></section>`;
}
on("shareSave", () => {
  const s = mySavings();
  const txt = `💰 وفّرت ${fmt(Math.round(s.save))} ج.م على كتب أولادي الخارجية السنة دي (${Math.round(s.save / s.cover * 100)}% أقل من سعر الغلاف) مع مبادرة الكتب المخفضة — ${Brand.get().org} 📚\nنقابتك معاك… من أول كتاب\n${location.origin}`;
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
