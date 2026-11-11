/* ============================================================================
 * بوابة الموظف: الرئيسية، الكتالوج والسلة، حجوزاتي، مدفوعاتي، حسابي
 * ========================================================================== */
"use strict";
const SUBJECT_TONES = [["#7c4bb6", "#46256b"], ["#0ea5e9", "#0369a1"], ["#10b981", "#047857"], ["#f59e0b", "#b45309"], ["#f43f5e", "#be123c"], ["#6366f1", "#4338ca"], ["#14b8a6", "#0f766e"], ["#a855f7", "#7e22ce"]];
const toneOf = s => { let h = 0; String(s || "").split("").forEach(c => h = (h * 31 + c.charCodeAt(0)) >>> 0); return SUBJECT_TONES[h % SUBJECT_TONES.length]; };

const Emp = {
  filter: { stage: "", grade: "", q: "" },
  dirty: false,

  async load() {
    const r = await call("GET_EMPLOYEE_PORTAL_DATA", { phaseId: APP.phaseId });
    if (!r.success) { toast(r.message, "danger"); return; }
    const samePhase = APP.emp && r.activePhase && APP.phaseId === r.activePhase.Phase_ID;
    APP.emp = r; store.set("cache", { t: "EMP", d: r });
    if (r.activePhase) APP.phaseId = r.activePhase.Phase_ID;
    if (!(samePhase && Emp.dirty)) Emp.resetCart();
    Shell.rerender();
  },
  resetCart() {
    const r = APP.emp; APP.cart = {}; Emp.dirty = false;
    if (!r.activePhase) return;
    Emp.activeItems().forEach(i => APP.cart[i.Book_ID] = (APP.cart[i.Book_ID] || 0) + n(i.Requested_Qty));
    const h = r.myReservations.find(x => x.Phase_ID === APP.phaseId);
    const s = r.settings;
    APP.plan = {
      method: h ? h.Payment_Method_Selected : (r.employee.installmentAllowed ? "INSTALLMENT" : "CASH"),
      downType: (h && h.Down_Payment_Type) || "PERCENTAGE",
      down: h ? n(h.Down_Payment_Input) : Math.max(25, n(s.MIN_DOWN_PAYMENT_PCT)),
      count: (h && n(h.Installment_Count)) || n(s.DEFAULT_INSTALLMENT_COUNT) || 2
    };
    if (!r.employee.installmentAllowed && APP.plan.method === "INSTALLMENT") APP.plan.method = "CASH";
  },
  activeItems() { return APP.emp.myReservationItems.filter(i => i.Phase_ID === APP.phaseId && !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward"); },
  phaseItems() { return APP.emp.myReservationItems.filter(i => i.Phase_ID === APP.phaseId); },
  invoice() { return APP.emp.myInvoices.find(i => i.Phase_ID === APP.phaseId); },
  installments() { return APP.emp.myInstallments.filter(i => String(i.Emp_Inv_ID).indexOf("-" + APP.phaseId + "-") > 0).sort((a, b) => String(a.Due_Date).localeCompare(b.Due_Date)); },
  open() { return !!(APP.emp.activePhase && APP.emp.activePhase.Booking_Open); },
  bookMap() { return by(APP.emp.books, "Book_ID"); },
  totals() {
    const m = Emp.bookMap(); let cover = 0, net = 0, count = 0;
    Object.keys(APP.cart).forEach(id => { const b = m[id]; if (b) { cover += n(b.Cover_Price) * APP.cart[id]; net += n(b.Emp_Selling_Price) * APP.cart[id]; count += APP.cart[id]; } });
    return { cover, net, count, m };
  },
  planCalc(total) {
    const p = APP.plan, s = APP.emp.settings;
    if (p.method !== "INSTALLMENT") return { down: total, per: 0, last: 0, cnt: 0, minDown: 0, ok: true };
    const down = p.downType === "PERCENTAGE" ? ceil(total * Math.min(100, Math.max(0, n(p.down))) / 100) : ceil(Math.min(total, Math.max(0, n(p.down))));
    const cnt = Math.max(1, parseInt(p.count, 10) || 1), rem = Math.max(0, total - down), per = Math.floor(rem / cnt), last = r2(rem - per * (cnt - 1));
    const minDown = ceil(total * n(s.MIN_DOWN_PAYMENT_PCT) / 100);
    return { down, per, last, cnt, minDown, ok: down >= minDown };
  },
  daysLeft() {
    const ph = APP.emp.activePhase; if (!ph || !ph.End_DateTime) return null;
    const end = new Date(String(ph.End_DateTime).replace(" ", "T")); if (isNaN(end)) return null;
    return Math.ceil((end - new Date()) / 86400000);
  }
};

// ============================================================ الرئيسية
Router.add("/e/home", view => {
  const r = APP.emp, u = APP.user, ph = r.activePhase;
  const first = String(u.fullName || "").split(" ")[0];
  if (!ph) { view.innerHTML = UI.empty("calendar-clock", "لا توجد مراحل حجز حالياً", "سيظهر هنا موعد الحجز القادم فور فتحه من إدارة المبادرة."); return; }
  const items = Emp.activeItems(), inv = Emp.invoice(), inst = Emp.installments();
  const reqQty = sum(items, "Requested_Qty"), alloc = sum(items, "Allocated_Qty"), deliv = sum(items, "Delivered_Qty");
  const paidPct = inv && n(inv.Net_Final_Invoice_Amount) ? n(inv.Total_Paid_Amount) / n(inv.Net_Final_Invoice_Amount) * 100 : 0;
  const left = Emp.daysLeft();
  const next = inst.find(i => n(i.Remaining_Inst_Amount) > 0);
  const t = Emp.totals();

  // مراحل رحلة الطلب
  const stepIdx = !reqQty ? 0 : !alloc && !inv ? 1 : deliv < alloc ? 2 : inv && n(inv.Remaining_Balance) > 0 ? 3 : 4;
  const steps = [["shopping-bag", "الحجز"], ["truck", "التوريد"], ["list-ordered", "التخصيص"], ["package-check", "الاستلام"], ["circle-check", "السداد"]];
  const journey = `<ol class="flex items-start justify-between relative">${steps.map((s, i) => `<li class="flex-1 flex flex-col items-center text-center relative">
      ${i ? `<span class="absolute top-5 left-1/2 w-full h-0.5 ${i <= stepIdx ? "bg-brand-500" : "bg-slate-200"}" style="z-index:0"></span>` : ""}
      <span class="relative z-[1] w-10 h-10 rounded-full flex items-center justify-center text-[17px] ${i < stepIdx ? "bg-brand-600 text-white" : i === stepIdx ? "bg-gold-400 text-brand-950 ring-4 ring-gold-100" : "bg-slate-100 text-slate-400"}">${ic(i < stepIdx ? "check" : s[0])}</span>
      <span class="mt-2 text-[11.5px] font-semibold ${i <= stepIdx ? "text-slate-800" : "text-slate-400"}">${s[1]}</span></li>`).join("")}</ol>`;

  view.innerHTML = `
  <div class="grid gap-4 lg:gap-6 lg:grid-cols-3">
    <section class="hero text-white rounded-4xl p-5 sm:p-7 relative overflow-hidden lg:col-span-2 shadow-lift">
      <div class="absolute -left-16 -top-16 w-56 h-56 rounded-full bg-white/5"></div><div class="absolute left-10 -bottom-20 w-40 h-40 rounded-full bg-gold-400/10"></div>
      <div class="relative flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="text-brand-200 text-sm">مرحباً،</div>
          <h1 class="text-2xl sm:text-3xl font-bold mt-0.5 truncate">${esc(first)} 👋</h1>
          <div class="text-brand-200/90 text-[13px] mt-1 truncate">${esc(u.department || "")} · رقم ${esc(u.empId)}</div>
          <div class="flex flex-wrap items-center gap-2 mt-4">
            <span class="inline-flex items-center gap-1.5 rounded-full bg-gold-400 text-brand-950 px-3 py-1 text-[13px] font-bold">${ic("badge-percent")} خصم ${fmt(r.settings.UNIFIED_EMP_DISCOUNT_PCT)}%</span>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-[13px] font-semibold">${ic("calendar-range")} ${esc(ph.Phase_Name)}</span>
          </div>
        </div>
        ${inv ? `<div class="relative shrink-0">${UI.donut(paidPct, 112, "مسدد")}</div>` : `<div class="hidden sm:flex shrink-0 w-24 h-24 rounded-3xl bg-white/10 items-center justify-center text-5xl text-gold-300">${ic("library")}</div>`}
      </div>
      <div class="relative mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/10 ring-1 ring-white/10 p-3.5">
        <div class="flex items-center gap-3"><span class="w-10 h-10 rounded-xl ${ph.Booking_Open ? "bg-emerald-400/20 text-emerald-300" : "bg-white/10 text-brand-200"} flex items-center justify-center">${ic(ph.Booking_Open ? "clock" : "lock")}</span>
          <div><div class="font-bold text-[15px]">${ph.Booking_Open ? "الحجز مفتوح الآن" : esc(ar(ph.Effective_Status))}</div>
          <div class="text-[12.5px] text-brand-200">${ph.Booking_Open ? (left !== null ? (left <= 0 ? "ينتهي اليوم" : `يتبقى ${left} يوم · حتى ${esc(day(ph.End_DateTime))}`) : "") : "تابع موقف حجزك من «حجوزاتي»"}</div></div></div>
        <a href="#/e/${ph.Booking_Open ? "books" : "orders"}" class="btn btn-gold btn-sm">${ph.Booking_Open ? (reqQty ? "تعديل الحجز" : "ابدأ الحجز") : "موقف الحجز"} ${ic("chevron-left")}</a>
      </div>
    </section>

    <section class="card card-pad">
      <h2 class="card-title">${ic("wallet", "text-brand-600")} القسط القادم</h2>
      ${next ? `<div class="mt-4 rounded-2xl ${next.Status === "Overdue" ? "bg-rose-50 ring-1 ring-rose-100" : "bg-brand-50"} p-4">
          <div class="text-[13px] ${next.Status === "Overdue" ? "text-rose-700" : "text-brand-700"} font-semibold">${esc(next.Admin_Custom_Notes || "قسط")} · ${next.Status === "Overdue" ? "متأخر" : "يستحق"} ${esc(day(next.Due_Date))}</div>
          <div class="text-3xl font-bold text-slate-900 num mt-1">${money(next.Remaining_Inst_Amount)}</div></div>
          <a href="#/e/pay" class="btn btn-soft w-full mt-3">جدول الأقساط ${ic("chevron-left")}</a>`
        : `<div class="mt-2">${UI.empty("calendar-check", inv ? "لا توجد أقساط مستحقة" : "لا توجد أقساط بعد", inv ? "حسابك منتظم." : "يظهر جدول الأقساط بعد صدور الفاتورة عند التوزيع.")}</div>`}
    </section>
  </div>

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4 lg:mt-6">
    ${UI.kpi("نسخ محجوزة", fmt(reqQty), { icon: "book-open", tone: "brand", foot: Emp.dirty ? "لديك تعديلات غير محفوظة" : "" })}
    ${UI.kpi("مخصص لك", fmt(alloc) + (reqQty ? ` <span class="text-sm text-slate-400">/ ${fmt(reqQty)}</span>` : ""), { icon: "list-ordered", tone: "green", pct: reqQty ? alloc / reqQty * 100 : 0 })}
    ${UI.kpi("قيمة الفاتورة", inv ? money(inv.Net_Final_Invoice_Amount) : money(t.net), { icon: "receipt", tone: "blue", foot: inv ? `وفّرت ${moneyTxt(inv.Total_Savings)}` : t.cover ? `توفير متوقع ${moneyTxt(t.cover - t.net)}` : "" })}
    ${UI.kpi("المتبقي عليك", inv ? money(inv.Remaining_Balance) : money(0), { icon: "hand-coins", tone: inv && n(inv.Remaining_Balance) ? "amber" : "green", foot: inv && n(inv.Credit_Balance) ? `لك رصيد ${moneyTxt(inv.Credit_Balance)}` : "" })}
  </div>

  <div class="grid gap-4 lg:gap-6 lg:grid-cols-3 mt-4 lg:mt-6">
    <section class="card card-pad lg:col-span-2"><h2 class="card-title mb-5">${ic("sparkles", "text-gold-500")} رحلة طلبك</h2>${journey}</section>
    <section class="card card-pad">
      <h2 class="card-title">${ic("smartphone", "text-brand-600")} وسائل السداد</h2>
      <ul class="mt-3 space-y-2.5 text-[13.5px] text-slate-600">
        <li class="flex gap-2.5">${ic("banknote", "text-emerald-600 mt-0.5")}نقداً لأمين الصندوق مقابل إيصال</li>
        <li class="flex gap-2.5">${ic("smartphone", "text-sky-600 mt-0.5")}محفظة إلكترونية أو إنستاباي باسم <b class="text-slate-800">${esc(r.settings.CASH_ACCOUNT_HOLDER || "")}</b></li>
        <li class="flex gap-2.5">${ic("info", "text-amber-500 mt-0.5")}احتفظ برقم التحويل وأرسله لأمين الصندوق</li>
      </ul>
    </section>
  </div>`;
});

// ============================================================ الكتالوج والسلة
function bookCard(b) {
  const q = APP.cart[b.Book_ID] || 0, open = Emp.open(), [c1, c2] = toneOf(b.Subject);
  const save = n(b.Cover_Price) ? Math.round((1 - n(b.Emp_Selling_Price) / n(b.Cover_Price)) * 100) : 0;
  const mx = n(APP.emp.settings.MAX_QTY_PER_BOOK) || 3;
  return `<article class="card p-3 flex gap-3 sm:flex-col sm:p-0 sm:overflow-hidden ${q ? "ring-2 ring-brand-400" : ""}" id="bk_${esc(b.Book_ID)}">
    <div class="shrink-0 w-[76px] sm:w-full h-[100px] sm:h-28 rounded-xl sm:rounded-none flex flex-col justify-between p-2.5 text-white relative overflow-hidden" style="background:linear-gradient(140deg,${c1},${c2})">
      <span class="absolute -left-4 -bottom-6 text-[86px] opacity-15">${ic("book-open")}</span>
      <span class="text-[10.5px] font-bold bg-white/20 rounded-md px-1.5 py-0.5 self-start backdrop-blur">${esc(b.Subject || "")}</span>
      <span class="text-[22px] opacity-90">${ic("book-open")}</span>
    </div>
    <div class="flex-1 min-w-0 flex flex-col sm:p-3.5 sm:pt-3">
      <h3 class="font-bold text-slate-900 leading-snug text-[14.5px] line-clamp-2">${esc(b.Book_Name)}</h3>
      <div class="text-[12px] text-slate-500 mt-0.5">${esc(b.Grade || "")} <span class="text-slate-300">·</span> <span class="num text-slate-400">${esc(b.Book_ID)}</span></div>
      <div class="flex flex-wrap gap-1 mt-1.5">${b.Book_Status === "Not_Yet_Printed" ? pill("Not_Yet_Printed") : ""}${n(b.In_Stock_From_Previous) > 0 ? pill("", "متوفر بالمخزن", "blue") : ""}</div>
      <div class="mt-auto pt-2 flex items-end justify-between gap-2">
        <div><div class="text-[11px] text-slate-400 line-through num">${fmt(b.Cover_Price)}</div>
          <div class="flex items-center gap-1.5"><span class="text-lg font-bold text-brand-800 num">${fmt(b.Emp_Selling_Price)}</span><span class="text-[11px] text-slate-500">ج.م</span>${save > 0 ? `<span class="pill pill-green !px-1.5">-${save}%</span>` : ""}</div></div>
        ${q ? `<div class="stepper"><button data-act="cartInc" data-id="${esc(b.Book_ID)}" ${!open || q >= mx ? "disabled" : ""} aria-label="زيادة">${ic("plus")}</button><span>${q}</span><button data-act="cartDec" data-id="${esc(b.Book_ID)}" ${open ? "" : "disabled"} aria-label="تقليل">${ic(q === 1 ? "trash-2" : "minus")}</button></div>`
          : `<button class="btn btn-soft btn-sm" data-act="cartInc" data-id="${esc(b.Book_ID)}" ${open ? "" : "disabled"}>${ic("plus")} أضف</button>`}
      </div>
    </div></article>`;
}
function cartHTML() {
  const t = Emp.totals(), open = Emp.open(), p = APP.plan, s = APP.emp.settings, pc = Emp.planCalc(t.net);
  const hadRes = Emp.activeItems().length > 0;
  const methods = [["INSTALLMENT", "calendar-check", "تقسيط", "مقدم + أقساط شهرية"], ["CASH", "banknote", "نقداً", "كامل القيمة عند الاستلام"], ["INSTAPAY", "send", "إنستاباي", "تحويل كامل القيمة"], ["WALLET", "smartphone", "محفظة", "تحويل كامل القيمة"]];
  const ids = Object.keys(APP.cart);
  return `
  ${ids.length ? `<ul class="divide-y divide-slate-100 -my-1">${ids.map(id => { const b = t.m[id]; if (!b) return ""; return `<li class="flex items-center gap-3 py-2.5">
      <div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px] text-slate-800 truncate">${esc(b.Book_Name)}</div><div class="text-[12px] text-slate-500 num">${fmt(b.Emp_Selling_Price)} × ${APP.cart[id]} = <b class="text-slate-700">${fmt(n(b.Emp_Selling_Price) * APP.cart[id])}</b></div></div>
      ${open ? `<div class="stepper scale-90 origin-left"><button data-act="cartInc" data-id="${esc(id)}" ${APP.cart[id] >= (n(s.MAX_QTY_PER_BOOK) || 3) ? "disabled" : ""}>${ic("plus")}</button><span>${APP.cart[id]}</span><button data-act="cartDec" data-id="${esc(id)}">${ic(APP.cart[id] === 1 ? "trash-2" : "minus")}</button></div>` : `<span class="font-bold num">${APP.cart[id]}</span>`}
    </li>`; }).join("")}</ul>`
    : `<div class="text-center py-6 text-slate-400 text-sm">${ic("shopping-bag", "text-3xl mx-auto mb-2 block")}لم تضف كتباً بعد</div>`}

  <div class="rounded-2xl bg-slate-50 p-3.5 mt-3 space-y-1.5 text-[13.5px]">
    <div class="flex justify-between text-slate-500"><span>بسعر الغلاف</span><span class="line-through num">${moneyTxt(t.cover)}</span></div>
    <div class="flex justify-between text-emerald-600 font-semibold"><span>توفيرك</span><span class="num">${moneyTxt(t.cover - t.net)}</span></div>
    <div class="flex justify-between items-baseline pt-1.5 border-t border-slate-200"><span class="font-bold text-slate-900">الإجمالي</span><span class="text-xl font-bold text-brand-800 num">${money(t.net)}</span></div>
  </div>

  <div class="mt-4"><div class="label">طريقة السداد</div>
    <div class="grid grid-cols-2 gap-2">${methods.map(m => { const dis = m[0] === "INSTALLMENT" && !APP.emp.employee.installmentAllowed; const sel = p.method === m[0];
      return `<button data-act="planMethod" data-id="${m[0]}" ${dis || !open ? "disabled" : ""} class="text-right rounded-2xl p-3 ring-1 transition disabled:opacity-40 ${sel ? "ring-2 ring-brand-600 bg-brand-50" : "ring-slate-200 hover:bg-slate-50"}">
        <div class="flex items-center gap-2 font-bold text-[13.5px] ${sel ? "text-brand-800" : "text-slate-800"}">${ic(m[1])}${m[2]}${sel ? ic("circle-check", "mr-auto text-brand-600") : ""}</div><div class="text-[11px] text-slate-500 mt-0.5">${dis ? "غير متاح لحسابك" : m[3]}</div></button>`; }).join("")}</div></div>

  ${p.method === "INSTALLMENT" ? `<div class="mt-4 rounded-2xl ring-1 ring-slate-200 p-3.5 space-y-3">
    <div class="grid grid-cols-2 gap-3">
      <div><div class="label">المقدم</div><div class="seg grid-cols-2"><button data-act="planDownType" data-id="PERCENTAGE" aria-pressed="${p.downType === "PERCENTAGE"}" ${open ? "" : "disabled"}>نسبة %</button><button data-act="planDownType" data-id="FIXED" aria-pressed="${p.downType === "FIXED"}" ${open ? "" : "disabled"}>مبلغ</button></div></div>
      <div><label class="label" for="planDown">${p.downType === "PERCENTAGE" ? "النسبة %" : "المبلغ ج.م"}</label><input id="planDown" type="number" inputmode="decimal" class="input input-sm !h-[44px] num" value="${esc(p.down)}" data-input="planDown" ${open ? "" : "disabled"}></div>
    </div>
    <div><div class="label">عدد الأقساط الشهرية</div><div class="flex flex-wrap gap-2">${Array.from({ length: n(s.MAX_INSTALLMENT_COUNT) || 4 }, (_, i) => i + 1).map(c => `<button class="chip !h-9 !w-11 justify-center" data-act="planCount" data-id="${c}" aria-pressed="${n(p.count) === c}" ${open ? "" : "disabled"}>${c}</button>`).join("")}</div></div>
    <div class="plan-preview">${planPreview(pc)}</div>
  </div>` : `<div class="mt-3 text-[12.5px] text-slate-500 flex gap-2">${ic("info", "text-brand-500 mt-0.5")}<span>يُسدَّد كامل المبلغ عند استلام الكتب${p.method !== "CASH" ? ` عبر ${ar(p.method)} باسم <b>${esc(s.CASH_ACCOUNT_HOLDER || "")}</b>` : ""}.</span></div>`}

  ${open ? `<button data-act="submitRes" class="btn btn-primary btn-lg w-full mt-4" ${!ids.length && !hadRes ? "disabled" : ""}>${ic(ids.length ? "check-check" : "ban")} ${ids.length ? (hadRes ? "حفظ تعديل الحجز" : "تأكيد الحجز") : "إلغاء حجزي في المرحلة"}</button>
    <p class="text-[11.5px] text-slate-400 mt-2.5 leading-relaxed">${ic("info", "inline -mt-0.5")} الأسبقية تُحسب لكل نسخة بوقت حجزها؛ زيادة الكمية لا تؤخر نسخك السابقة، والتخفيض يحذف أحدث نسخة أولاً.</p>`
    : `<div class="mt-4 rounded-2xl bg-amber-50 text-amber-800 text-sm p-3.5 flex gap-2">${ic("lock", "mt-0.5")}الحجز مغلق في هذه المرحلة.</div>`}`;
}
function planPreview(pc) {
  const rows = [["عند الاستلام", "مقدم", pc.down]];
  for (let i = 1; i <= pc.cnt; i++) rows.push([`الشهر ${i}`, `قسط ${i}`, i === pc.cnt ? pc.last : pc.per]);
  return `<ol class="space-y-0">${rows.map((r, i) => `<li class="flex items-center gap-3 relative py-1.5">
      ${i < rows.length - 1 ? `<span class="absolute right-[11px] top-7 bottom-[-6px] w-0.5 bg-brand-100"></span>` : ""}
      <span class="relative z-[1] w-6 h-6 rounded-full ${i ? "bg-brand-100 text-brand-700" : "bg-brand-700 text-white"} text-[11px] font-bold flex items-center justify-center">${i || ic("package-check", "text-[12px]")}</span>
      <span class="flex-1 text-[13px] text-slate-600">${r[1]} <span class="text-slate-400">· ${r[0]}</span></span><span class="font-bold num text-slate-900 text-[14px]">${moneyTxt(r[2])}</span></li>`).join("")}</ol>
    ${!pc.ok ? `<div class="mt-2 rounded-xl bg-rose-50 text-rose-700 text-[12.5px] px-3 py-2 flex gap-2">${ic("circle-alert", "mt-0.5")}أقل مقدم مسموح ${moneyTxt(pc.minDown)} (${fmt(APP.emp.settings.MIN_DOWN_PAYMENT_PCT)}%)</div>` : ""}`;
}
function refreshCartViews() {
  const t = Emp.totals();
  $$(".cart-body").forEach(el => el.innerHTML = cartHTML());
  const bar = $("#cartBar");
  if (bar) {
    bar.classList.toggle("hidden", !t.count && !Emp.activeItems().length);
    bar.innerHTML = `<button data-act="openCart" class="w-full flex items-center gap-3 rounded-2xl bg-brand-800 text-white px-4 py-3 shadow-glow active:scale-[.98] transition">
      <span class="relative w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-lg">${ic("shopping-bag")}<span class="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1 rounded-full bg-gold-400 text-brand-950 text-[11px] font-bold flex items-center justify-center num">${t.count}</span></span>
      <span class="flex-1 text-right"><span class="block text-[12px] text-brand-200">${Emp.dirty ? "تعديلات غير محفوظة" : "حجزك الحالي"}</span><span class="block font-bold num">${moneyTxt(t.net)}</span></span>
      <span class="font-semibold text-[14px] flex items-center gap-1">مراجعة الحجز ${ic("chevron-left")}</span></button>`;
  }
  const hc = $("#cartCount"); if (hc) hc.textContent = t.count;
}
function renderBookGrid() {
  const r = APP.emp, f = Emp.filter;
  const list = r.books.filter(b => (!f.stage || b.Stage === f.stage) && (!f.grade || b.Grade === f.grade) && (!f.q || (b.Book_Name + " " + b.Subject + " " + b.Book_ID + " " + b.Grade).toLowerCase().includes(f.q.toLowerCase())));
  $("#bookGrid").innerHTML = list.length ? list.map(bookCard).join("") : `<div class="col-span-full">${UI.empty("search", "لا توجد كتب مطابقة", "جرّب تغيير المرحلة الدراسية أو كلمة البحث.")}</div>`;
  $("#bookCount").textContent = list.length + " كتاب";
}
Router.add("/e/books", view => {
  const r = APP.emp, f = Emp.filter;
  if (!r.activePhase) { view.innerHTML = UI.empty("calendar-clock", "لا توجد مرحلة حجز", "سيظهر الكتالوج عند فتح مرحلة حجز جديدة."); return; }
  const stages = uniq(r.books.map(b => b.Stage)).filter(Boolean);
  const grades = uniq(r.books.filter(b => !f.stage || b.Stage === f.stage).map(b => b.Grade)).filter(Boolean);
  view.innerHTML = `
  <div class="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 items-start">
    <div>
      ${!Emp.open() ? `<div class="rounded-2xl bg-amber-50 ring-1 ring-amber-200 text-amber-900 p-4 mb-4 flex gap-3 text-sm">${ic("lock", "text-lg mt-0.5")}<div><b>الحجز ${esc(ar(r.activePhase.Effective_Status))}</b> — يمكنك تصفح الكتالوج، والتعديل متاح فقط أثناء فترة الحجز.</div></div>` : ""}
      <div class="sticky top-16 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 pt-1 pb-3 bg-slate-50/90 backdrop-blur-xl">
        <div class="input-icon">${ic("search")}<input class="input !h-12 !rounded-2xl shadow-soft !ring-slate-200/80" placeholder="ابحث باسم الكتاب أو المادة أو الصف" value="${esc(f.q)}" data-input="bookSearch" type="search"></div>
        <div class="scroll-x mt-3"><button class="chip" data-act="fStage" data-id="" aria-pressed="${!f.stage}">${ic("layout-grid")} الكل</button>${stages.map(s => `<button class="chip" data-act="fStage" data-id="${esc(s)}" aria-pressed="${f.stage === s}">${ic("graduation-cap")} ${esc(s)}</button>`).join("")}</div>
        ${f.stage && grades.length > 1 ? `<div class="scroll-x mt-2"><button class="chip !h-8 !text-xs" data-act="fGrade" data-id="" aria-pressed="${!f.grade}">كل الصفوف</button>${grades.map(g => `<button class="chip !h-8 !text-xs" data-act="fGrade" data-id="${esc(g)}" aria-pressed="${f.grade === g}">${esc(g)}</button>`).join("")}</div>` : ""}
      </div>
      <div class="flex items-center justify-between mb-3 mt-1"><span id="bookCount" class="text-sm text-slate-500"></span><span class="text-xs text-slate-400">الحد الأقصى ${fmt(r.settings.MAX_QTY_PER_BOOK || 3)} نسخ لكل كتاب</span></div>
      <div id="bookGrid" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"></div>
    </div>
    <aside class="hidden lg:block sticky top-24">
      <section class="card">
        <div class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100"><h2 class="card-title">${ic("shopping-bag", "text-brand-600")} استمارة الحجز</h2><span class="pill pill-brand"><span id="cartCount">0</span> نسخة</span></div>
        <div class="cart-body px-5 py-4 max-h-[calc(100dvh-12rem)] overflow-y-auto"></div>
      </section>
    </aside>
  </div>
  <div id="cartBar" class="lg:hidden fixed inset-x-3 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] md:bottom-4 z-30 hidden animate-pop-in"></div>`;
  renderBookGrid(); refreshCartViews();
});

on("bookSearch", v => { Emp.filter.q = v.trim(); renderBookGrid(); });
on("fStage", v => { Emp.filter.stage = v; Emp.filter.grade = ""; Shell.rerender(); });
on("fGrade", v => { Emp.filter.grade = v; Shell.rerender(); });
function cartChanged(id) {
  Emp.dirty = true;
  const b = APP.emp.books.find(x => x.Book_ID === id);
  const card = $("#bk_" + CSS.escape(id));
  if (card && b) card.outerHTML = bookCard(b);
  refreshCartViews();
}
on("cartInc", id => {
  const mx = n(APP.emp.settings.MAX_QTY_PER_BOOK) || 3;
  if ((APP.cart[id] || 0) >= mx) return toast("الحد الأقصى " + mx + " نسخ من الكتاب", "warning");
  APP.cart[id] = (APP.cart[id] || 0) + 1;
  if (navigator.vibrate) navigator.vibrate(8);
  cartChanged(id);
});
on("cartDec", id => { APP.cart[id] = (APP.cart[id] || 0) - 1; if (APP.cart[id] <= 0) delete APP.cart[id]; cartChanged(id); });
on("planMethod", v => { APP.plan.method = v; Emp.dirty = true; refreshCartViews(); });
on("planDownType", v => { APP.plan.downType = v; APP.plan.down = v === "PERCENTAGE" ? Math.max(25, n(APP.emp.settings.MIN_DOWN_PAYMENT_PCT)) : ceil(Emp.planCalc(Emp.totals().net).minDown); Emp.dirty = true; refreshCartViews(); });
on("planCount", v => { APP.plan.count = n(v); Emp.dirty = true; refreshCartViews(); });
on("planDown", v => { APP.plan.down = v; Emp.dirty = true; const html = planPreview(Emp.planCalc(Emp.totals().net)); $$(".plan-preview").forEach(el => el.innerHTML = html); });
on("openCart", () => {
  const m = UI.open(`<div class="cart-body"></div>`, { title: "استمارة الحجز", sub: APP.emp.activePhase.Phase_Name, onClose: () => refreshCartViews() });
  m.body.querySelector(".cart-body").innerHTML = cartHTML();
  Emp._cartSheet = m;
});
on("submitRes", async () => {
  const items = Object.keys(APP.cart).map(id => ({ bookId: id, qty: APP.cart[id] }));
  const t = Emp.totals(), pc = Emp.planCalc(t.net);
  if (APP.plan.method === "INSTALLMENT" && items.length && !pc.ok) return toast(`أقل مقدم مسموح ${moneyTxt(pc.minDown)}`, "warning");
  if (!items.length && !(await UI.confirm({ title: "إلغاء الحجز", message: "الاستمارة فارغة، وسيتم إلغاء حجزك في هذه المرحلة بالكامل. متابعة؟", tone: "danger", ok: "إلغاء الحجز" }))) return;
  const r = await call("SUBMIT_OR_UPDATE_RESERVATION", { phaseId: APP.phaseId, items, paymentMethod: APP.plan.method, downPaymentType: APP.plan.downType, downPaymentInput: n(APP.plan.down), installmentCount: APP.plan.count }, { block: true });
  if (!r.success) return toast(r.message, "danger");
  Emp.dirty = false;
  if (Emp._cartSheet) { Emp._cartSheet.close(); Emp._cartSheet = null; }
  (r.warnings || []).forEach(w => toast(w, "warning"));
  await Emp.load();
  UI.open(`<div class="text-center py-2"><div class="w-20 h-20 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-4xl animate-pop-in">${ic("circle-check")}</div>
    <h3 class="text-xl font-bold text-slate-900 mt-4">${items.length ? "تم حفظ حجزك" : "تم إلغاء الحجز"}</h3><p class="text-sm text-slate-500 mt-2 leading-relaxed">${esc(r.message || "")}</p>
    ${items.length ? `<div class="grid grid-cols-2 gap-2 mt-5 text-right">${UI.stat("عدد النسخ", fmt(t.count))}${UI.stat("الإجمالي", money(t.net))}</div>` : ""}</div>`,
    { footer: `<div class="flex gap-2"><a href="#/e/orders" data-act="goClose" data-id="/e/orders" class="btn btn-primary flex-1">متابعة حجوزاتي</a><button data-close class="btn btn-outline">تم</button></div>` });
});

// ============================================================ حجوزاتي
Router.add("/e/orders", view => {
  const r = APP.emp, items = Emp.phaseItems(), inv = Emp.invoice(), bm = Emp.bookMap();
  if (!r.activePhase) { view.innerHTML = UI.empty("package", "لا توجد حجوزات"); return; }
  const paidPct = inv && n(inv.Net_Final_Invoice_Amount) ? n(inv.Total_Paid_Amount) / n(inv.Net_Final_Invoice_Amount) * 100 : 0;
  view.innerHTML = `
  ${UI.pageHead("حجوزاتي", esc(r.activePhase.Phase_Name), inv ? `<button class="btn btn-outline btn-sm" data-act="printInv">${ic("printer")} طباعة الفاتورة</button>` : "")}
  <div class="grid gap-4 lg:gap-6 lg:grid-cols-[1fr_360px] items-start">
    <div class="space-y-3">
      ${items.length ? items.map(i => {
        const req = n(i.Requested_Qty), al = n(i.Allocated_Qty), dl = n(i.Delivered_Qty), b = bm[i.Book_ID] || {}, [c1, c2] = toneOf(b.Subject);
        return `<article class="card p-4">
          <div class="flex items-start gap-3">
            <div class="w-11 h-14 rounded-lg shrink-0 flex items-center justify-center text-white text-lg" style="background:linear-gradient(140deg,${c1},${c2})">${ic("book-open")}</div>
            <div class="flex-1 min-w-0"><div class="flex items-start justify-between gap-2"><h3 class="font-bold text-slate-900 leading-snug">${esc(b.Book_Name || i.Book_ID)}</h3>${pill(i.Allocation_Status)}</div>
              <div class="text-[12px] text-slate-500 mt-0.5">${esc(b.Grade || "")} · ${fmt(i.Unit_Emp_Price)} ج.م للنسخة · شريحة ${esc(i.Tranche_No || 1)}</div>
              <div class="text-[11.5px] text-slate-400 mt-0.5 flex items-center gap-1">${ic("clock")} أسبقية <span dir="ltr" class="num">${esc(i.Priority_Timestamp)}</span></div></div>
          </div>
          <div class="grid grid-cols-4 gap-2 mt-3.5 text-center">${[["محجوز", req, "text-slate-800"], ["مخصص", al, "text-brand-700"], ["مُستلم", dl, "text-emerald-600"], ["مرتجع", n(i.Returned_Qty), "text-slate-500"]].map(x => `<div class="rounded-xl bg-slate-50 py-2"><div class="text-[11px] text-slate-500">${x[0]}</div><div class="font-bold num ${x[2]}">${x[1]}</div></div>`).join("")}</div>
          ${req ? `<div class="mt-3">${UI.progress(Math.max(al, dl) / req * 100, dl >= req ? "bg-emerald-500" : "bg-brand-600")}</div>` : ""}
          ${i.Unallocated_Reason ? `<div class="mt-2.5 text-[12px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 flex gap-1.5">${ic("info", "mt-0.5")}${esc(i.Unallocated_Reason)}</div>` : ""}
        </article>`;
      }).join("") : `<div class="card">${UI.empty("shopping-bag", "لم تحجز كتباً في هذه المرحلة", Emp.open() ? "تصفح الكتالوج وأضف كتب أبنائك." : "", Emp.open() ? `<a href="#/e/books" class="btn btn-primary mt-5">${ic("library")} تصفح الكتب</a>` : "")}</div>`}
    </div>
    <aside class="space-y-4 lg:sticky lg:top-24">
      ${inv ? `<section class="card overflow-hidden">
        <div class="hero text-white p-5"><div class="text-brand-200 text-sm">صافي فاتورتك</div><div class="text-3xl font-bold num mt-1">${money(inv.Net_Final_Invoice_Amount)}</div>
          <div class="mt-3">${UI.progress(paidPct, "bg-gold-400")}</div><div class="flex justify-between text-[12px] text-brand-200 mt-1.5"><span>مسدد ${moneyTxt(inv.Total_Paid_Amount)}</span><span>${Math.round(paidPct)}%</span></div></div>
        <div class="p-4 grid grid-cols-2 gap-2">${UI.stat("بسعر الغلاف", `<span class="line-through text-slate-400">${fmt(inv.Total_Cover_Amount)}</span>`)}${UI.stat("وفّرت", `<span class="text-emerald-600">${moneyTxt(inv.Total_Savings)}</span>`)}${UI.stat("المقدم المطلوب", moneyTxt(inv.Down_Payment_Required))}${UI.stat("المتبقي", `<span class="${n(inv.Remaining_Balance) ? "text-rose-600" : "text-emerald-600"}">${moneyTxt(inv.Remaining_Balance)}</span>`)}
          ${n(inv.Credit_Balance) ? `<div class="col-span-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm p-3 font-semibold">لك رصيد مستحق الرد ${moneyTxt(inv.Credit_Balance)}</div>` : ""}</div>
        <div class="px-4 pb-4 flex items-center justify-between text-[12px] text-slate-500"><span>${esc(inv.Emp_Inv_ID)}</span>${pill(inv.Invoice_Status)}</div></section>`
        : `<section class="card card-pad"><div class="flex gap-3"><span class="w-11 h-11 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center text-xl shrink-0">${ic("receipt")}</span><div><div class="font-bold text-slate-900">الفاتورة لم تصدر بعد</div><p class="text-[13px] text-slate-500 mt-1 leading-relaxed">تصدر بعد وصول الكتب من المكتبة وتوزيعها حسب أسبقية الحجز، ويُحسب جدول الأقساط من تاريخ التسليم.</p></div></div></section>`}
    </aside>
  </div>`;
});
on("printInv", () => {
  const inv = Emp.invoice(), bm = Emp.bookMap(), u = APP.user;
  const rows = Emp.phaseItems().filter(i => n(i.Allocated_Qty) || n(i.Delivered_Qty));
  openPrint("فاتورة كتب", `<h1>فاتورة كتب — ${esc(u.fullName)} (${esc(u.empId)})</h1><p>${esc(APP.emp.activePhase.Phase_Name)} · ${esc(inv.Emp_Inv_ID)}</p>
    <table><tr><th>الكتاب</th><th>مخصص</th><th>مستلم</th><th>سعر النسخة</th><th>القيمة</th></tr>${rows.map(i => `<tr><td>${esc((bm[i.Book_ID] || {}).Book_Name || i.Book_ID)}</td><td>${i.Allocated_Qty}</td><td>${i.Delivered_Qty}</td><td>${fmt(i.Unit_Emp_Price)}</td><td>${fmt(n(i.Allocated_Qty) * n(i.Unit_Emp_Price))}</td></tr>`).join("")}</table>
    <table><tr><th>بسعر الغلاف</th><td>${moneyTxt(inv.Total_Cover_Amount)}</td><th>التوفير</th><td>${moneyTxt(inv.Total_Savings)}</td></tr><tr><th>الصافي</th><td><b>${moneyTxt(inv.Net_Final_Invoice_Amount)}</b></td><th>المسدد</th><td>${moneyTxt(inv.Total_Paid_Amount)}</td></tr><tr><th>المتبقي</th><td colspan="3"><b>${moneyTxt(inv.Remaining_Balance)}</b></td></tr></table>`);
});

// ============================================================ مدفوعاتي
Router.add("/e/pay", view => {
  const r = APP.emp, inst = Emp.installments(), inv = Emp.invoice();
  const pays = r.myPayments.slice().reverse();
  const remaining = sum(inst, "Remaining_Inst_Amount"), overdue = sum(inst.filter(i => i.Status === "Overdue"), "Remaining_Inst_Amount");
  view.innerHTML = `
  ${UI.pageHead("مدفوعاتي", "جدول الأقساط وإيصالات السداد")}
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
    ${UI.kpi("صافي الفاتورة", money(inv ? inv.Net_Final_Invoice_Amount : 0), { icon: "receipt", tone: "brand" })}
    ${UI.kpi("المسدد", money(inv ? inv.Total_Paid_Amount : 0), { icon: "circle-check", tone: "green" })}
    ${UI.kpi("المتبقي", money(inv ? inv.Remaining_Balance : remaining), { icon: "hourglass", tone: "amber" })}
    ${UI.kpi("متأخرات", money(overdue), { icon: "triangle-alert", tone: overdue ? "red" : "gray" })}
  </div>
  <div class="grid gap-4 lg:gap-6 lg:grid-cols-2 items-start">
    ${UI.section(`${ic("calendar-check", "text-brand-600")} جدول الأقساط`, "", inst.length ? `<ol class="relative">${inst.map((s, i) => {
      const st = s.Status === "Scheduled" ? (n(s.Remaining_Inst_Amount) ? "Scheduled" : "Paid") : s.Status;
      const dot = st === "Paid" ? "bg-emerald-500 text-white" : st === "Overdue" ? "bg-rose-500 text-white" : st === "Partial" ? "bg-amber-400 text-white" : "bg-white ring-2 ring-slate-200 text-slate-400";
      return `<li class="flex gap-3 pb-4 relative">${i < inst.length - 1 ? `<span class="absolute right-[15px] top-8 bottom-0 w-0.5 bg-slate-100"></span>` : ""}
        <span class="relative z-[1] w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${dot}">${st === "Paid" ? ic("check") : i + 1}</span>
        <div class="flex-1 rounded-2xl bg-slate-50 p-3"><div class="flex items-center justify-between gap-2"><span class="font-bold text-slate-800 text-[14px]">${esc(s.Admin_Custom_Notes || "قسط " + (i + 1))}</span>${pill(st, st === "Scheduled" ? "مجدول" : null)}</div>
          <div class="flex items-center justify-between mt-1.5 text-[13px]"><span class="text-slate-500 flex items-center gap-1">${ic("calendar-range")} ${esc(day(s.Due_Date))}</span><span class="num"><b class="text-slate-900">${fmt(s.Scheduled_Amount)}</b>${n(s.Paid_Amount) ? ` <span class="text-emerald-600 text-xs">(مسدد ${fmt(s.Paid_Amount)})</span>` : ""}</span></div></div></li>`;
    }).join("")}</ol>` : UI.empty("calendar-clock", "لا يوجد جدول أقساط بعد", "يُنشأ الجدول تلقائياً بعد صدور الفاتورة."))}
    ${UI.section(`${ic("receipt", "text-brand-600")} إيصالات السداد`, "", pays.length ? `<ul class="space-y-2.5">${pays.map(p => `<li class="flex items-center gap-3 rounded-2xl ring-1 ring-slate-100 p-3 ${isTrue(p.Is_Voided) ? "opacity-50" : ""}">
        <span class="w-11 h-11 rounded-xl ${n(p.Amount) < 0 ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600"} flex items-center justify-center text-lg">${ic(p.Payment_Method === "CASH" ? "banknote" : p.Payment_Method === "PAYROLL" ? "building-2" : "smartphone")}</span>
        <div class="flex-1 min-w-0"><div class="font-semibold text-slate-800 text-[14px]">${n(p.Amount) < 0 ? "رد رصيد" : "سداد"} · ${esc(ar(p.Payment_Method))}</div><div class="text-[11.5px] text-slate-400 num">${esc(p.Receipt_No)} · ${esc(dt(p.Payment_Date))}${isTrue(p.Is_Voided) ? " · ملغى" : ""}</div></div>
        <div class="font-bold num ${n(p.Amount) < 0 ? "text-sky-600" : "text-slate-900"}">${fmt(Math.abs(n(p.Amount)))}</div></li>`).join("")}</ul>` : UI.empty("wallet", "لا توجد مدفوعات بعد"))}
  </div>`;
});

// ============================================================ حسابي
Router.add("/e/me", view => {
  const r = APP.emp, u = APP.user;
  view.innerHTML = `
  <div class="max-w-2xl mx-auto space-y-4">
    <section class="hero rounded-4xl text-white p-6 flex items-center gap-4 shadow-lift">${UI.avatar(u.fullName, "w-16 h-16 text-xl")}
      <div class="min-w-0"><h1 class="text-xl font-bold truncate">${esc(u.fullName)}</h1><div class="text-brand-200 text-sm mt-0.5">رقم وظيفي ${esc(u.empId)}</div></div></section>
    <section class="card divide-y divide-slate-100">
      ${[["building-2", "الإدارة", u.department || "—"], ["calendar-check", "التقسيط", r.employee.installmentAllowed ? "مسموح" : "غير مسموح"], ["scale", "الحد الائتماني", moneyTxt(r.employee.creditLimit)], ["badge-percent", "خصم العاملين", fmt(r.settings.UNIFIED_EMP_DISCOUNT_PCT) + "%"], ["smartphone", "حساب التحويل", r.settings.CASH_ACCOUNT_HOLDER || "—"]]
        .map(x => `<div class="flex items-center gap-3 px-4 py-3.5"><span class="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center">${ic(x[0])}</span><span class="flex-1 text-slate-600 text-[14px]">${x[1]}</span><span class="font-semibold text-slate-900 text-[14px]">${esc(x[2])}</span></div>`).join("")}
    </section>
    <section class="card divide-y divide-slate-100">
      <button data-act="pickPhase" class="w-full flex items-center gap-3 px-4 py-3.5 text-right"><span class="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">${ic("calendar-range")}</span><span class="flex-1 font-semibold">تغيير المرحلة</span>${ic("chevron-left", "text-slate-400")}</button>
      <button data-act="installApp" class="w-full flex items-center gap-3 px-4 py-3.5 text-right"><span class="w-10 h-10 rounded-xl bg-gold-50 text-gold-600 flex items-center justify-center">${ic("smartphone")}</span><span class="flex-1 font-semibold">تثبيت كتطبيق على الموبايل</span>${ic("chevron-left", "text-slate-400")}</button>
      <button data-act="logout" class="w-full flex items-center gap-3 px-4 py-3.5 text-right text-rose-600"><span class="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">${ic("log-out")}</span><span class="flex-1 font-semibold">تسجيل الخروج</span></button>
    </section>
  </div>`;
});
