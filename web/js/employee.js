/* ============================================================================
 * بوابة الموظف: الرئيسية، الكتالوج والسلة، حجوزاتي، مدفوعاتي، حسابي
 * ========================================================================== */
"use strict";
const SUBJECT_TONES = [["#7c4bb6", "#46256b"], ["#0ea5e9", "#0369a1"], ["#10b981", "#047857"], ["#f59e0b", "#b45309"], ["#f43f5e", "#be123c"], ["#6366f1", "#4338ca"], ["#14b8a6", "#0f766e"], ["#a855f7", "#7e22ce"]];
// مفتاح السلة = كود الكتاب|المستفيد
const ck = (bookId, ben) => bookId + "|" + (ben || "");
const bk = key => String(key).split("|")[0], bn = key => String(key).split("|")[1] || "";
const relOn = () => !!(APP.emp && APP.emp.settings && APP.emp.settings.ALLOW_RELATIVE_BOOKING);
const toneOf = s => { let h = 0; String(s || "").split("").forEach(c => h = (h * 31 + c.charCodeAt(0)) >>> 0); return SUBJECT_TONES[h % SUBJECT_TONES.length]; };

const Emp = {
  filter: { stage: "", grade: "", type: "", subject: "", q: "" },
  ben: "", bens: [],   // المستفيد الحالي ("" = العضو وأبناؤه) وقائمة الأقارب
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
    Emp.activeItems().forEach(i => { const k = ck(i.Book_ID, i.Beneficiary); APP.cart[k] = (APP.cart[k] || 0) + n(i.Requested_Qty); });
    Emp.bens = [...new Set(Emp.activeItems().map(i => i.Beneficiary).filter(Boolean))];
    if (Emp.ben && !Emp.bens.includes(Emp.ben)) Emp.ben = "";
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
    Object.keys(APP.cart).forEach(id => { const b = m[bk(id)]; if (b) { cover += n(b.Cover_Price) * APP.cart[id]; net += n(b.Emp_Selling_Price) * APP.cart[id]; count += APP.cart[id]; } });
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
// ============================================================ حالة الكتاب بلغة بسيطة
// التسلسل: تم الحجز ← جاري التجهيز ← جاري الشحن ← جاهز للتسليم ← استلمته
const STAGES = [["تم الحجز", "notebook-pen"], ["جاري التجهيز", "boxes"], ["جاري الشحن", "truck"], ["جاهز للتسليم", "package-check"], ["استلمته", "circle-check"]];
function itemStage(i) {
  const ph = APP.emp.activePhase || {}, st = ph.Effective_Status || ph.Phase_Status;
  const req = n(i.Requested_Qty), al = n(i.Allocated_Qty), dl = n(i.Delivered_Qty);
  if (String(i.Allocation_Status).startsWith("Cancelled")) return { step: -1, label: "ملغي", tone: "red", icon: "ban" };
  if (i.Allocation_Status === "Carried_Forward") return { step: -1, label: "انتقل للمرحلة التالية", tone: "gray", icon: "arrow-left-right" };
  if (req && dl >= req) return { step: 4, label: "استلمته 🎉", tone: "green", icon: "circle-check" };
  if (dl) return { step: 3, label: "استلمت جزءاً والباقي جاهز", tone: "green", icon: "package-check" };
  if (req && al >= req) return { step: 3, label: "جاهز للتسليم", tone: "green", icon: "package-check" };
  if (al) return { step: 3, label: "جزء جاهز والباقي في الطريق", tone: "amber", icon: "package-check" };
  if (["Delivering", "Completed"].includes(st)) return { step: 2, label: "بانتظار وصول كمية إضافية", tone: "amber", icon: "hourglass" };
  if (st === "Receiving") return { step: 2, label: "جاري الشحن", tone: "blue", icon: "truck" };
  if (["Closed", "Ordered"].includes(st)) return { step: 1, label: "جاري التجهيز", tone: "blue", icon: "boxes" };
  return { step: 0, label: "تم الحجز", tone: "brand", icon: "notebook-pen" };
}
const stagePill = g => `<span class="pill pill-${g.tone}">${ic(g.icon)} ${esc(g.label)}</span>`;
/** متتبع الرحلة مثل تتبع الشحنات */
function tracker(step) {
  return `<ol class="flex items-start justify-between relative">${STAGES.map((s, i) => `<li class="flex-1 flex flex-col items-center text-center relative">
    ${i ? `<span class="absolute top-[18px] left-1/2 w-full h-1 rounded-full ${i <= step ? "bg-brand-500" : "bg-slate-200"}" style="z-index:0"></span>` : ""}
    <span class="relative z-[1] w-9 h-9 rounded-full flex items-center justify-center text-[16px] ${i < step ? "bg-brand-600 text-white" : i === step ? "bg-gold-400 text-brand-950 ring-4 ring-gold-100" : "bg-slate-100 text-slate-400"}">${ic(i < step ? "check" : s[1])}</span>
    <span class="mt-1.5 text-[10.5px] sm:text-[11.5px] font-semibold leading-tight ${i <= step ? "text-slate-800" : "text-slate-400"}">${s[0]}</span></li>`).join("")}</ol>`;
}
// الاسم الثلاثي مع الأسماء المركبة (عبد الرحمن، أبو بكر، محمد علي...)
const fullName3 = nm => { const w = String(nm || "").trim().split(/\s+/), out = [];
  for (let i = 0; i < w.length && out.length < 3; i++) { const t = w[i]; if (/^(عبد|عبدال|أبو|ابو|أبي|ابي)$/.test(t) && w[i + 1]) { out.push(t + " " + w[++i]); } else if (/^(ال|الدين|الله)$/.test(t) && out.length) { out[out.length - 1] += " " + t; } else out.push(t); }
  return out.join(" "); };
const booksWord = c => c === 1 ? "كتاب واحد" : c === 2 ? "كتابان" : c >= 3 && c <= 10 ? c + " كتب" : c + " كتاباً";

Router.add("/e/home", view => {
  const r = APP.emp, u = APP.user, ph = r.activePhase;
  const name = fullName3(u.fullName);
  if (!ph) { view.innerHTML = UI.empty("calendar-clock", "لا يوجد حجز مفتوح حالياً", "هنبلغك هنا أول ما يفتح الحجز الجديد 🔔"); return; }
  const items = Emp.activeItems(), inv = Emp.invoice(), inst = Emp.installments();
  const reqQty = sum(items, "Requested_Qty"), alloc = sum(items, "Allocated_Qty"), deliv = sum(items, "Delivered_Qty");
  const paidPct = inv && n(inv.Net_Final_Invoice_Amount) ? n(inv.Total_Paid_Amount) / n(inv.Net_Final_Invoice_Amount) * 100 : 0;
  const left = Emp.daysLeft(), next = inst.find(i => n(i.Remaining_Inst_Amount) > 0), t = Emp.totals();
  const steps = items.map(i => itemStage(i).step).filter(x => x >= 0), step = steps.length ? Math.min(...steps) : -1;
  const ready = items.reduce((s, i) => s + Math.max(0, n(i.Allocated_Qty) - n(i.Delivered_Qty)), 0);
  const rels = [...new Set(items.map(i => i.Beneficiary).filter(Boolean))];
  const hi = new Date().getHours() < 12 ? "صباح الخير" : "مساء الخير";

  // رسالة واحدة واضحة حسب موقفك الآن
  let msg;
  if (ph.Booking_Open && !reqQty) msg = { icon: "sparkles", title: "الحجز مفتوح دلوقتي! 🎉", sub: left !== null ? (left <= 0 ? "النهارده آخر يوم للحجز" : `باقي ${left} يوم على قفل الحجز`) : "اختار كتب أولادك بخصم العاملين", cta: "ابدأ الحجز", href: "#/e/books" };
  else if (ph.Booking_Open) msg = { icon: "circle-check", title: `حجزك محفوظ ✅ ${booksWord(reqQty)}`, sub: "عايز تضيف أو تغيّر؟ " + (left !== null ? (left <= 0 ? "النهارده آخر يوم للتعديل" : `التعديل متاح ${left} يوم كمان`) : "التعديل متاح طول فترة الحجز"), cta: "عدّل حجزك", href: "#/e/books" };
  else if (ready) msg = { icon: "package-check", title: "كتبك جاهزة للتسليم 📦", sub: `${booksWord(ready)} في انتظارك — جهّز المقدم وتعالى استلم`, cta: "التفاصيل", href: "#/e/orders" };
  else if (reqQty && deliv >= reqQty) msg = { icon: "circle-check", title: "استلمت كل كتبك 🎉", sub: next ? "باقي أقساط بسيطة — تابعها من مدفوعاتي" : "بالتوفيق لأولادك في السنة الجديدة", cta: next ? "مدفوعاتي" : "حجوزاتي", href: next ? "#/e/pay" : "#/e/orders" };
  else if (reqQty) msg = { icon: STAGES[Math.max(0, step)][1], title: STAGES[Math.max(0, step)][0] + " ⏳", sub: "هنبلغك أول ما كتبك تبقى جاهزة للتسليم", cta: "تابع طلبك", href: "#/e/orders" };
  else msg = { icon: "lock", title: "الحجز مقفول حالياً", sub: "ما حجزتش في المرحلة دي — استنى المرحلة الجاية", cta: "", href: "" };

  view.innerHTML = `
  <div class="grid gap-4 lg:gap-6 lg:grid-cols-3">
    <section class="hero text-white rounded-4xl p-5 sm:p-7 relative overflow-hidden lg:col-span-2 shadow-lift">
      <div class="absolute -left-16 -top-16 w-56 h-56 rounded-full bg-white/5"></div><div class="absolute left-10 -bottom-20 w-40 h-40 rounded-full bg-gold-400/10"></div>
      <div class="relative flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="text-brand-200 text-sm">${hi} 👋</div>
          <h1 class="text-[22px] sm:text-3xl font-bold mt-0.5 leading-snug">${esc(name)}</h1>
          <div class="flex flex-wrap items-center gap-2 mt-3">
            <span class="inline-flex items-center gap-1.5 rounded-full bg-gold-400 text-brand-950 px-3 py-1 text-[12.5px] font-bold">${ic("badge-percent")} خصم ${fmt(r.settings.UNIFIED_EMP_DISCOUNT_PCT)}%</span>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-[12.5px] font-semibold">${ic("calendar-range")} ${esc(ph.Phase_Name)}</span>
          </div>
        </div>
        ${inv ? `<div class="relative shrink-0">${UI.donut(paidPct, 104, "مسدد")}</div>` : ""}
      </div>
      <a ${msg.href ? `href="${msg.href}"` : ""} class="relative mt-5 flex items-center gap-3 rounded-2xl bg-white/10 ring-1 ring-white/15 p-3.5 ${msg.href ? "active:scale-[.98] transition" : ""}">
        <span class="w-11 h-11 rounded-xl bg-gold-400/20 text-gold-300 flex items-center justify-center text-xl shrink-0">${ic(msg.icon)}</span>
        <span class="flex-1 min-w-0"><span class="block font-bold text-[15.5px]">${esc(msg.title)}</span><span class="block text-[12.5px] text-brand-200 mt-0.5">${esc(msg.sub)}</span></span>
        ${msg.cta ? `<span class="btn btn-gold btn-sm shrink-0 !text-brand-950">${esc(msg.cta)} ${ic("chevron-left")}</span>` : ""}
      </a>
    </section>

    <section class="card card-pad">
      <h2 class="card-title">${ic("wallet", "text-brand-600")} القسط القادم</h2>
      ${next ? `<div class="mt-4 rounded-2xl ${next.Status === "Overdue" ? "bg-rose-50 ring-1 ring-rose-100" : "bg-brand-50"} p-4">
          <div class="text-[13px] ${next.Status === "Overdue" ? "text-rose-700" : "text-brand-700"} font-semibold">${esc(next.Admin_Custom_Notes || "قسط")} · ${next.Status === "Overdue" ? "متأخر من" : "موعده"} ${esc(day(next.Due_Date))}</div>
          <div class="text-3xl font-bold text-slate-900 num mt-1">${money(next.Remaining_Inst_Amount)}</div></div>
          <a href="#/e/pay" class="btn btn-soft w-full mt-3">كل الأقساط ${ic("chevron-left")}</a>`
        : `<div class="mt-2">${UI.empty("calendar-check", inv ? "مفيش أقساط مستحقة 👌" : "لسه مفيش أقساط", inv ? "حسابك تمام." : "الأقساط بتبدأ بعد استلام الكتب.")}</div>`}
    </section>
  </div>

  ${items.length ? `<section class="card card-pad mt-4 lg:mt-6"><div class="flex items-center justify-between mb-4"><h2 class="card-title">${ic("truck", "text-brand-600")} تتبّع طلبك</h2><a href="#/e/orders" class="text-[12.5px] font-semibold text-brand-700">التفاصيل ←</a></div>${tracker(step)}</section>` : ""}

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4 lg:mt-6">
    ${UI.kpi("كتب محجوزة", fmt(reqQty), { icon: "book-open", tone: "brand", foot: Emp.dirty ? "عندك تعديلات لم تُحفظ" : rels.length ? `منها لـ ${rels.length} من الأقارب` : "" })}
    ${UI.kpi("جاهز للتسليم", fmt(alloc) + (reqQty ? ` <span class="text-sm text-slate-400">/ ${fmt(reqQty)}</span>` : ""), { icon: "package-check", tone: "green", pct: reqQty ? alloc / reqQty * 100 : 0, foot: deliv ? `استلمت ${fmt(deliv)}` : "" })}
    ${UI.kpi("وفّرت", inv ? money(inv.Total_Savings) : money(t.cover - t.net), { icon: "piggy-bank", tone: "green", foot: "مقارنة بسعر الغلاف" })}
    ${UI.kpi("المتبقي عليك", inv ? money(inv.Remaining_Balance) : money(0), { icon: "hand-coins", tone: inv && n(inv.Remaining_Balance) ? "amber" : "green", foot: inv && n(inv.Credit_Balance) ? `لك رصيد ${moneyTxt(inv.Credit_Balance)}` : "" })}
  </div>

  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4 lg:mt-6">
    ${relOn() && ph.Booking_Open ? `<button data-act="relQuick" class="card card-pad text-right flex items-center gap-3 active:scale-[.98] transition"><span class="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center text-2xl shrink-0">${ic("users")}</span><span class="flex-1"><span class="block font-bold text-slate-900">احجز لقريب</span><span class="block text-[12.5px] text-slate-500 mt-0.5">${rels.length ? "حجزت لـ " + rels.map(esc).join("، ") : "ابن أخوك أو أختك أو حفيدك؟ احجز له على حسابك"}</span></span>${ic("chevron-left", "text-slate-300")}</button>` : ""}
    <section class="card card-pad ${relOn() && ph.Booking_Open ? "lg:col-span-2" : "sm:col-span-2 lg:col-span-3"}">
      <h2 class="card-title">${ic("smartphone", "text-brand-600")} تدفع إزاي؟</h2>
      <ul class="mt-3 space-y-2 text-[13.5px] text-slate-600">
        <li class="flex gap-2.5">${ic("banknote", "text-emerald-600 mt-0.5")}نقداً لأمين الصندوق وتاخد إيصال</li>
        <li class="flex gap-2.5">${ic("smartphone", "text-sky-600 mt-0.5")}محفظة أو إنستاباي باسم <b class="text-slate-800">${esc(r.settings.CASH_ACCOUNT_HOLDER || "")}</b> وابعت رقم التحويل</li>
      </ul>
    </section>
  </div>`;
});
on("relQuick", () => { Router.go("/e/books"); setTimeout(() => ACTIONS.addBen(), 300); });

// ============================================================ الكتالوج والسلة
function bookCard(b) {
  const q = APP.cart[ck(b.Book_ID, Emp.ben)] || 0, open = Emp.open(), [c1, c2] = toneOf(b.Subject);
  const elsewhere = Object.keys(APP.cart).filter(k => bk(k) === b.Book_ID && bn(k) !== Emp.ben).reduce((s, k) => s + APP.cart[k], 0);
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
      <div class="text-[12px] text-slate-500 mt-0.5">${esc(b.Grade || "")} <span class="text-slate-300">·</span> ${esc(String(b.School_Types || "").split("،").join(" / "))} <span class="text-slate-300">·</span> <span class="num text-slate-400">${esc(b.Book_ID)}</span></div>
      <div class="flex flex-wrap gap-1 mt-1.5">${elsewhere ? pill("", `${elsewhere} كتاب لمستفيد آخر`, "blue") : ""}${b.Book_Status === "Not_Yet_Printed" ? pill("Not_Yet_Printed") : ""}${n(b.In_Stock_From_Previous) > 0 ? pill("", "متوفر بالمخزن", "blue") : ""}</div>
      ${b.Book_Status === "Pricing" ? `<div class="mt-auto pt-2 flex items-center justify-between gap-2"><span class="pill pill-amber">${ic("hourglass")} جاري التسعير</span><span class="text-[11px] text-slate-400">يُتاح للحجز فور إعلان سعره</span></div>` : `
      <div class="mt-auto pt-2 flex items-end justify-between gap-2">
        <div><div class="text-[11px] text-slate-400 line-through num">${fmt(b.Cover_Price)}</div>
          <div class="flex items-center gap-1.5"><span class="text-lg font-bold text-brand-800 num">${fmt(b.Emp_Selling_Price)}</span><span class="text-[11px] text-slate-500">ج.م</span>${save > 0 ? `<span class="pill pill-green !px-1.5">-${save}%</span>` : ""}</div></div>
        ${q ? `<div class="stepper"><button data-act="cartInc" data-id="${esc(b.Book_ID)}" ${!open || q >= mx ? "disabled" : ""} aria-label="زيادة">${ic("plus")}</button><span>${q}</span><button data-act="cartDec" data-id="${esc(b.Book_ID)}" ${open ? "" : "disabled"} aria-label="تقليل">${ic(q === 1 ? "trash-2" : "minus")}</button></div>`
          : `<button class="btn btn-soft btn-sm" data-act="cartInc" data-id="${esc(b.Book_ID)}" ${open ? "" : "disabled"}>${ic("shopping-cart")} أضف للسلة</button>`}
      </div>`}
    </div></article>`;
}
function cartHTML() {
  const t = Emp.totals(), open = Emp.open(), p = APP.plan, s = APP.emp.settings, pc = Emp.planCalc(t.net);
  const hadRes = Emp.activeItems().length > 0;
  const methods = [["INSTALLMENT", "calendar-check", "تقسيط", "مقدم + أقساط شهرية"], ["CASH", "banknote", "نقداً", "كامل القيمة عند الاستلام"], ["INSTAPAY", "send", "إنستاباي", "تحويل كامل القيمة"], ["WALLET", "smartphone", "محفظة", "تحويل كامل القيمة"]];
  const ids = Object.keys(APP.cart);
  return `
  ${ids.length ? ["", ...new Set(ids.map(bn).filter(Boolean))].filter(g => ids.some(k => bn(k) === g)).map(g => `${relOn() || g ? `<div class="text-[12px] font-bold ${g ? "text-sky-700" : "text-brand-700"} mt-2 mb-0.5 flex items-center gap-1">${ic(g ? "users" : "user")} ${g ? "لـ " + esc(g) : "لي ولأبنائي"}</div>` : ""}<ul class="divide-y divide-slate-100 -my-1">${ids.filter(k => bn(k) === g).map(id => { const b = t.m[bk(id)]; if (!b) return ""; return `<li class="flex items-center gap-3 py-2.5">
      <div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px] text-slate-800 truncate">${esc(b.Book_Name)}</div><div class="text-[12px] text-slate-500 num">${fmt(b.Emp_Selling_Price)} × ${APP.cart[id]} = <b class="text-slate-700">${fmt(n(b.Emp_Selling_Price) * APP.cart[id])}</b></div></div>
      ${open ? `<div class="stepper scale-90 origin-left"><button data-act="cartInc" data-id="${esc(id)}" ${APP.cart[id] >= (n(s.MAX_QTY_PER_BOOK) || 3) ? "disabled" : ""}>${ic("plus")}</button><span>${APP.cart[id]}</span><button data-act="cartDec" data-id="${esc(id)}">${ic(APP.cart[id] === 1 ? "trash-2" : "minus")}</button></div>` : `<span class="font-bold num">${APP.cart[id]}</span>`}
    </li>`; }).join("")}</ul>`).join("")
    : `<div class="text-center py-6 text-slate-400 text-sm">${ic("shopping-cart", "text-3xl mx-auto mb-2 block")}السلة فاضية — اختار كتب أولادك من «احجز» 😊</div>`}

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

  ${open ? `<button data-act="submitRes" class="btn btn-primary btn-lg w-full mt-4" ${!ids.length && !hadRes ? "disabled" : ""}>${ic(ids.length ? "check-check" : "ban")} ${ids.length ? (hadRes ? "احفظ التعديل" : "أكّد الحجز") : "إلغاء حجزي"}</button>
    ${ids.length ? `<button data-act="printRes" class="btn btn-ghost btn-sm w-full mt-2">${ic("download")} احفظ طلب الحجز (صورة أو PDF)</button>` : ""}
    <p class="text-[11.5px] text-slate-400 mt-2.5 leading-relaxed">${ic("info", "inline -mt-0.5")} أسبقيتك محفوظة بوقت حجز كل كتاب — لو زوّدت كتب، الكتب القديمة تفضل في دورها.</p>`
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
      <span class="relative w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-lg">${ic("shopping-cart")}<span class="absolute -top-1.5 -left-1.5 min-w-[20px] h-5 px-1 rounded-full bg-gold-400 text-brand-950 text-[11px] font-bold flex items-center justify-center num">${t.count}</span></span>
      <span class="flex-1 text-right"><span class="block text-[12px] text-brand-200">${Emp.dirty ? "السلة · لم تُحفظ بعد" : "السلة · حجزك محفوظ ✅"}</span><span class="block font-bold num">${booksWord(t.count)} · ${moneyTxt(t.net)}</span></span>
      <span class="font-semibold text-[14px] flex items-center gap-1">${Emp.dirty ? "إتمام الحجز" : "السلة"} ${ic("chevron-left")}</span></button>`;
  }
  const hc = $("#cartCount"); if (hc) hc.textContent = t.count;
  const badge = $("#cartBadge"); if (badge) { badge.textContent = t.count; badge.classList.toggle("hidden", !t.count); }
  if (Router.current === "/e/cart") { const bar2 = $("#cartBar"); if (bar2) bar2.classList.add("hidden"); }
}
function renderBookGrid() {
  const r = APP.emp, f = Emp.filter;
  const order = gradeOrder();
  const list = r.books.filter(b => (!f.stage || b.Stage === f.stage) && (!f.grade || b.Grade === f.grade)
    && (!f.type || String(b.School_Types || "").split("،").includes(f.type)) && (!f.subject || b.Subject === f.subject)
    && (!f.q || (b.Book_Name + " " + b.Subject + " " + b.Publisher + " " + b.Book_ID + " " + b.Grade).toLowerCase().includes(f.q.toLowerCase())))
    .sort((a, b) => (order[a.Grade] - order[b.Grade]) || String(a.Book_ID).localeCompare(String(b.Book_ID)));
  $("#bookGrid").innerHTML = list.length ? list.map(bookCard).join("") : `<div class="col-span-full">${UI.empty("search", "لا توجد كتب مطابقة", "جرّب تغيير المرحلة الدراسية أو كلمة البحث.")}</div>`;
  $("#bookCount").textContent = list.length + " كتاب";
}
Router.add("/e/books", view => {
  const r = APP.emp, f = Emp.filter;
  if (!r.activePhase) { view.innerHTML = UI.empty("calendar-clock", "لا توجد مرحلة حجز", "سيظهر الكتالوج عند فتح مرحلة حجز جديدة."); return; }
  const order = gradeOrder(), byOrder = (a, b) => (order[a] ?? 99) - (order[b] ?? 99);
  const cat = r.catalog || {}, stageOf = {}; (cat.grades || []).forEach(g => { stageOf[g.label] = g.stage; });
  const stages = uniq((cat.grades || []).map(g => g.stage)).filter(st => r.books.some(b => b.Stage === st));
  const grades = uniq(r.books.filter(b => !f.stage || b.Stage === f.stage).map(b => b.Grade)).filter(Boolean).sort(byOrder);
  const types = (cat.schoolTypes || []);
  // المواد المتاحة ضمن الاختيارات الحالية (المرحلة/الصف/نوع المدرسة)، بترتيب الأكثر كتباً
  const sc = {}; r.books.filter(b => (!f.stage || b.Stage === f.stage) && (!f.grade || b.Grade === f.grade) && (!f.type || String(b.School_Types || "").split("،").includes(f.type)))
    .forEach(b => { if (b.Subject) sc[b.Subject] = (sc[b.Subject] || 0) + 1; });
  const subjects = Object.keys(sc).sort((a, b) => sc[b] - sc[a] || a.localeCompare(b, "ar"));
  if (f.subject && !sc[f.subject]) f.subject = "";
  view.innerHTML = `
  <div class="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 items-start">
    <div>
      ${!Emp.open() ? `<div class="rounded-2xl bg-amber-50 ring-1 ring-amber-200 text-amber-900 p-4 mb-4 flex gap-3 text-sm">${ic("lock", "text-lg mt-0.5")}<div><b>الحجز ${esc(ar(r.activePhase.Effective_Status))}</b> — يمكنك تصفح الكتالوج، والتعديل متاح فقط أثناء فترة الحجز.</div></div>` : ""}
      <div class="sticky top-16 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 pt-1 pb-3 bg-slate-50/90 backdrop-blur-xl">
        <div class="input-icon">${ic("search")}<input class="input !h-12 !rounded-2xl shadow-soft !ring-slate-200/80" placeholder="ابحث باسم الكتاب أو المادة أو الصف" value="${esc(f.q)}" data-input="bookSearch" type="search"></div>
        ${relOn() && Emp.open() ? `<div class="scroll-x mt-3 items-center"><span class="text-[12px] font-semibold text-slate-500 shrink-0">أحجز لـ:</span><button class="chip !h-8 !text-xs" data-act="pickBen" data-id="" aria-pressed="${!Emp.ben}">${ic("user")} لي ولأبنائي</button>${Emp.bens.map(x => `<button class="chip !h-8 !text-xs" data-act="pickBen" data-id="${esc(x)}" aria-pressed="${Emp.ben === x}">${ic("users")} ${esc(x)}</button>`).join("")}<button class="chip !h-8 !text-xs" data-act="addBen">${ic("plus")} قريب</button></div>` : ""}
        <div class="scroll-x mt-3"><button class="chip" data-act="fStage" data-id="" aria-pressed="${!f.stage}">${ic("layout-grid")} الكل</button>${stages.map(s => `<button class="chip" data-act="fStage" data-id="${esc(s)}" aria-pressed="${f.stage === s}">${ic("graduation-cap")} ${esc(s)}</button>`).join("")}</div>
        <div class="scroll-x mt-2"><button class="chip !h-8 !text-xs" data-act="fType" data-id="" aria-pressed="${!f.type}">كل المدارس</button>${types.map(t => `<button class="chip !h-8 !text-xs" data-act="fType" data-id="${esc(t)}" aria-pressed="${f.type === t}">${ic("building-2")} ${esc(t)}</button>`).join("")}</div>
        ${f.stage && grades.length > 1 ? `<div class="scroll-x mt-2"><button class="chip !h-8 !text-xs" data-act="fGrade" data-id="" aria-pressed="${!f.grade}">كل الصفوف</button>${grades.map(g => `<button class="chip !h-8 !text-xs" data-act="fGrade" data-id="${esc(g)}" aria-pressed="${f.grade === g}">${esc(g)}</button>`).join("")}</div>` : ""}
        ${subjects.length > 1 ? `<div class="scroll-x mt-2"><button class="chip !h-8 !text-xs" data-act="fSubject" data-id="" aria-pressed="${!f.subject}">كل المواد</button>${subjects.map(x => `<button class="chip !h-8 !text-xs" data-act="fSubject" data-id="${esc(x)}" aria-pressed="${f.subject === x}">${ic("book-marked")} ${esc(x)}</button>`).join("")}</div>` : ""}
      </div>
      <div class="flex items-center justify-between mb-3 mt-1"><span id="bookCount" class="text-sm text-slate-500"></span><span class="text-xs text-slate-400">أقصى ${fmt(r.settings.MAX_QTY_PER_BOOK || 3)} من نفس الكتاب</span></div>
      <div id="bookGrid" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"></div>
    </div>
    <aside class="hidden lg:block sticky top-24">
      <section class="card">
        <div class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100"><h2 class="card-title">${ic("shopping-cart", "text-brand-600")} سلة الكتب</h2><span class="pill pill-brand"><span id="cartCount">0</span> كتاب</span></div>
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
on("fType", v => { Emp.filter.type = v; Shell.rerender(); });
on("pickBen", v => { Emp.ben = v; Shell.rerender(); });
on("addBen", async () => {
  const mx = n(APP.emp.settings.MAX_RELATIVES) || 5;
  if (Emp.bens.length >= mx) return toast("الحد الأقصى " + mx + " أقارب", "warning");
  const v = await UI.form({ title: "الحجز لقريب", intro: "تُضاف كتب القريب إلى حجزك وتُحسب على حسابك (المقدم والأقساط).",
    fields: [{ name: "name", label: "اسم القريب", required: true }, { name: "rel", label: "صلة القرابة", type: "select", value: "ابن أخ", options: ["ابن أخ", "ابن أخت", "حفيد", "أخ", "أخت", "ابن عم", "ابن خال", "أخرى"].map(x => [x, x]) }], ok: "متابعة" });
  if (!v || !v.name.trim()) return;
  const label = v.name.trim().replace(/[|]/g, " ") + " — " + v.rel;
  if (!Emp.bens.includes(label)) Emp.bens.push(label);
  Emp.ben = label; Shell.rerender();
  toast("اختر الكتب الآن لـ " + label, "info");
});
on("fSubject", v => { Emp.filter.subject = v; Shell.rerender(); });
/** ترتيب الصفوف كما في الكتالوج (تأسيس ← كي جي ← ابتدائي ← إعدادي ← ثانوي) */
function gradeOrder() { const o = {}; ((APP.emp && APP.emp.catalog && APP.emp.catalog.grades) || []).forEach((g, i) => { o[g.label] = i; }); return o; }
function cartChanged(id) {
  Emp.dirty = true;
  const b = APP.emp.books.find(x => x.Book_ID === bk(id));
  const card = $("#bk_" + CSS.escape(bk(id)));
  if (card && b) card.outerHTML = bookCard(b);
  refreshCartViews();
}
const keyFor = id => String(id).includes("|") ? id : ck(id, Emp.ben);
on("cartInc", id => {
  id = keyFor(id);
  const mx = n(APP.emp.settings.MAX_QTY_PER_BOOK) || 3;
  if ((APP.cart[id] || 0) >= mx) return toast("أقصى عدد من نفس الكتاب " + mx, "warning");
  if (!Object.keys(APP.cart).length && !Emp.activeItems().length) toast("اتضاف للسلة 🛒 كمّل اختيار باقي الكتب", "info");
  APP.cart[id] = (APP.cart[id] || 0) + 1;
  if (navigator.vibrate) navigator.vibrate(8);
  cartChanged(id);
});
on("cartDec", id => { id = keyFor(id); APP.cart[id] = (APP.cart[id] || 0) - 1; if (APP.cart[id] <= 0) delete APP.cart[id]; cartChanged(id); });
on("planMethod", v => { APP.plan.method = v; Emp.dirty = true; refreshCartViews(); });
on("planDownType", v => { APP.plan.downType = v; APP.plan.down = v === "PERCENTAGE" ? Math.max(25, n(APP.emp.settings.MIN_DOWN_PAYMENT_PCT)) : ceil(Emp.planCalc(Emp.totals().net).minDown); Emp.dirty = true; refreshCartViews(); });
on("planCount", v => { APP.plan.count = n(v); Emp.dirty = true; refreshCartViews(); });
on("planDown", v => { APP.plan.down = v; Emp.dirty = true; const html = planPreview(Emp.planCalc(Emp.totals().net)); $$(".plan-preview").forEach(el => el.innerHTML = html); });
Router.add("/e/cart", view => {
  if (!APP.emp.activePhase) { view.innerHTML = UI.empty("shopping-cart", "السلة فاضية"); return; }
  const t = Emp.totals();
  view.innerHTML = `<div class="max-w-xl mx-auto">${UI.pageHead(`${ic("shopping-cart", "text-brand-600")} سلة الكتب`, t.count ? booksWord(t.count) + " · " + esc(APP.emp.activePhase.Phase_Name) : esc(APP.emp.activePhase.Phase_Name), `<a href="#/e/books" class="btn btn-outline btn-sm">${ic("plus")} أضف كتب</a>`)}
    <section class="card card-pad"><div class="cart-body"></div></section></div>`;
  refreshCartViews();
});
on("openCart", () => { if (window.innerWidth < 1024 && !window.__forceSheet) return Router.go("/e/cart");
  const m = UI.open(`<div class="cart-body"></div>`, { title: "سلة الكتب", sub: APP.emp.activePhase.Phase_Name, onClose: () => refreshCartViews() });
  m.body.querySelector(".cart-body").innerHTML = cartHTML();
  Emp._cartSheet = m;
});
on("submitRes", async () => {
  const items = Object.keys(APP.cart).map(id => ({ bookId: bk(id), beneficiary: bn(id), qty: APP.cart[id] }));
  const t = Emp.totals(), pc = Emp.planCalc(t.net);
  if (APP.plan.method === "INSTALLMENT" && items.length && !pc.ok) return toast(`أقل مقدم مسموح ${moneyTxt(pc.minDown)}`, "warning");
  if (!items.length && !(await UI.confirm({ title: "إلغاء الحجز", message: "الاستمارة فارغة، وسيتم إلغاء حجزك في هذه المرحلة بالكامل. متابعة؟", tone: "danger", ok: "إلغاء الحجز" }))) return;
  const r = await call("SUBMIT_OR_UPDATE_RESERVATION", { phaseId: APP.phaseId, items, paymentMethod: APP.plan.method, downPaymentType: APP.plan.downType, downPaymentInput: n(APP.plan.down), installmentCount: APP.plan.count }, { block: true });
  if (!r.success) return toast(r.message, "danger");
  Emp.dirty = false;
  if (Emp._cartSheet) { Emp._cartSheet.close(); Emp._cartSheet = null; }
  if (Router.current === "/e/cart") Router.go("/e/home");
  (r.warnings || []).forEach(w => toast(w, "warning"));
  await Emp.load();
  UI.open(`<div class="text-center py-2"><div class="w-20 h-20 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-4xl animate-pop-in">${ic("circle-check")}</div>
    <h3 class="text-xl font-bold text-slate-900 mt-4">${items.length ? "تمام! حجزك اتسجل 🎉" : "تم إلغاء الحجز"}</h3><p class="text-sm text-slate-500 mt-2 leading-relaxed">${esc(r.message || "")}</p>
    ${items.length ? `<div class="grid grid-cols-2 gap-2 mt-5 text-right">${UI.stat("عدد الكتب", fmt(t.count))}${UI.stat("الإجمالي", money(t.net))}</div>` : ""}</div>`,
    { footer: `<div class="flex gap-2">${items.length ? `<button data-act="printRes" class="btn btn-outline">${ic("download")} احفظ الطلب</button>` : ""}<a href="#/e/orders" data-act="goClose" data-id="/e/orders" class="btn btn-primary flex-1">متابعة حجوزاتي</a><button data-close class="btn btn-outline">تم</button></div>` });
});

// ============================================================ حجوزاتي
Router.add("/e/orders", view => {
  const r = APP.emp, items = Emp.phaseItems(), inv = Emp.invoice(), bm = Emp.bookMap();
  if (!r.activePhase) { view.innerHTML = UI.empty("package", "لا توجد حجوزات"); return; }
  const paidPct = inv && n(inv.Net_Final_Invoice_Amount) ? n(inv.Total_Paid_Amount) / n(inv.Net_Final_Invoice_Amount) * 100 : 0;
  view.innerHTML = `
  ${UI.pageHead("حجوزاتي", esc(r.activePhase.Phase_Name), (items.length ? `<button class="btn btn-outline btn-sm" data-act="printRes">${ic("download")} طلب الحجز</button>` : "") + (inv ? `<button class="btn btn-outline btn-sm" data-act="printInv">${ic("printer")} الفاتورة</button>` : ""))}
  ${items.length ? `<section class="card card-pad mb-4">${tracker(Math.min(...Emp.activeItems().map(i => itemStage(i).step).filter(x => x >= 0).concat([4])))}</section>` : ""}
  <div class="grid gap-4 lg:gap-6 lg:grid-cols-[1fr_360px] items-start">
    <div class="space-y-3">
      ${items.length ? items.map(i => {
        const req = n(i.Requested_Qty), al = n(i.Allocated_Qty), dl = n(i.Delivered_Qty), b = bm[i.Book_ID] || {}, [c1, c2] = toneOf(b.Subject);
        return `<article class="card p-4">
          <div class="flex items-start gap-3">
            <div class="w-11 h-14 rounded-lg shrink-0 flex items-center justify-center text-white text-lg" style="background:linear-gradient(140deg,${c1},${c2})">${ic("book-open")}</div>
            <div class="flex-1 min-w-0"><div class="flex items-start justify-between gap-2"><h3 class="font-bold text-slate-900 leading-snug">${esc(b.Book_Name || i.Book_ID)}${i.Beneficiary ? `<span class="block text-[12px] font-semibold text-sky-700 mt-0.5">لـ ${esc(i.Beneficiary)}</span>` : ""}</h3>${stagePill(itemStage(i))}</div>
              <div class="text-[12px] text-slate-500 mt-0.5">${esc(b.Grade || "")} · ${fmt(i.Unit_Emp_Price)} ج.م للكتاب</div>
              <div class="text-[11.5px] text-slate-400 mt-0.5 flex items-center gap-1">${ic("clock")} أسبقية <span dir="ltr" class="num">${esc(i.Priority_Timestamp)}</span></div></div>
          </div>
          <div class="grid grid-cols-3 gap-2 mt-3.5 text-center">${[["حجزت", req, "text-slate-800"], ["جاهز للتسليم", Math.max(0, al - dl), "text-brand-700"], ["استلمت", dl, "text-emerald-600"]].map(x => `<div class="rounded-xl bg-slate-50 py-2"><div class="text-[11px] text-slate-500">${x[0]}</div><div class="font-bold num ${x[2]}">${x[1]}</div></div>`).join("")}</div>
          ${n(i.Returned_Qty) ? `<div class="text-[11.5px] text-slate-500 mt-1.5">رجّعت ${fmt(i.Returned_Qty)}</div>` : ""}
          ${i.Unallocated_Reason ? `<div class="mt-2.5 text-[12px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 flex gap-1.5">${ic("info", "mt-0.5")}${esc(i.Unallocated_Reason)}</div>` : ""}
        </article>`;
      }).join("") : `<div class="card">${UI.empty("shopping-bag", "لسه ما حجزتش كتب", Emp.open() ? "الحجز مفتوح — اختار كتب أولادك في دقيقة 😊" : "", Emp.open() ? `<a href="#/e/books" class="btn btn-primary mt-5">${ic("library")} ابدأ الحجز</a>` : "")}</div>`}
    </div>
    <aside class="space-y-4 lg:sticky lg:top-24">
      ${inv ? `<section class="card overflow-hidden">
        <div class="hero text-white p-5"><div class="text-brand-200 text-sm">صافي فاتورتك</div><div class="text-3xl font-bold num mt-1">${money(inv.Net_Final_Invoice_Amount)}</div>
          <div class="mt-3">${UI.progress(paidPct, "bg-gold-400")}</div><div class="flex justify-between text-[12px] text-brand-200 mt-1.5"><span>مسدد ${moneyTxt(inv.Total_Paid_Amount)}</span><span>${Math.round(paidPct)}%</span></div></div>
        <div class="p-4 grid grid-cols-2 gap-2">${UI.stat("بسعر الغلاف", `<span class="line-through text-slate-400">${fmt(inv.Total_Cover_Amount)}</span>`)}${UI.stat("وفّرت", `<span class="text-emerald-600">${moneyTxt(inv.Total_Savings)}</span>`)}${UI.stat("المقدم المطلوب", moneyTxt(inv.Down_Payment_Required))}${UI.stat("المتبقي", `<span class="${n(inv.Remaining_Balance) ? "text-rose-600" : "text-emerald-600"}">${moneyTxt(inv.Remaining_Balance)}</span>`)}
          ${n(inv.Credit_Balance) ? `<div class="col-span-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm p-3 font-semibold">لك رصيد مستحق الرد ${moneyTxt(inv.Credit_Balance)}</div>` : ""}</div>
        <div class="px-4 pb-4 flex items-center justify-between text-[12px] text-slate-500"><span>${esc(inv.Emp_Inv_ID)}</span>${pill(inv.Invoice_Status)}</div></section>`
        : `<section class="card card-pad"><div class="flex gap-3"><span class="w-11 h-11 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center text-xl shrink-0">${ic("receipt")}</span><div><div class="font-bold text-slate-900">الفاتورة لسه ما صدرتش</div><p class="text-[13px] text-slate-500 mt-1 leading-relaxed">بتصدر أول ما كتبك تبقى جاهزة للتسليم، والأقساط بتبدأ من يوم الاستلام.</p></div></div></section>`}
    </aside>
  </div>`;
});
/** بيانات العضو للمستندات */
const docEmp = () => { const u = APP.user; return { name: u.fullName, id: u.empId, dept: u.department, mobile: u.mobile }; };
on("printInv", () => {
  const inv = Emp.invoice(), bm = Emp.bookMap(), r = APP.emp; if (!inv) return;
  const h = r.myReservations.find(x => x.Res_ID === inv.Res_ID) || {};
  Doc.show("فاتورة " + inv.Emp_Inv_ID, Doc.invoice({ no: inv.Emp_Inv_ID, date: inv.Issue_Date, phase: r.activePhase.Phase_Name, status: inv.Invoice_Status, method: inv.Payment_Plan_Type, emp: docEmp(),
    lines: Emp.phaseItems().map(i => ({ code: i.Book_ID, name: (bm[i.Book_ID] || {}).Book_Name || i.Book_ID, grade: (bm[i.Book_ID] || {}).Grade, ben: i.Beneficiary, alloc: n(i.Allocated_Qty), deliv: n(i.Delivered_Qty), ret: n(i.Returned_Qty), price: i.Unit_Emp_Price, cover: i.Unit_Cover_Price })),
    adj: n(h.Invoice_Adjustment), adjReason: h.Adjustment_Reason, paid: inv.Total_Paid_Amount, remaining: inv.Remaining_Balance, credit: inv.Credit_Balance, down: inv.Down_Payment_Required,
    schedule: Emp.installments().map(x => ({ label: x.Admin_Custom_Notes || "قسط " + x.Installment_No, due: x.Due_Date, amount: x.Scheduled_Amount, paid: x.Paid_Amount, status: x.Status })) }), { file: inv.Emp_Inv_ID });
});
/** طلب الحجز كمستند (صورة أو PDF) — من السلة الحالية */
on("printRes", () => {
  const r = APP.emp, bm = Emp.bookMap(), h = r.myReservations.find(x => x.Phase_ID === APP.phaseId) || {};
  const lines = Object.keys(APP.cart).map(k => { const b = bm[bk(k)] || {}; return { code: bk(k), name: b.Book_Name || bk(k), grade: b.Grade, ben: bn(k), qty: APP.cart[k], cover: b.Cover_Price, price: b.Emp_Selling_Price }; });
  if (!lines.length) return toast("السلة فاضية", "info");
  const pc = Emp.planCalc(Emp.totals().net);
  Doc.show("طلب حجز", Doc.reservation({ no: h.Res_ID || "مسودة", date: h.Created_At || new Date().toISOString(), phase: r.activePhase.Phase_Name, status: Emp.dirty || !h.Res_ID ? "غير محفوظ" : "مؤكد", emp: docEmp(), lines,
    plan: { method: APP.plan.method, down: pc.down, count: pc.cnt, per: pc.per, last: pc.last } }), { file: "طلب-حجز-" + (h.Res_ID || APP.user.empId) });
});
on("printRcptE", no => {
  const p = APP.emp.myPayments.find(x => x.Receipt_No === no); if (!p) return; const inv = APP.emp.myInvoices.find(i => i.Emp_Inv_ID === p.Emp_Inv_ID) || {};
  Doc.show("إيصال " + no, Doc.receipt({ no, date: p.Payment_Date, emp: docEmp(), amount: p.Amount, method: p.Payment_Method, ref: p.Transaction_Ref, inv: p.Emp_Inv_ID, net: inv.Net_Final_Invoice_Amount, remaining: inv.Remaining_Balance, collector: p.Collected_By }), { file: no });
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
        <div class="font-bold num ${n(p.Amount) < 0 ? "text-sky-600" : "text-slate-900"}">${fmt(Math.abs(n(p.Amount)))}</div><button class="icon-btn w-9 h-9" data-act="printRcptE" data-id="${esc(p.Receipt_No)}" aria-label="الإيصال">${ic("download")}</button></li>`).join("")}</ul>` : UI.empty("wallet", "لا توجد مدفوعات بعد"))}
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
