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
  filter: { stage: "", grade: "", type: "", track: "", subject: "", q: "" },
  ben: "", bens: [],   // المستفيد الحالي ("" = العضو وأبناؤه) وقائمة الأقارب
  dirty: false,

  async load() {
    const r = await call("GET_EMPLOYEE_PORTAL_DATA", { phaseId: APP.phasePicked ? APP.phaseId : "" });
    if (!r.success) { toast(r.message, "danger"); return; }
    const samePhase = APP.emp && r.activePhase && APP.phaseId === r.activePhase.Phase_ID;
    APP.emp = r; store.set("cache", { t: "EMP", d: r });
    if (r.brand) Brand.set(r.brand);
    if (r.activePhase) APP.phaseId = r.activePhase.Phase_ID;
    if (!(samePhase && Emp.dirty)) Emp.resetCart();
    Shell.rerender();
    Notif.badge();
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
// ============================================================ العد التنازلي للمواعيد (فتح الحجز، إغلاقه، التسليم)
const toDate = v => { if (!v) return null; const d = new Date(String(v).replace(" ", "T")); return isNaN(d) ? null : d; };
/** الموعد القادم المهم للموظف في المرحلة: {label, at, art, tone} */
function nextMilestone(ph) {
  if (!ph) return null;
  const now = new Date(), st = toDate(ph.Start_DateTime), en = toDate(ph.End_DateTime), dl = toDate(ph.Delivery_Start_Date), nm = ph.Phase_Name ? ph.Phase_Name + " — " : "";
  if (dl && /^\d{4}-\d{2}-\d{2}$/.test(String(ph.Delivery_Start_Date))) dl.setHours(9, 0, 0, 0);
  if (st && st > now) return { label: nm + "يفتح الحجز بعد", at: st, art: "calendar", note: "جهّز قائمة كتب أولادك من دلوقتي ✍️" };
  if (ph.Booking_Open && en && en > now) return { label: (ph.Phase_Name ? "الحجز مفتوح - " + ph.Phase_Name : "الحجز مفتوح") + " · ينتهي الحجز في", at: en, art: "books", note: "احجز أو عدّل قبل ما الوقت يخلص ⏳" };
  if (dl && dl > now) return { label: nm + "يبدأ التسليم بعد", at: dl, art: "truck", note: "كتبك في الطريق، جهّز المقدم 📦" };
  return null;
}
function countdownHTML(m) {
  if (!m) return "";
  const box = (k, l) => `<div class="flex-1 rounded-2xl bg-white ring-1 ring-brand-100 py-2.5 text-center shadow-soft"><div class="font-display text-[26px] sm:text-3xl font-bold text-brand-800 num leading-none" data-cd="${k}">--</div><div class="text-[11px] text-slate-500 mt-1">${l}</div></div>`;
  return `<section class="card card-pad mt-4 lg:mt-6 overflow-hidden"><div class="flex items-center gap-4">
    <div class="hidden sm:block shrink-0">${Art[m.art]("w-36 h-auto")}</div>
    <div class="flex-1 min-w-0"><div class="flex items-center justify-between gap-2"><h2 class="card-title">${ic("clock", "text-brand-600")} ${esc(m.label)}</h2><span class="text-[12px] text-slate-400 num">${esc(m.at.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" }))}</span></div>
      <div class="flex gap-2 mt-3" dir="ltr" id="cdBox" data-at="${m.at.getTime()}">${box("d", "يوم")}${box("h", "ساعة")}${box("m", "دقيقة")}${box("s", "ثانية")}</div>
      <div class="text-[12.5px] text-slate-500 mt-2.5">${esc(m.note)}</div></div></div></section>`;
}
/** تحديث العداد كل ثانية طالما هو ظاهر */
function startCountdown() {
  clearInterval(Emp._cd);
  const tick = () => { const el = document.getElementById("cdBox"); if (!el) { clearInterval(Emp._cd); return; }
    let ms = Math.max(0, Number(el.dataset.at) - Date.now()); const v = { d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60, s: Math.floor(ms / 1e3) % 60 };
    Object.keys(v).forEach(k => { const x = el.querySelector(`[data-cd="${k}"]`); if (x) x.textContent = String(v[k]).padStart(2, "0"); });
    if (!ms) { clearInterval(Emp._cd); setTimeout(() => reloadData(), 1500); } };
  tick(); Emp._cd = setInterval(tick, 1000);
}

// ============================================================ حالة الكتاب بلغة بسيطة
// التسلسل: تم الحجز ← جاري التجهيز ← جاري الشحن ← جاهز للتسليم ← استلمته
const STAGES = [["تم الحجز", "notebook-pen"], ["جاري التجهيز", "boxes"], ["جاري الشحن", "truck"], ["جاهز للتسليم", "package-check"], ["استلمته", "circle-check"]];
function itemStage(i) {
  const ph = APP.emp.activePhase || {}, st = ph.Effective_Status || ph.Phase_Status;
  const req = n(i.Requested_Qty), al = n(i.Allocated_Qty), dl = n(i.Delivered_Qty);
  if (String(i.Allocation_Status).startsWith("Cancelled")) return { step: -1, label: "ملغي", tone: "red", icon: "ban" };
  if (i.Allocation_Status === "Carried_Forward") return { step: -1, label: "انتقل للمرحلة التالية", tone: "gray", icon: "arrow-left-right" };
  if (req && dl >= req) return { step: 4, label: "تم التسليم كاملاً 🎉", tone: "green", icon: "circle-check" };
  if (dl && al > dl) return { step: 3, label: `استلمت ${fmt(dl)} · متبقٍ ${fmt(al - dl)} جاهز`, tone: "green", icon: "package-check" };
  if (dl) return { step: 3, label: `تسليم جزئي (${fmt(dl)}/${fmt(req)}) · متبقٍ ${fmt(req - dl)}`, tone: "amber", icon: "clock" };
  if (req && al >= req) return { step: 3, label: "جاهز للتسليم", tone: "green", icon: "package-check" };
  if (al) return { step: 3, label: `متاح ${fmt(al)} · متبقٍ ${fmt(req - al)}`, tone: "amber", icon: "package-check" };
  const bk = (Emp.bookMap && Emp.bookMap()[i.Book_ID]) || {};
  if (bk.Book_Status === "Not_Yet_Printed") return { step: 1, label: "لم يُطبع من الناشر بعد", tone: "amber", icon: "clock" };
  if (["Delivering", "Completed"].includes(st)) return { step: 2, label: "بانتظار وصول كمية إضافية", tone: "amber", icon: "hourglass" };
  if (st === "Receiving") return { step: 2, label: "جاري الشحن", tone: "blue", icon: "truck" };
  if (["Closed", "Ordered"].includes(st)) return { step: 1, label: "جاري التجهيز", tone: "blue", icon: "boxes" };
  return { step: 0, label: "تم الحجز", tone: "brand", icon: "notebook-pen" };
}
const stagePill = g => `<span class="pill pill-${g.tone}">${ic(g.icon)} ${esc(g.label)}</span>`;
/** متتبع مرن لحالة الطلب: يدعم التسليم الكامل والجزئي والمتبقي للترحيل */
function tracker(input) {
  const isArr = Array.isArray(input);
  if (!isArr) {
    const step = input;
    return `<ol class="flex items-start justify-between relative">${STAGES.map((s, i) => `<li class="flex-1 flex flex-col items-center text-center relative">
      ${i ? `<span class="absolute top-[18px] left-1/2 w-full h-1 rounded-full ${i <= step ? "bg-brand-500" : "bg-slate-200"}" style="z-index:0"></span>` : ""}
      <span class="relative z-[1] w-9 h-9 rounded-full flex items-center justify-center text-[16px] ${i < step ? "bg-brand-600 text-white" : i === step ? "bg-gold-400 text-brand-950 ring-4 ring-gold-100" : "bg-slate-100 text-slate-400"}">${ic(i < step ? "check" : s[1])}</span>
      <span class="mt-1.5 text-[10.5px] sm:text-[11.5px] font-semibold leading-tight ${i <= step ? "text-slate-800" : "text-slate-400"}">${s[0]}</span></li>`).join("")}</ol>`;
  }
  const active = input.filter(i => !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward");
  const all = input;
  const req = sum(active, "Requested_Qty"), alloc = sum(active, "Allocated_Qty"), deliv = sum(active, "Delivered_Qty");
  const ready = active.reduce((s, i) => s + Math.max(0, n(i.Allocated_Qty) - n(i.Delivered_Qty)), 0);
  const remUnalloc = Math.max(0, req - alloc);
  const remTotal = Math.max(0, req - deliv);
  const carried = all.filter(i => i.Allocation_Status === "Carried_Forward").reduce((s, i) => s + Math.max(0, n(i.Requested_Qty) - n(i.Allocated_Qty)), 0);
  const steps = active.map(i => itemStage(i).step).filter(x => x >= 0);
  const maxStep = steps.length ? Math.max(...steps) : 0;
  const fullDone = req > 0 && deliv >= req;
  const partialDeliv = deliv > 0 && deliv < req;
  const step = fullDone ? 4 : partialDeliv ? 4 : ready > 0 ? 3 : maxStep;
  const pct = req ? Math.round((deliv / req) * 100) : 0;

  let badge = "";
  if (fullDone) badge = `<span class="pill pill-green">${ic("circle-check")} تم التسليم كاملاً</span>`;
  else if (partialDeliv) badge = `<span class="pill pill-amber">${ic("package-check")} تسليم جزئي · ${fmt(deliv)} من ${fmt(req)}</span>`;
  else if (ready > 0 && ready < req) badge = `<span class="pill pill-brand">${ic("package-check")} جاهز تسليم جزئي (${fmt(ready)} من ${fmt(req)})</span>`;
  else if (ready > 0) badge = `<span class="pill pill-green">${ic("package-check")} جاهز للتسليم بالكامل</span>`;
  else if (carried > 0 && !req) badge = `<span class="pill pill-gray">${ic("arrow-left-right")} تم ترحيل ${booksWord(carried)} للمرحلة القادمة</span>`;

  const stepsHtml = `<ol class="flex items-start justify-between relative">${STAGES.map((s, i) => {
    const isLast = i === 4;
    const label = isLast ? (fullDone ? "استلمته كاملاً" : partialDeliv ? `تسليم جزئي (${fmt(deliv)}/${fmt(req)})` : s[0]) : s[0];
    const done = i < step || (isLast && fullDone);
    const cur = i === step && !(isLast && fullDone);
    const cls = done ? "bg-brand-600 text-white" : cur ? (partialDeliv ? "bg-amber-400 text-amber-950 ring-4 ring-amber-100" : "bg-gold-400 text-brand-950 ring-4 ring-gold-100") : "bg-slate-100 text-slate-400";
    return `<li class="flex-1 flex flex-col items-center text-center relative">
      ${i ? `<span class="absolute top-[18px] left-1/2 w-full h-1 rounded-full ${i <= step ? "bg-brand-500" : "bg-slate-200"}" style="z-index:0"></span>` : ""}
      <span class="relative z-[1] w-9 h-9 rounded-full flex items-center justify-center text-[16px] ${cls}">${ic(done ? "check" : s[1])}</span>
      <span class="mt-1.5 text-[10.5px] sm:text-[11.5px] font-semibold leading-tight ${i <= step ? "text-slate-800" : "text-slate-400"}">${esc(label)}</span></li>`;
  }).join("")}</ol>`;

  const summaryBar = req > 0 ? `<div class="mt-4 pt-3 border-t border-slate-100 space-y-2">
    <div class="flex flex-wrap items-center justify-between gap-2">${badge || `<span class="text-[12px] font-semibold text-slate-600">${esc(STAGES[step][0])}</span>`}<span class="text-[12px] text-slate-500 num">نسبة الاستلام: <b class="text-slate-800">${pct}%</b></span></div>
    <div class="h-2 w-full rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full transition-all duration-500 ${fullDone ? "bg-emerald-500" : partialDeliv ? "bg-amber-400" : "bg-brand-500"}" style="width:${pct}%"></div></div>
    <div class="flex flex-wrap items-center gap-2 text-[11.5px]">
      <span class="pill pill-gray num">المطلوب: ${fmt(req)}</span>
      <span class="pill ${deliv ? "pill-green" : "pill-gray"} num">المستلم: ${fmt(deliv)}</span>
      ${ready > 0 ? `<span class="pill pill-brand num">جاهز للاستلام الآن: ${fmt(ready)}</span>` : ""}
      ${remUnalloc > 0 ? `<span class="pill pill-amber num">متبقٍ للترحيل: ${fmt(remUnalloc)}</span>` : remTotal > 0 && !ready ? `<span class="pill pill-amber num">متبقٍ: ${fmt(remTotal)}</span>` : ""}
    </div>
  </div>` : (badge ? `<div class="mt-3 pt-2.5 border-t border-slate-100">${badge}</div>` : "");

  return `${stepsHtml}${summaryBar}`;
}
// الاسم الثلاثي مع الأسماء المركبة (عبد الرحمن، أبو بكر، محمد علي...)
const fullName3 = nm => { const w = String(nm || "").trim().split(/\s+/), out = [];
  for (let i = 0; i < w.length && out.length < 3; i++) { const t = w[i]; if (/^(عبد|عبدال|أبو|ابو|أبي|ابي)$/.test(t) && w[i + 1]) { out.push(t + " " + w[++i]); } else if (/^(ال|الدين|الله)$/.test(t) && out.length) { out[out.length - 1] += " " + t; } else out.push(t); }
  return out.join(" "); };
const booksWord = c => c === 1 ? "كتاب واحد" : c === 2 ? "كتابان" : c >= 3 && c <= 10 ? c + " كتب" : c + " كتاباً";

/** مسميات واضحة ومرنة لحالة المرحلة الحالية وتنويه ترحيل الكتب المتبقية */
function phaseStatusInfo(ph) {
  if (!ph) return { title: "لا توجد مرحلة حجز نشطة حالياً", sub: "تابع إشعارات الإدارة لمعرفة موعد فتح الحجز القادم.", icon: "calendar", tone: "slate" };
  const st = ph.Effective_Status || ph.Phase_Status;
  const nm = ph.Phase_Name ? `«${ph.Phase_Name}»` : "الحالية";
  const map = {
    Open: { title: `الحجز مفتوح الآن — ${nm}`, sub: "يمكنك حجز الكتب وتعديل طلبك حتى إغلاق باب الحجز.", icon: "sparkles", tone: "emerald" },
    Scheduled: { title: `الحجز للمرحلة ${nm} لم يبدأ بعد`, sub: "يمكنك تصفح الكتب وتجهيز قائمة أبنائك الآن، وسيُفتح الحجز فور بدء الموعد المحدد.", icon: "clock", tone: "sky" },
    Closed: { title: `تم إغلاق باب الحجز للمرحلة ${nm}`, sub: "جارٍ مراجعة وتجميع الطلبات تمهيداً لإرسال أمر التوريد للمكتبات.", icon: "lock", tone: "amber" },
    Ordered: { title: `الحجز متوقف مؤقتاً — جاري توريد المرحلة ${nm}`, sub: "تم إرسال طلبات الحجز للمكتبات، وبانتظار وصول الشحنات لبدء التوزيع.", icon: "truck", tone: "amber" },
    Receiving: { title: `الحجز متوقف مؤقتاً — جاري استلام وجرد المرحلة ${nm}`, sub: "وصلت الشحنات وجارٍ فرز الكتب وتخصيصها للحاجزين تمهيداً للتسليم.", icon: "boxes", tone: "amber" },
    Delivering: { title: `الحجز متوقف الآن لحين الانتهاء من تسليم المرحلة ${nm}`, sub: "تتم حالياً عمليات التسليم والتحصيل للطلبات المسجلة، وسيُتاح الحجز للمرحلة القادمة فور الانتهاء.", icon: "package-check", tone: "amber" },
    Completed: { title: `اكتملت المرحلة ${nm}`, sub: "تم الانتهاء من هذه المرحلة بالكامل. تابع إشعارات الإدارة لمعرفة موعد المرحلة القادمة.", icon: "circle-check", tone: "slate" }
  };
  return map[st] || { title: `الحجز متوقف مؤقتاً في المرحلة ${nm}`, sub: "يمكنك تصفح الكتب الآن، وسيتاح الحجز والتعديل فور فتح المرحلة.", icon: "lock", tone: "amber" };
}
function carryNotice(ph) {
  if (!ph || ph.Booking_Open) return null;
  const st = ph.Effective_Status || ph.Phase_Status;
  // المُرحَّل فعلاً = اللي نسخته في المرحلة الجديدة لسه قائمة (لو اتلغت هناك ميتحسبش)
  const all = APP.emp.myReservationItems || [], live = id => all.some(x => x.Carried_From_Item_ID === id && !String(x.Allocation_Status).startsWith("Cancelled"));
  const carried = Emp.phaseItems().filter(i => i.Allocation_Status === "Carried_Forward" && (!all.some(x => x.Carried_From_Item_ID === i.Res_Item_ID) || live(i.Res_Item_ID))).reduce((s, i) => s + Math.max(0, n(i.Requested_Qty) - n(i.Allocated_Qty)), 0);
  const pending = ["Receiving", "Delivering", "Completed"].includes(st) ? Emp.activeItems().reduce((s, i) => s + Math.max(0, n(i.Requested_Qty) - n(i.Allocated_Qty)), 0) : 0;
  const chose = Emp.activeItems().filter(i => n(i.Requested_Qty) > n(i.Allocated_Qty)).every(i => i.Waitlist_Choice === "carry");
  if (pending > 0) return { qty: pending, text: chose ? `تنويه: متبقٍ لك ${booksWord(pending)} لم تتوفر بعد — وافقت على ترحيلها للمرحلة القادمة بأولوية الحجز.` : `تنويه: متبقٍ لك ${booksWord(pending)} لم تتوفر بعد — اختار من «حجوزاتي»: ترحيلها للمرحلة القادمة أو إنهاء حجزك على المتاح.` };
  if (carried > 0) return { qty: carried, text: `تنويه: تم ترحيل ${booksWord(carried)} المتبقية لك إلى المرحلة القادمة.` };
  return null;
}

Router.add("/e/home", view => {
  const r = APP.emp, u = APP.user, ph = r.activePhase;
  const name = fullName3(u.fullName);
  if (!ph) { view.innerHTML = Art.empty("calendar", "لا يوجد حجز مفتوح حالياً", "تابع إشعارات الإدارة لمعرفة موعد الحجز الجديد 🔔", `<button data-act="contact" class="btn btn-soft btn-sm mt-4">${ic("headset")} تواصل مع المسؤول</button>`); return; }
  const items = Emp.activeItems(), inv = Emp.invoice(), inst = Emp.installments();
  const reqQty = sum(items, "Requested_Qty"), alloc = sum(items, "Allocated_Qty"), deliv = sum(items, "Delivered_Qty");
  const paidPct = inv && n(inv.Net_Final_Invoice_Amount) ? n(inv.Total_Paid_Amount) / n(inv.Net_Final_Invoice_Amount) * 100 : 0;
  const left = Emp.daysLeft(), next = inst.find(i => n(i.Remaining_Inst_Amount) > 0), t = Emp.totals();
  const steps = items.map(i => itemStage(i).step).filter(x => x >= 0), step = steps.length ? Math.min(...steps) : -1;
  const ready = items.reduce((s, i) => s + Math.max(0, n(i.Allocated_Qty) - n(i.Delivered_Qty)), 0);
  const rels = [...new Set(items.map(i => i.Beneficiary).filter(Boolean))];
  const hi = new Date().getHours() < 12 ? "صباح الخير" : "مساء الخير";

  // رسالة واحدة واضحة حسب موقفك الآن
  const psi = phaseStatusInfo(ph), carry = carryNotice(ph);
  let msg;
  if (ph.Booking_Open && !reqQty) msg = { icon: "sparkles", title: "الحجز مفتوح دلوقتي! 🎉", sub: left !== null ? (left <= 0 ? "النهارده آخر يوم للحجز" : `باقي ${left} يوم على قفل الحجز`) : "اختار كتب أولادك بخصم العاملين", cta: "ابدأ الحجز خطوة بخطوة", href: "#/e/wiz", act: "wizStart" };
  else if (ph.Booking_Open) msg = { icon: "circle-check", title: `حجزك محفوظ — ${booksWord(reqQty)}`, sub: "عايز تضيف أو تغيّر؟ " + (left !== null ? (left <= 0 ? "النهارده آخر يوم للتعديل" : `التعديل متاح ${left} يوم كمان`) : "التعديل متاح طول فترة الحجز"), cta: "راجع وعدّل حجزك", href: "#/e/wiz", act: "wizStart" };
  else if (ready) msg = { icon: "package-check", title: "كتبك جاهزة للتسليم 📦", sub: `${booksWord(ready)} في انتظارك — جهّز المقدم وتعالى استلم` + (carry ? `\n${carry.text}` : ""), cta: "رمز الاستلام", href: "", act: "myQr" };
  else if (reqQty && deliv >= reqQty) msg = { icon: "circle-check", title: "استلمت كل كتب " + (ph.Phase_Name || "المرحلة دي") + " 🎉", sub: next ? "باقي أقساط بسيطة — تابعها من مدفوعاتي" : "بالتوفيق لأولادك في السنة الجديدة", cta: next ? "مدفوعاتي" : "حجوزاتي", href: next ? "#/e/pay" : "#/e/orders" };
  else if (reqQty) msg = { icon: STAGES[Math.max(0, step)][1], title: STAGES[Math.max(0, step)][0] + " ⏳", sub: carry ? carry.text : "تابع كل خطوة لحظة بلحظة من «تتبّع طلبك» تحت", cta: "تابع طلبك", href: "#/e/orders" };
  else msg = { icon: psi.icon, title: psi.title, sub: carry ? carry.text : psi.sub, cta: "", href: "" };

  const anns = (r.announcements || []).slice(0, 4);
  view.innerHTML = `
  ${anns.length ? `<div class="flex items-center gap-2 mb-2 text-[13px] font-bold text-slate-700">${ic("megaphone", "text-brand-600")} إشعارات الإدارة</div>` : ""}
  ${anns.map(a => `<div class="mb-3 rounded-2xl p-3.5 flex gap-3 ${a.tone === "warning" ? "bg-amber-50 ring-1 ring-amber-200 text-amber-900" : a.tone === "success" ? "bg-emerald-50 ring-1 ring-emerald-200 text-emerald-900" : "bg-brand-50 ring-1 ring-brand-100 text-brand-900"}"><span class="text-xl mt-0.5">${ic("megaphone")}</span><div class="flex-1 min-w-0"><b class="block text-[14.5px]">${esc(a.title)}</b>${a.body ? `<p class="text-[13px] mt-0.5 whitespace-pre-line opacity-90">${esc(a.body)}</p>` : ""}<div class="text-[11px] opacity-60 mt-1 num">${esc(String(a.at || "").slice(0, 10))}</div></div></div>`).join("")}
  <div class="grid gap-4 lg:gap-6 lg:grid-cols-3">
    <section class="hero text-white rounded-4xl p-5 sm:p-7 relative overflow-hidden lg:col-span-3 shadow-lift">
      <div class="absolute -left-16 -top-16 w-56 h-56 rounded-full bg-white/5"></div><div class="absolute left-10 -bottom-20 w-40 h-40 rounded-full bg-gold-400/10"></div>
      <div class="relative flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="text-brand-200 text-sm">${hi} 👋</div>
          <h1 class="font-bold mt-0.5 leading-snug break-words" style="font-size:clamp(18px,5.4vw,30px)">${esc(name)}</h1>
          <div class="flex flex-wrap items-center gap-2 mt-3">
            <span class="inline-flex items-center gap-1.5 rounded-full bg-gold-400 text-brand-950 px-3 py-1 text-[12.5px] font-bold">${ic("badge-percent")} خصم ${fmt(r.settings.UNIFIED_EMP_DISCOUNT_PCT)}%</span>
            <span class="inline-flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-[12.5px] font-semibold">${ic("calendar-range")} ${esc(ph.Phase_Name)}</span>
          </div>
        </div>
        ${inv ? `<div class="relative shrink-0">${UI.donut(paidPct, 104, "مسدد")}</div>` : ""}
      </div>
      <div class="relative mt-5 rounded-2xl bg-white/10 ring-1 ring-white/15 p-4">
        <div class="flex items-start gap-3">
          <span class="w-11 h-11 rounded-xl bg-gold-400/20 text-gold-300 flex items-center justify-center text-xl shrink-0">${ic(msg.icon)}</span>
          <div class="flex-1 min-w-0"><div class="font-bold text-[16px] leading-snug">${esc(msg.title)}</div><div class="text-[13px] text-brand-200 mt-1 leading-relaxed">${esc(msg.sub)}</div></div>
        </div>
        ${msg.cta ? `<a ${msg.href ? `href="${msg.href}"` : ""} ${msg.act ? `data-act="${msg.act}"` : ""} class="btn btn-gold w-full mt-4 !h-12 !text-[15px] !text-brand-950 justify-center">${esc(msg.cta)} ${ic("chevron-left")}</a>` : ""}
      </div>
    </section>

  </div>

  ${ph.Booking_Open ? wzHomeCard(reqQty) : ""}
  ${kidsHomeCard()}
  ${countdownHTML(nextMilestone(ph))}
  ${items.length ? `<section class="card card-pad mt-4 lg:mt-6"><div class="flex items-center justify-between mb-4"><h2 class="card-title">${ic("truck", "text-brand-600")} تتبّع طلبك</h2><a href="#/e/orders" class="text-[12.5px] font-semibold text-brand-700">التفاصيل ←</a></div>
    <div class="flex items-center gap-3"><div class="hidden sm:block w-28 shrink-0">${Art[["books", "calendar", "truck", "box", "party"][deliv >= reqQty && reqQty ? 4 : (ready || deliv) ? 3 : Math.max(0, step)]]("w-full h-auto")}</div><div class="flex-1 min-w-0">${tracker(items)}</div></div></section>` : ""}
  ${next ? `<section class="card card-pad mt-4 lg:mt-6">
      <div class="flex items-center justify-between"><h2 class="card-title">${ic("wallet", "text-brand-600")} القسط القادم</h2><a href="#/e/pay" class="text-[12.5px] font-semibold text-brand-700">كل الأقساط ←</a></div>
      <div class="mt-3 rounded-2xl ${next.Status === "Overdue" ? "bg-rose-50 ring-1 ring-rose-100" : "bg-brand-50"} p-4 flex flex-wrap items-end justify-between gap-2">
        <div><div class="text-[13px] ${next.Status === "Overdue" ? "text-rose-700" : "text-brand-700"} font-semibold">${esc(next.Admin_Custom_Notes || "قسط")} · ${next.Status === "Overdue" ? "متأخر من" : "موعده"} ${esc(day(next.Due_Date))}</div>
        <div class="text-3xl font-bold text-slate-900 num mt-1">${money(next.Remaining_Inst_Amount)}</div></div>
        ${inv && n(inv.Remaining_Balance) ? `<div class="text-[12.5px] text-slate-500">إجمالي المتبقي <b class="num text-slate-800">${moneyTxt(inv.Remaining_Balance)}</b></div>` : ""}</div>
    </section>` : ""}

  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4 lg:mt-6">
    ${UI.kpi("كتب محجوزة", fmt(reqQty), { icon: "book-open", tone: "brand", foot: Emp.dirty ? "عندك تعديلات لم تُحفظ" : rels.length ? `منها لـ ${rels.length} من الأقارب` : "" })}
    ${UI.kpi("جاهز للتسليم", fmt(alloc) + (reqQty ? ` <span class="text-sm text-slate-400">/ ${fmt(reqQty)}</span>` : ""), { icon: "package-check", tone: "green", pct: reqQty ? alloc / reqQty * 100 : 0, foot: deliv ? `استلمت ${fmt(deliv)}` : "" })}
    ${UI.kpi("وفّرت", inv ? money(inv.Total_Savings) : money(t.cover - t.net), { icon: "piggy-bank", tone: "green", foot: "مقارنة بالسعر قبل الخصم" })}
    ${UI.kpi("المتبقي عليك", inv ? money(inv.Remaining_Balance) : money(0), { icon: "hand-coins", tone: inv && n(inv.Remaining_Balance) ? "amber" : "green", foot: inv && n(inv.Credit_Balance) ? `لك رصيد ${moneyTxt(inv.Credit_Balance)}` : "" })}
  </div>

  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4 lg:mt-6">
    ${relOn() && ph.Booking_Open ? `<button data-act="relQuick" class="card card-pad text-right flex items-center gap-3 active:scale-[.98] transition"><span class="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center text-2xl shrink-0">${ic("users")}</span><span class="flex-1"><span class="block font-bold text-slate-900">احجز لقريب</span><span class="block text-[12.5px] text-slate-500 mt-0.5">${rels.length ? "حجزت لـ " + rels.map(esc).join("، ") : "ابن أخوك أو أختك أو حفيدك؟ احجز له على حسابك"}</span></span>${ic("chevron-left", "text-slate-300")}</button>` : ""}
    <section class="card card-pad ${relOn() && ph.Booking_Open ? "lg:col-span-2" : "sm:col-span-2 lg:col-span-3"}">
      <div class="flex items-center justify-between gap-2"><h2 class="card-title">${ic("smartphone", "text-brand-600")} تدفع إزاي؟</h2><button data-act="contact" class="btn btn-soft btn-xs">${ic("headset")} تواصل مع المسؤول</button></div>
      <ul class="mt-3 space-y-2 text-[13.5px] text-slate-600">
        <li class="flex gap-2.5">${ic("banknote", "text-emerald-600 mt-1 shrink-0")}<span>نقداً لأمين الصندوق وتاخد إيصال</span></li>
        <li class="flex gap-2.5">${ic("smartphone", "text-sky-600 mt-1 shrink-0")}<span>محفظة أو إنستاباي باسم <b class="text-slate-800">${esc(r.settings.CASH_ACCOUNT_HOLDER || "")}</b> وابعت رقم التحويل</span></li>
      </ul>
    </section>
  </div>`;
  startCountdown();
  // أول دخول في الجلسة بدون حجز: نفتح معالج الحجز تلقائياً
  try { if (ph.Booking_Open && !reqQty && !Emp.dirty && !sessionStorage.getItem("wb_wz_auto")) { sessionStorage.setItem("wb_wz_auto", "1"); setTimeout(() => { if (Router.current === "/e/home" && !UI._stack.length) ACTIONS.wizStart(); }, 200); } } catch (_) {}
});
on("relQuick", () => { Router.go("/e/books"); setTimeout(() => ACTIONS.addBen(), 300); });

// ============================================================ الكتالوج والسلة
/** سعر بند: رقم، أو «مع الشحنة» لكتاب لم يُسعَّر بعد */
const lineAmt = l => n(l.price) ? fmt(l.qty * n(l.price)) : "🚚 مع الشحنة";
const pubLogo = (p, sub) => logoFor(APP.emp && APP.emp.pubLogos, p, sub);
on("coverZoom", id => {
  const b = APP.emp.books.find(x => x.Book_ID === id); if (!b || !b.Cover_URL) return;
  const q = APP.cart[ck(b.Book_ID, Emp.ben)] || 0, can = Emp.open() && Router.current !== "/e/orders"; // من «حجوزاتي» للعرض فقط
  const m = UI.open(`<img src="${esc(b.Cover_URL)}" alt="" class="w-full max-h-[60vh] object-contain rounded-2xl bg-slate-50">
    <div class="mt-3 flex items-center justify-between gap-3"><div class="min-w-0"><div class="font-bold text-slate-900">${esc(b.Book_Name)}</div><div class="text-[12px] text-slate-500">${esc(gradeTitle(b.Grade))}${b.Book_Part ? " · " + esc(b.Book_Part) : ""}</div></div>
    ${b.Book_Status !== "Pricing" ? `<div class="text-left shrink-0"><div class="text-xl font-bold text-brand-800 num">${fmt(b.Emp_Selling_Price)} <span class="text-[11px] text-slate-500">ج.م</span></div><div class="text-[11px] text-slate-400 line-through num">${fmt(b.Cover_Price)}</div></div>` : ""}</div>`,
    { title: esc(b.Subject) + " — " + esc(b.Publisher), footer: can && !q ? `<button class="btn btn-primary btn-lg w-full" data-zadd>${ic("plus")} أضف للسلة</button>` : q && Router.current !== "/e/orders" ? `<div class="text-center text-emerald-700 font-semibold">${ic("check")} في السلة (${q})</div>` : "" });
  const a = m.root.querySelector("[data-zadd]"); if (a) a.onclick = () => { m.close(); setTimeout(() => ACTIONS.cartInc(b.Book_ID), 300); };
});
function cartHTML() {
  const t = Emp.totals(), open = Emp.open(), p = APP.plan, s = APP.emp.settings, pc = Emp.planCalc(t.net);
  const hadRes = Emp.activeItems().length > 0;
  const methods = [["INSTALLMENT", "calendar-check", "تقسيط", "مقدم + أقساط شهرية"], ["CASH", "banknote", "نقداً", "كامل القيمة عند الاستلام"], ["INSTAPAY", "send", "إنستاباي", "تحويل كامل القيمة"], ["WALLET", "smartphone", "محفظة", "تحويل كامل القيمة"]];
  const ids = Object.keys(APP.cart);
  // السلة بنفس السلوك في كل طرق الحجز: ١ الكتب (مراجعة) ← ٢ طريقة السداد ← ٣ التأكيد
  let step = Emp.cartStep || "list"; if (Emp._noList && step === "list") step = "pay"; if (!ids.length || !open) step = "list";
  const stepBar = open && ids.length ? `<ol class="flex items-center gap-1.5 mb-3">${[["list", "الكتب"], ["pay", "السداد"], ["confirm", "التأكيد"]].map((x, i, a) => { const k = a.findIndex(y => y[0] === step), done = i < k, cur = i === k;
      return `<li class="flex items-center gap-1.5 ${i < a.length - 1 ? "flex-1" : ""}"><span class="w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${done ? "bg-emerald-500 text-white" : cur ? "bg-brand-700 text-white ring-4 ring-brand-100" : "bg-slate-100 text-slate-400"}">${done ? ic("check", "!w-3 !h-3") : i + 1}</span><span class="text-[11.5px] font-bold ${cur ? "text-brand-800" : done ? "text-emerald-700" : "text-slate-400"}">${x[1]}</span>${i < a.length - 1 ? `<span class="h-0.5 flex-1 rounded-full ${done ? "bg-emerald-300" : "bg-slate-200"}"></span>` : ""}</li>`; }).join("")}</ol>` : "";
  const mini = `<div class="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-3 flex items-center gap-3"><span class="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-brand-700 shrink-0">${ic("shopping-cart")}</span>
      <span class="flex-1 min-w-0 leading-tight"><b class="block text-[13.5px] text-slate-900">${booksWord(t.count)} · <span class="num">${money(t.net)}</span></b><span class="block text-[11.5px] text-emerald-600 font-semibold">${gTxt("وفّرت", "وفّرتي")} ${moneyTxt(t.cover - t.net)}</span></span>
      <button type="button" class="text-[12px] font-bold text-brand-700 px-2 py-1 rounded-lg hover:bg-brand-50" data-act="cartStep" data-id="list">${ic("pencil", "inline !w-3.5 !h-3.5")} الكتب</button></div>`;
  if (step === "pay") return stepBar + mini + payBlock() + `<div class="grid grid-cols-[auto_1fr] gap-2 mt-4"><button class="btn btn-outline" data-act="cartStep" data-id="list">${ic("arrow-right")}</button><button class="btn btn-primary btn-lg" data-act="cartStep" data-id="confirm" ${p.method === "INSTALLMENT" && !pc.ok ? "disabled" : ""}>التالي: مراجعة وتأكيد ←</button></div>`;
  if (step === "confirm") return stepBar + confirmBlock();
  return stepBar + `
  ${Emp._noList ? "" : (ids.length ? resGroups(cartLines()).map(g => `<section class="mt-3 first:mt-0 rounded-2xl ring-1 ring-slate-200 overflow-hidden">
      <div class="flex items-center gap-2.5 px-3 py-2 bg-brand-50/60"><span class="text-[22px] leading-none">${g.emoji}</span>
        <div class="flex-1 min-w-0"><div class="font-bold text-[14px] text-slate-900 truncate">${esc(g.title)}</div>${g.sub ? `<div class="text-[11.5px] text-brand-700 font-semibold">${esc(g.sub)}</div>` : ""}</div>
        <div class="text-left shrink-0"><div class="font-bold text-[13.5px] text-brand-800 num">${moneyTxt(g.net)}</div><div class="text-[11px] text-slate-500">${booksWord(g.count)}</div></div></div>
      <ul class="divide-y divide-slate-100 px-3">${g.lines.map(l => `<li class="flex items-center gap-3 py-2.5">
      <div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px] text-slate-800 truncate">${esc(l.name)}</div><div class="text-[12px] text-slate-500 num">${n(l.price) ? `${fmt(l.price)} × ${l.qty} = <b class="text-slate-700">${fmt(n(l.price) * l.qty)}</b>` : `<span class="text-amber-700">🚚 السعر جاي مع الشحنة</span>`}</div></div>
      ${open ? `<div class="stepper scale-90 origin-left"><button data-act="cartInc" data-id="${esc(l.key)}" ${l.qty >= (n(s.MAX_QTY_PER_BOOK) || 3) ? "disabled" : ""}>${ic("plus")}</button><span>${l.qty}</span><button data-act="cartDec" data-id="${esc(l.key)}">${ic(l.qty === 1 ? "trash-2" : "minus")}</button></div>` : `<span class="font-bold num">${l.qty}</span>`}
    </li>`).join("")}</ul></section>`).join("")
    : Art.empty("cart", "السلة فاضية", "اختار كتب أولادك من «احجز» 😊"))}

  <div class="rounded-2xl bg-slate-50 p-3.5 mt-3 space-y-1.5 text-[13.5px]">
    <div class="flex justify-between text-slate-500"><span>قبل الخصم</span><span class="line-through num">${moneyTxt(t.cover)}</span></div>
    <div class="flex justify-between text-emerald-600 font-semibold"><span>توفيرك</span><span class="num">${moneyTxt(t.cover - t.net)}</span></div>
    ${(() => { const u = cartLines().filter(l => !n(l.price)).reduce((a, l) => a + l.qty, 0); return u ? `<div class="text-[12px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">🚚 ${booksWord(u)} سعرها جاي مع الشحنة — هتتضاف للإجمالي وقتها بخصم العاملين</div>` : ""; })()}
    <div class="flex justify-between items-baseline pt-1.5 border-t border-slate-200"><span class="font-bold text-slate-900">الإجمالي</span><span class="text-xl font-bold text-brand-800 num">${money(t.net)}</span></div>
  </div>

  ${open ? (ids.length ? `<button data-act="cartStep" data-id="pay" class="btn btn-primary btn-lg w-full mt-4">${ic("check")} ${gTxt("تمام راجعت — نختار طريقة السداد", "تمام راجعت — نختار طريقة السداد")} ←</button>
      <div class="grid grid-cols-2 gap-2 mt-2"><a href="#/e/books" data-act="goClose" data-id="/e/books" class="btn btn-outline btn-sm justify-center">${ic("plus")} ضيف كتب</a>${Emp.dirty ? `<button data-act="cartLater" class="btn btn-outline btn-sm justify-center">${ic("clock")} احفظها لبعدين</button>` : `<button data-act="printRes" class="btn btn-outline btn-sm justify-center">${ic("download")} طلب الحجز</button>`}</div>
      ${Emp.dirty ? `<button data-act="discardDraft" class="btn btn-ghost btn-sm w-full mt-2 !text-rose-600">${ic("undo-2")} ${hadRes ? "تراجع عن التعديلات" : "إلغاء الطلب قبل التأكيد"}</button>` : ""}`
    : hadRes ? `<button data-act="submitRes" class="btn btn-primary btn-lg w-full mt-4">${ic("ban")} إلغاء حجزي</button>` : "")
    : `<div class="mt-4 rounded-2xl bg-amber-50 text-amber-800 text-sm p-3.5 flex gap-2">${ic("lock", "mt-0.5")}الحجز مغلق في هذه المرحلة.</div>`}`;
}
/** خطوة السداد: طريقة الدفع والمقدم والأقساط */
function payBlock() {
  const t = Emp.totals(), open = Emp.open(), p = APP.plan, s = APP.emp.settings, pc = Emp.planCalc(t.net);
  const methods = [["INSTALLMENT", "calendar-check", "تقسيط", "مقدم + أقساط شهرية"], ["CASH", "banknote", "نقداً", "كامل القيمة عند الاستلام"], ["INSTAPAY", "send", "إنستاباي", "تحويل كامل القيمة"], ["WALLET", "smartphone", "محفظة", "تحويل كامل القيمة"]];
  return `
  <div class="mt-4"><div class="font-bold text-[14.5px] text-slate-900 mb-2">${gTxt("هتدفع إزاي؟", "هتدفعي إزاي؟")}</div>
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

`;
}
/** خطوة التأكيد: ملخص كل فرد + السداد + أكّد / عدّل / احفظ مؤقتاً / احذف */
function confirmBlock() {
  const t = Emp.totals(), hadRes = Emp.activeItems().length > 0, gs = resGroups(cartLines()), p = APP.plan;
  return `<div class="rounded-3xl ring-1 ring-brand-200 overflow-hidden">
    <div class="px-4 py-3 text-white" style="background:linear-gradient(135deg,#552c83,#2e1650)"><div class="text-[11.5px] text-brand-200">${gTxt("خلاص كده؟ راجع آخر مرة", "خلاص كده؟ راجعي آخر مرة")}</div><div class="font-display font-bold text-[18px]">${hadRes ? "تعديل حجزك" : "تأكيد حجزك"} — <span class="num">${money(t.net)}</span></div></div>
    <ul class="divide-y divide-slate-100 bg-white">${gs.map(g => `<li class="flex items-center gap-2.5 px-4 py-2.5"><span class="text-[20px]">${g.emoji}</span><span class="flex-1 min-w-0"><b class="block text-[13.5px] text-slate-900 truncate">${esc(g.title)}</b>${g.sub ? `<span class="block text-[11px] text-brand-700">${esc(g.sub)}</span>` : ""}</span><span class="text-left"><b class="block num text-[13px] text-brand-800">${moneyTxt(g.net)}</b><span class="text-[11px] text-slate-500">${booksWord(g.count)}</span></span></li>`).join("")}
      <li class="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50"><span class="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-brand-700">${ic("wallet", "!w-4 !h-4")}</span><span class="flex-1 text-[13px] text-slate-700">طريقة السداد: <b>${esc(ar(p.method))}</b>${p.method === "INSTALLMENT" ? ` · ${fmt(p.count)} ${n(p.count) > 2 ? "أقساط" : "قسط"}` : ""}</span><button type="button" class="text-[12px] font-bold text-brand-700" data-act="cartStep" data-id="pay">تغيير</button></li></ul></div>
  <button data-act="submitRes" class="btn btn-primary btn-lg w-full mt-4">${ic("check-check")} ${hadRes ? "احفظ التعديل" : "أكّد الحجز"}</button>
  <div class="grid grid-cols-3 gap-2 mt-2">
    <button type="button" class="btn btn-outline btn-sm justify-center flex-col !h-auto py-2 gap-0.5" data-act="cartStep" data-id="list">${ic("pencil")}<span class="text-[11.5px]">عدّل الكتب</span></button>
    <button type="button" class="btn btn-outline btn-sm justify-center flex-col !h-auto py-2 gap-0.5" data-act="cartLater">${ic("clock")}<span class="text-[11.5px]">احفظ مؤقتاً</span></button>
    <button type="button" class="btn btn-outline btn-sm justify-center flex-col !h-auto py-2 gap-0.5 !text-rose-600 !ring-rose-200" data-act="cartDelete">${ic("trash-2")}<span class="text-[11.5px]">احذف الطلب</span></button>
  </div>
  <button data-act="printRes" class="btn btn-ghost btn-sm w-full mt-2">${ic("download")} احفظ طلب الحجز (صورة أو PDF)</button>
  <p class="text-[11.5px] text-slate-400 mt-2 leading-relaxed">${ic("info", "inline -mt-0.5")} الحجز ميتسجلش وأسبقيتك متتحسبش غير لما ${gTxt("تدوس", "تدوسي")} «${hadRes ? "احفظ التعديل" : "أكّد الحجز"}». الحفظ المؤقت بيحفظ السلة بس.</p>`;
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
  { const cd = document.getElementById("cartDiv"); if (cd && typeof cartDivider === "function") cd.innerHTML = cartDivider(); const nk = document.getElementById("nextKid"); if (nk && typeof nextKidCard === "function") nk.innerHTML = nextKidCard(); }
  const t = Emp.totals();
  $$(".cart-body").forEach(el => el.innerHTML = cartHTML());
  $$(".wiz-pay").forEach(el => { Emp._noList = true; try { el.innerHTML = cartHTML(); } finally { Emp._noList = false; } });
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
// ============================================================ ترتيب الكتالوج: الصف أولاً ثم المواد الأساسية والكتب الأشهر
const ORD_AR = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"];
/** «4 ابتدائي» ← «الصف الرابع الابتدائي» */
function gradeTitle(g) {
  const s = String(g || ""), m = s.match(/^(\d)\s*(ابتدائي|إعدادي|ثانوي)$/);
  if (m) return `الصف ${ORD_AR[+m[1]] || m[1]} ${{ ابتدائي: "الابتدائي", إعدادي: "الإعدادي", ثانوي: "الثانوي" }[m[2]]}`;
  const k = s.match(/^كي جي\s*(\d)$/); if (k) return `رياض الأطفال — المستوى ${ORD_AR[+k[1]]}`;
  return s === "تأسيس" ? "مرحلة التأسيس" : s;
}
const gradeShort = g => { const m = String(g || "").match(/^(\d)\s*(.+)$/); return m ? `${ORD_AR[+m[1]]} ${m[2]}` : String(g || ""); };
// المواد الأساسية أولاً بالترتيب المعتاد في المدارس المصرية
const SUBJ_RANK = ["عربي", "نحو", "نحو وصرف", "بلاغة", "إنجليزي", "رياضيات", "ماث", "علوم", "ساينس", "علوم متكاملة", "دراسات", "تاريخ", "جغرافيا", "فيزياء", "كيمياء", "أحياء", "رياضيات بحتة", "رياضيات تطبيقية", "رياضيات أدبي", "إحصاء", "فرنساوي", "ألماني", "دين", "فقه شافعي", "توحيد", "تفسير", "حديث", "أصول دين", "فلسفة ومنطق", "علم نفس", "حاسب آلي", "أي سي تي", "تكنولوجيا", "ديسكفري", "مهارات"];
const subjRank = s => { const i = SUBJ_RANK.indexOf(s); return i < 0 ? 99 : i; };
const SCHOOL_TONE = { حكومي: "bg-sky-50 text-sky-700 ring-sky-200", لغات: "bg-emerald-50 text-emerald-700 ring-emerald-200", أزهر: "bg-amber-50 text-amber-800 ring-amber-200" };
const schoolBadges = t => String(t || "").split(/[،,]/).map(x => x.trim()).filter(Boolean).map(x => `<span class="inline-flex items-center rounded-md px-1.5 h-5 text-[10.5px] font-bold ring-1 ${SCHOOL_TONE[x] || "bg-slate-50 text-slate-600 ring-slate-200"}">${esc(x)}</span>`).join("");
/** شهرة الناشر = عدد عناوينه في الكتالوج (الناشرون الكبار أولاً) */
function pubRank() { if (Emp._pr && Emp._pr.n === APP.emp.books.length) return Emp._pr.m; const m = {}; APP.emp.books.forEach(b => m[b.Publisher] = (m[b.Publisher] || 0) + 1); Emp._pr = { n: APP.emp.books.length, m }; return m; }
function sortBooks(list) {
  const pr = pubRank(), go = gradeOrder();
  return list.slice().sort((a, b) => ((go[a.Grade] ?? 99) - (go[b.Grade] ?? 99))
    || (subjRank(a.Subject) - subjRank(b.Subject)) || String(a.Subject).localeCompare(String(b.Subject), "ar")
    || ((a.Book_Status === "Pricing") - (b.Book_Status === "Pricing")) || (n(b.Pop) - n(a.Pop)) || ((pr[b.Publisher] || 0) - (pr[a.Publisher] || 0)) || String(a.Book_ID).localeCompare(String(b.Book_ID)));
}
/** «الأكثر حجزاً»: نسبة الزملاء الذين اختاروا الكتاب من بين كتب نفس المادة والصف */
const POP_MIN = 3;
function popInfo(b) {
  if (!n(b.Pop)) return null;
  const same = APP.emp.books.filter(x => x.Grade === b.Grade && x.Subject === b.Subject), tot = same.reduce((a, x) => a + n(x.Pop), 0);
  if (tot < POP_MIN) return null;
  return { top: n(b.Pop) === Math.max(...same.map(x => n(x.Pop))), pct: Math.round(n(b.Pop) / tot * 100), n: n(b.Pop) };
}
// نوع المدرسة + الشعبة (علمي/أدبي/بكالوريا…): كتاب بلا شعبة = مشترك لكل الشعب، وابن بلا شعبة يرى كل كتب صفه
const trackOk = (b, tr) => !tr || !String(b.Tracks || "").trim() || String(b.Tracks).split(/[،,]/).map(x => x.trim()).includes(tr);
const typeOk = (b, t, tr) => (!t || String(b.School_Types || "").split(/[،,]/).map(x => x.trim()).includes(t)) && trackOk(b, tr === undefined ? Emp.filter.track : tr);
const gradeTracks = g => (((APP.emp && APP.emp.settings) || {}).GRADE_TRACKS || {})[g] || [];
// ============================================================ أبنائي (محفوظون في حساب الموظف على الخادم)
const myKids = () => ((APP.emp && APP.emp.employee && APP.emp.employee.kids) || []).filter(k => k.grade);
const kidEmoji = k => k.rel ? "🧒" : k.gender === "g" ? "👧" : "👦";
const kidName = (k, i) => k.name || (k.gender === "g" ? "ابنتي" : "ابني") + (i ? " " + (i + 1) : "");
/** اسم المستفيد في الحجز: فارغ لأبناء الموظف، و«الاسم — الصلة» للقريب */
const kidBen = k => k && k.rel ? String(k.name).trim() + " — " + k.rel : "";
const RELS = ["ابن أخ", "ابنة أخ", "ابن أخت", "ابنة أخت", "حفيد", "حفيدة", "أخ", "أخت", "ابن عم", "ابنة عم", "ابن خال", "ابنة خال", "أخرى"];
/** النوع من صلة القرابة تلقائياً (ابن/أخ/حفيد ← ولد، ابنة/أخت/حفيدة ← بنت)؛ «أخرى» يختارها الموظف */
const relGender = r => /^(ابنة|بنت|أخت|حفيدة)/.test(String(r || "")) ? "g" : r && r !== "أخرى" ? "b" : null;
const kidTypeTxt = t => t ? "مدارس " + t : "كل المدارس";
/** كم كتاب في السلة لصف هذا الابن */
const kidCartCount = k => Object.keys(APP.cart || {}).filter(id => { const b = (APP.emp.books || []).find(x => x.Book_ID === bk(id)); return b && (k.rel ? bn(id) === kidBen(k) : b.Grade === k.grade && !bn(id)); }).reduce((s, id) => s + APP.cart[id], 0);
const kidAvail = k => (APP.emp.books || []).filter(b => b.Grade === k.grade && typeOk(b, k.type, k.track || "")).length;
function openKid(i) { const k = myKids()[i]; if (!k) return; Emp.filter.grade = k.grade; Emp.filter.type = k.type || ""; Emp.filter.track = k.track || ""; Emp.filter.q = ""; Emp.kidIx = i;
  Emp.ben = kidBen(k); if (Emp.ben && !Emp.bens.includes(Emp.ben)) Emp.bens.push(Emp.ben); if (Router.current !== "/e/books") Router.go("/e/books"); else Shell.rerender(); scrollTo({ top: 0 }); }
on("pickKid", v => openKid(+v));
/** اختيار فرد تاني من أي مكان في الصفحة (بدل الطلوع لفوق) */
function kidSwitchHTML() {
  const ks = myKids(), c = curKid();
  return `<div class="grid grid-cols-2 gap-2">${ks.map((k, i) => { const on = c && c.i === i, n2 = kidCartCount(k);
    return `<button type="button" class="text-right rounded-2xl p-3 ring-1 flex items-center gap-2.5 transition active:scale-[.98] ${on ? "bg-brand-700 text-white ring-brand-700" : k.rel ? "bg-sky-50 ring-sky-200" : "bg-white ring-slate-200"}" data-kid-go="${i}">
      <span class="w-10 h-10 rounded-xl flex items-center justify-center text-[22px] shrink-0 ${on ? "bg-white/15" : "bg-gold-50"}">${kidEmoji(k)}</span>
      <span class="min-w-0 leading-tight"><b class="block text-[13.5px] truncate">${esc(kidName(k, i))}</b><span class="block text-[11px] truncate ${on ? "text-brand-100" : "text-slate-500"}">${esc(gradeShort(k.grade))}${n2 ? ` · <b class="num">${n2}</b> كتاب ✓` : " · لسه"}</span></span></button>`; }).join("")}</div>`;
}
function kidSwitchSheet() {
  const t = Emp.totals();
  const m = UI.open(`<p class="text-[13px] text-slate-500 mb-3">${gTxt("اختار مين تكمّل له الحجز", "اختاري مين تكمّلي له الحجز")}</p>${kidSwitchHTML()}`,
    { title: "👨‍👩‍👧 تحجز لمين دلوقتي؟", footer: t.count ? `<button class="btn btn-primary btn-lg w-full" data-kid-done>${ic("check-check")} ${gTxt("خلّصت — راجع وأكّد الحجز", "خلّصت — راجعي وأكّدي الحجز")} (${booksWord(t.count)})</button>` : "" });
  m.root.querySelectorAll("[data-kid-go]").forEach(b => b.onclick = () => { m.close(); setTimeout(() => openKid(+b.dataset.kidGo), 200); });
  const d = m.root.querySelector("[data-kid-done]"); if (d) d.onclick = () => { m.close(); setTimeout(() => ACTIONS.openCart(), 200); };
}
// شريط «جارٍ الحجز لـ…» يظهر بس بعد ما بطاقة الصف تختفي من الشاشة (منع تكرار المعلومة فوق)
addEventListener("scroll", () => { const c = document.getElementById("ctxStick"); if (!c || c.dataset.fx) return; c.dataset.fx = 1; const st = $("#bkSticky"), g = $("#bookGrid"); if (st && g) g.style.setProperty("--subjTop", (64 + st.offsetHeight) + "px"); }, { passive: true });
on("famTop", () => myKids().length > 1 ? kidSwitchSheet() : scrollTo({ top: 0, behavior: "smooth" }));
on("kidSwitch", () => kidSwitchSheet());
/** بطاقة آخر القائمة: خلّصت كتب الفرد ده؟ كمّل لفرد تاني أو أكّد */
function nextKidCard() {
  const ks = myKids(), c = curKid(); if (!c || !Emp.open() || Emp.wzManual) return "";
  const others = ks.map((k, i) => ({ k, i })).filter(x => x.i !== c.i), t = Emp.totals(), done = kidCartCount(c.k);
  return `<section class="rounded-3xl p-4 my-5 ring-1 ring-brand-200 shadow-soft" style="background:linear-gradient(135deg,#faf7ff,#f1e9fc)">
    <div class="flex items-center gap-3"><span class="w-11 h-11 rounded-2xl bg-white flex items-center justify-center text-[24px] shadow-xs">${kidEmoji(c.k)}</span>
      <div class="flex-1 min-w-0"><b class="block text-[15px] text-brand-950">${done ? `كتب ${esc(kidName(c.k, c.i))} في السلة: ${booksWord(done)} ✓` : `${gTxt("خلّصت", "خلّصتي")} كتب ${esc(kidName(c.k, c.i))}؟`}</b><span class="block text-[12px] text-brand-800/70">${others.length ? gTxt("كمّل لفرد تاني من هنا على طول — أو أكّد من زر «إتمام الحجز» تحت", "كمّلي لفرد تاني من هنا على طول — أو أكّدي من زر «إتمام الحجز» تحت") : gTxt("لو خلّصت أكّد من زر «إتمام الحجز» تحت", "لو خلّصتي أكّدي من زر «إتمام الحجز» تحت")}</span></div></div>
    ${others.length ? `<div class="flex gap-2 overflow-x-auto mt-3 pb-1" style="scrollbar-width:none">${others.map(x => { const n2 = kidCartCount(x.k);
      return `<button type="button" class="shrink-0 flex items-center gap-2 rounded-2xl bg-white ring-1 ${x.k.rel ? "ring-sky-200" : "ring-brand-200"} px-3 py-2 active:scale-95 transition" data-act="pickKid" data-id="${x.i}"><span class="text-[20px]">${kidEmoji(x.k)}</span><span class="text-right leading-tight"><b class="block text-[13px] text-slate-900">${esc(kidName(x.k, x.i))}</b><span class="block text-[10.5px] ${n2 ? "text-emerald-600 font-bold" : "text-slate-500"}">${n2 ? n2 + " كتاب ✓" : esc(gradeShort(x.k.grade)) + " · ابدأ ←"}</span></span></button>`; }).join("")}</div>` : ""}
  </section>`;
}

/** شريط الأبناء (الرئيسية وصفحة الحجز) */
function kidsStrip(compact) {
  const ks = myKids();
  const chip = (k, i) => { const on = Emp.filter.grade === k.grade && (Emp.filter.type || "") === (k.type || "") && Emp.ben === kidBen(k), c = kidCartCount(k);
    return `<button class="min-w-0 w-full flex items-center gap-2 rounded-2xl pl-2 pr-1.5 py-1.5 ring-1 transition active:scale-95 ${on ? "bg-brand-700 text-white ring-brand-700 shadow-glow" : "bg-white text-slate-700 ring-slate-200"}" data-act="pickKid" data-id="${i}">
      <span class="w-9 h-9 shrink-0 rounded-xl ${on ? "bg-white/15" : "bg-gold-50"} flex items-center justify-center text-[20px]">${kidEmoji(k)}</span>
      <span class="min-w-0 text-right leading-tight"><span class="block font-bold text-[13px] truncate">${esc(kidName(k, i))}</span><span class="block text-[11px] truncate ${on ? "text-brand-100" : "text-slate-500"}">${k.rel ? esc(k.rel) + " · " : ""}${esc(gradeShort(k.grade))}${c ? ` · <b class="num">${c}</b> في السلة` : ""}</span></span></button>`; };
  const kids = ks.map((k, i) => [k, i]).filter(x => !x[0].rel), rels = ks.map((k, i) => [k, i]).filter(x => x[0].rel);
  return `<div class="space-y-2 ${compact ? "" : "mt-1"}">
    ${kids.length ? `<div class="grid grid-cols-2 gap-2">${kids.map(x => chip(x[0], x[1])).join("")}</div>` : ""}
    ${rels.length ? `<div class="grid grid-cols-2 gap-2">${rels.map(x => chip(x[0], x[1])).join("")}</div>` : ""}
    <div class="grid grid-cols-2 gap-2"><button class="justify-center flex items-center gap-1.5 rounded-2xl px-3 py-2 border-2 border-dashed border-brand-300 text-brand-700 bg-brand-50/50 text-[13px] font-bold" data-act="kidsEdit">${ic(ks.length ? "pencil" : "plus")} ${ks.length ? "إضافة وتعديل" : "أضف أبنائي"}</button>${relOn() ? `<button class="justify-center flex items-center gap-1.5 rounded-2xl px-3 py-2 border-2 border-dashed border-sky-300 text-sky-700 bg-sky-50/50 text-[13px] font-bold" data-act="addRel">${ic("users")} إضافة قريب</button>` : ""}</div></div>`;
}

// ---------------- محرّر الأبناء: خطوات قصيرة لكل ابن ----------------
const empGender = () => (APP.emp && APP.emp.employee && APP.emp.employee.gender) || (APP.user && APP.user.gender) || "M";
const gTxt = (m, f) => empGender() === "F" ? f : m;
const KD = { list: [], i: 0, m: null };
const kdBlank = rel => ({ name: "", gender: "b", grade: "", type: "", rel: rel ? "ابن أخ" : "", _nameOk: false, _trackOk: false, _typeOk: false });
function kdHTML() {
  const cat = APP.emp.catalog || {}, stages = uniq((cat.grades || []).map(g => g.stage)), k = KD.list[KD.i] || kdBlank();
  const st = k._stage || ((cat.grades || []).find(g => g.label === k.grade) || {}).stage || "";
  const tracks = k.grade ? gradeTracks(k.grade) : [];
  const nameDone = !!k._nameOk; // خطوة «مين؟» أولاً لكل فرد (الاسم اختياري للأبناء وإجباري للقريب)
  const trackDone = !tracks.length || !!k._trackOk; // «تغيير» يعيد الخطوة فعلاً حتى لو فيه قيمة قديمة
  const typeDone = !!(k.grade && trackDone && k._typeOk);
  const done = KD.list.filter(x => x.grade).length;
  const types = [["حكومي", "building-2", "عربي"], ["لغات", "graduation-cap", "تجريبي / لغات"], ["أزهر", "book-marked", "معاهد أزهرية"], ["", "layout-grid", "اعرض الكل"]];
  const who = k.rel ? esc(relYou(k.rel)) + (k.name ? " " + esc(k.name) : "") : (k.gender === "g" ? "👧 بنتك" : "👦 ابنك") + (k.name ? " " + esc(k.name) : "");
  const whoBody = `<div class="seg ${relOn() ? "grid-cols-3" : "grid-cols-2"} !bg-white ring-1 ring-slate-200">${[["b", "👦 ابني"], ["g", "👧 بنتي"]].concat(relOn() ? [["rel", "🧒 قريب"]] : []).map(o => `<button data-act="kdKind" data-id="${o[0]}" aria-pressed="${o[0] === "rel" ? !!k.rel : !k.rel && k.gender === o[0]}">${o[1]}</button>`).join("")}</div>
    ${k.rel ? `<div><div class="label">صلة القرابة</div><div class="flex flex-wrap gap-1.5">${RELS.map(r => `<button class="chip !h-8 !text-xs" data-act="kdRel" data-id="${esc(r)}" aria-pressed="${k.rel === r}">${esc(r)}</button>`).join("")}</div>
      <p class="text-[11.5px] text-slate-500 mt-1.5">${ic("info", "inline -mt-0.5")} كتب القريب تُحسب على حسابك وتظهر باسمه في الطلب.</p></div>` : ""}
    <div class="grid grid-cols-[1fr_auto] gap-2 items-end">
      <div><label class="label" for="kdName">الاسم ${k.rel ? `<span class="text-rose-500">*</span>` : `<span class="text-slate-400 font-normal">(اختياري)</span>`}</label><input id="kdName" class="input" maxlength="30" placeholder="${k.gender === "g" ? "مثلاً: مريم" : "مثلاً: محمد"}" value="${esc(k.name)}" data-input="kdName" autocomplete="off"></div>
      ${k.rel && !relGender(k.rel) ? `<div class="seg grid-cols-2 !bg-white ring-1 ring-slate-200">${[["b", "👦 ولد"], ["g", "👧 بنت"]].map(g => `<button data-act="kdGender" data-id="${g[0]}" aria-pressed="${k.gender === g[0]}" class="!px-3">${g[1]}</button>`).join("")}</div>` : ""}
    </div>
    <button type="button" data-act="kdConfirmName" class="btn btn-primary w-full justify-center">التالي ←</button>`;
  const steps = [{ id: "who", t: "الفرد", q: gTxt("مين اللي هتحجز له؟", "مين اللي هتحجزي له؟"), done: nameDone, v: who, body: whoBody },
    { id: "stage", t: "المرحلة", q: "في أي مرحلة دراسية؟", done: nameDone && !!st, v: esc(st), body: `<div class="grid grid-cols-2 gap-2">${stages.map(s => `<button class="rounded-2xl px-3 py-3 text-[13.5px] font-bold ring-1 transition bg-white text-slate-700 ring-slate-200 active:scale-95" data-act="kdStage" data-id="${esc(s)}">${esc(s.replace("المرحلة ", ""))}</button>`).join("")}</div>` },
    { id: "grade", t: "الصف", q: "في سنة كام؟", done: !!k.grade, v: esc(gradeTitle(k.grade || "")), body: `<div class="grid grid-cols-3 gap-2">${(cat.grades || []).filter(g => g.stage === st).map(g => `<button class="h-12 rounded-xl text-[14px] font-bold ring-1 transition bg-white text-slate-700 ring-slate-200 active:scale-95" data-act="kdGrade" data-id="${esc(g.label)}">${esc(gradeShort(g.label))}</button>`).join("")}</div>` }]
    .concat(tracks.length ? [{ id: "track", t: "الشعبة", q: "الشعبة إيه؟", done: !!k.grade && trackDone, v: esc(k.track || "لسه مش محددة"), body: `<p class="text-[11.5px] text-slate-500 -mt-1">نعرض كتب الشعبة + الكتب المشتركة</p><div class="grid grid-cols-2 gap-2">${tracks.concat([""]).map(t => `<button class="rounded-2xl px-3 py-2.5 text-[13px] font-bold ring-1 transition text-right bg-white text-slate-700 ring-slate-200 active:scale-95" data-act="kdTrack" data-id="${esc(t)}">${t ? esc(t) : "لسه مش عارف"}</button>`).join("")}</div>` }] : [])
    .concat([{ id: "type", t: "نوع المدرسة", q: "نوع المدرسة؟", done: typeDone, v: esc(k.type || "كل المدارس"), body: `<div class="grid grid-cols-2 gap-2">${types.map(t => `<button class="rounded-2xl p-2.5 text-right ring-1 transition flex items-center gap-2 active:scale-95 ${(k.type || "") === t[0] && t[0] ? "bg-brand-50 ring-2 ring-brand-600" : "bg-white ring-slate-200"}" data-act="kdType" data-id="${esc(t[0])}">
        <span class="w-8 h-8 rounded-lg flex items-center justify-center ${t[0] ? (SCHOOL_TONE[t[0]] || "") : "bg-slate-100 text-slate-500"}">${ic(t[1])}</span><span class="leading-tight"><span class="block font-bold text-[13.5px] text-slate-800">${esc(t[0] || "لا أعرف")}</span><span class="block text-[11px] text-slate-500">${esc(t[2])}</span></span></button>`).join("")}</div>` }]);
  const curIx = steps.findIndex(x => !x.done), cur = steps[curIx];
  return `
  <div class="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1">${KD.list.map((x, i) => `<button class="shrink-0 flex flex-col items-center gap-1 w-16" data-act="kdPick" data-id="${i}">
      <span class="w-14 h-14 rounded-2xl flex items-center justify-center text-[28px] transition ${i === KD.i ? "bg-brand-700 ring-4 ring-brand-100" : x.grade ? "bg-gold-100" : "bg-slate-100"}">${kidEmoji(x)}</span>
      <span class="text-[11px] font-semibold truncate w-full text-center ${i === KD.i ? "text-brand-800" : "text-slate-500"}">${esc(x.name || (x.rel ? "قريب" : "ابن " + (i + 1)))}</span></button>`).join("")}
    ${KD.list.length < 12 ? `<button class="shrink-0 flex flex-col items-center gap-1 w-16" data-act="kdAdd"><span class="w-14 h-14 rounded-2xl border-2 border-dashed border-brand-300 text-brand-600 flex items-center justify-center text-2xl">${ic("plus")}</span><span class="text-[11px] font-semibold text-brand-700">إضافة</span></button>` : ""}</div>

  <div class="rounded-3xl bg-white ring-1 ring-slate-200 shadow-xs p-4 mt-2 space-y-3" id="kdCard">
    <div class="flex items-center justify-between gap-2"><b class="text-[14.5px] text-slate-900">${k.grade && k._saved ? "تعديل " + esc(k.name || (k.rel ? "القريب" : k.gender === "g" ? "البنت" : "الابن")) : k.rel ? "قريب جديد" : k.gender === "g" ? "بنت جديدة" : "ابن جديد"}</b>
      ${!typeDone ? `<span class="text-[11.5px] font-semibold text-slate-500">خطوة <b class="num text-brand-700">${curIx + 1}</b> من <span class="num">${steps.length}</span></span>` : `<span class="text-[11.5px] font-bold text-emerald-700">${ic("circle-check", "inline -mt-0.5")} اكتملت البيانات</span>`}</div>
    <div class="flex gap-1">${steps.map((x, i) => `<span class="h-1.5 flex-1 rounded-full ${x.done ? "bg-emerald-500" : i === curIx ? "bg-brand-600" : "bg-slate-200"}"></span>`).join("")}</div>
    ${steps.filter(x => x.done).map(x => `<div class="flex items-center gap-2.5 rounded-2xl bg-slate-50 px-3 py-2"><span class="w-6 h-6 shrink-0 rounded-full bg-emerald-500 text-white flex items-center justify-center">${ic("check", "!w-3.5 !h-3.5")}</span>
      <span class="min-w-0 flex-1 leading-tight"><span class="block text-[10.5px] text-slate-500">${x.t}</span><span class="block text-[13px] font-bold text-slate-800 truncate">${x.v}</span></span>
      <button type="button" class="text-[12px] font-semibold text-brand-700 px-2 py-1 rounded-lg hover:bg-brand-50" data-act="kdGoStep" data-id="${x.id}">تغيير</button></div>`).join("")}
    ${cur ? `<div class="animate-pop-in rounded-2xl ring-2 ring-brand-100 bg-brand-50/30 p-3.5 space-y-3"><div class="text-[14px] font-bold text-slate-900">${cur.q}</div>${cur.body}</div>` : ""}
    ${typeDone ? `<div class="animate-pop-in rounded-2xl bg-white ring-1 ring-emerald-200 p-3.5 space-y-3 shadow-xs">
      <div class="flex items-start gap-2 text-[13px] text-emerald-800">${ic("sparkles", "text-gold-500 shrink-0 mt-0.5")} <span>${k.rel ? esc(relYou(k.rel)) + " " : k.gender === "g" ? "بنتك " : "ابنك "}<b>${esc(k.name || "")}</b> في <b>${esc(gradeTitle(k.grade))}</b>${k.track ? " (" + esc(k.track) + ")" : ""}${k.type ? " · " + esc(k.type) : ""} — ${kidAvail(k) ? `جاهز له <b class="num">${kidAvail(k)}</b> كتاب بخصم العاملين` : "نعرض له كتب صفه فور تسعيرها"}</span></div>
      <div class="pt-2 border-t border-slate-100">
        <div class="text-[12.5px] font-bold text-slate-800 mb-2">${gTxt("تحب تحفظ على كده ولا هتعدّل البيانات؟", "تحبي تحفظي على كده ولا هتعدّلي البيانات؟")}</div>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" data-act="kdSave" class="btn btn-primary btn-sm justify-center">${ic("check-check")} حفظ على كده</button>
          <button type="button" data-act="kdAdd" class="btn btn-outline btn-sm justify-center">${ic("plus")} ${gTxt("إضافة ابن تاني", "إضافة ابن تاني")}</button>
        </div>
        <button type="button" data-act="kdEditAgain" class="w-full text-center text-[11.5px] font-semibold text-slate-500 hover:text-brand-700 mt-2">✏️ تعديل البيانات</button>
      </div>
    </div>` : ""}
  </div>
  ${(KD.list.length > 1 || k.grade) ? `<button class="btn btn-ghost btn-sm text-rose-600 mt-2" data-act="kdDel">${ic(k._saved ? "trash-2" : "x")} ${k._saved ? "حذف" : "إلغاء إضافة"} ${esc(k.name || (k.rel ? "هذا القريب" : k.gender === "g" ? "هذه البنت" : "هذا الابن"))}</button>` : ""}
  <div class="text-center text-[12px] text-slate-400 mt-2">${done} من ${KD.list.length} جاهز · بياناتك تُحفظ في حسابك وتنتقل معك لأي جهاز</div>`;
}
const kdRender = () => { if (KD.m && KD.m.body) { KD.m.body.innerHTML = kdHTML(); const b = KD.m.root.querySelector("[data-act=kdSave]"); if (b) { const n2 = KD.list.filter(x => x.grade).length; b.disabled = !n2; } } };
function kidsEditor(addRel, opt) { opt = opt || {};
  const ks = (APP.emp.employee.kids || []).map(k => ({ name: k.name || "", gender: k.gender || "b", grade: k.grade || "", type: k.type || "", track: k.track || "", rel: k.rel || "", _nameOk: true, _trackOk: true, _typeOk: true, _saved: true, _origGrade: k.grade || "", _origBen: kidBen(k) }));
  KD.list = ks.length ? ks : [kdBlank(addRel)];
  if (addRel && ks.length) KD.list.push(kdBlank(true));
  if (opt.addNew && ks.length) KD.list.push(kdBlank());
  KD.i = addRel || opt.addNew ? KD.list.length - 1 : Math.max(0, KD.list.findIndex(k => !k.grade));
  if (opt.kid) { const t = opt.kid, j = KD.list.findIndex(x => x.name === (t.name || "") && x.rel === (t.rel || "") && x.grade === t.grade); if (j >= 0) KD.i = j; }
  KD.m = UI.open(kdHTML(), { title: addRel ? "🧒 إضافة قريب" : opt.kid ? "✏️ تعديل بيانات " + (opt.kid.name || (opt.kid.gender === "g" ? "البنت" : "الابن")) : opt.addNew ? "➕ إضافة فرد جديد" : "👨‍👩‍👧 أبنائي وأقاربي", sub: "خطوة بخطوة — ونجهّز لكل واحد كتب صفه تلقائياً",
    footer: `<button class="btn btn-primary btn-lg w-full" data-act="kdSave">${ic("check-check")} حفظ الكل</button>` });
  kdRender();
}
on("kidsEdit", () => { KD._addRel = false; kidsEditor(false); });
/** تعديل فرد مسجّل بعينه (الاسم/المرحلة/الصف/الشعبة/المدرسة) — يفتح المحرر عليه مباشرة */
on("kdEditOne", i => { const k = myKids()[+i]; if (!k) return; KD._addRel = false; kidsEditor(false, { kid: k }); });
on("kidsAddNew", () => { KD._addRel = false; kidsEditor(false, { addNew: true }); });
on("addRel", () => { KD._addRel = true; kidsEditor(true); });
on("kdKind", v => { const k = KD.list[KD.i]; if (v === "rel") { k.rel = k.rel || (k.gender === "g" ? "ابنة أخ" : "ابن أخ"); k.gender = relGender(k.rel) || k.gender; } else { k.rel = ""; k.gender = v; } kdRender(); });
on("kdRel", v => { const k = KD.list[KD.i]; k.rel = v; const g = relGender(v); if (g) k.gender = g; kdRender(); });
on("kdName", v => { (KD.list[KD.i] || {}).name = v; });
on("kdConfirmName", () => { const k = KD.list[KD.i]; if (!k) return; if (k.rel && !(k.name || "").trim()) return toast(gTxt("اكتب اسم القريب الأول", "اكتبي اسم القريب الأول"), "warning"); k._nameOk = true; kdRender(); });
on("kdGender", v => { KD.list[KD.i].gender = v; kdRender(); });
on("kdStage", v => { const k = KD.list[KD.i]; k._nameOk = true; k._stage = v; if (k.grade && !(APP.emp.catalog.grades || []).some(g => g.label === k.grade && g.stage === v)) { k.grade = ""; k.track = ""; k._trackOk = false; k._typeOk = false; } kdRender(); });
on("kdGrade", v => { const k = KD.list[KD.i]; k._nameOk = true; k.grade = v; if (!gradeTracks(v).includes(k.track)) k.track = ""; k._trackOk = false; k._typeOk = false; kdRender(); });
on("kdTrack", v => { const k = KD.list[KD.i]; k.track = v; k._trackOk = true; kdRender(); if (navigator.vibrate) navigator.vibrate(8); });
on("kdType", v => { const k = KD.list[KD.i]; k.type = v; k._typeOk = true; kdRender(); if (navigator.vibrate) navigator.vibrate(8); });
on("kdEditAgain", () => { const k = KD.list[KD.i]; if (!k) return; k._nameOk = false; k._trackOk = false; k._typeOk = false; kdRender(); });
on("kdPick", v => { KD.i = +v; kdRender(); kdTop(); });
const kdTop = () => { const c = KD.m && KD.m.root && KD.m.root.querySelector("#kdCard"); if (c && c.scrollIntoView) c.scrollIntoView({ block: "start", behavior: "smooth" }); };
on("kdGoStep", v => { const k = KD.list[KD.i]; if (!k) return;
  if (v === "who") k._nameOk = false;
  if (v === "stage") { k._stage = ""; k.grade = ""; k.track = ""; k._trackOk = false; k._typeOk = false; }
  if (v === "grade") { k._stage = k._stage || ((APP.emp.catalog.grades || []).find(g => g.label === k.grade) || {}).stage || ""; k.grade = ""; k.track = ""; k._trackOk = false; k._typeOk = false; }
  if (v === "track") { k.track = ""; k._trackOk = false; k._typeOk = false; }
  if (v === "type") k._typeOk = false;
  kdRender(); });
// إضافة فرد جديد: دايماً بطاقة جديدة فاضية (لو فيه فرد جديد لسه ناقص نفتحه هو بدل ما نكرر)
on("kdAdd", () => { const open = KD.list.findIndex(x => !x.grade && !x._saved);
  if (open >= 0) KD.i = open; else { KD.list.push(kdBlank()); KD.i = KD.list.length - 1; }
  kdRender(); kdTop(); const inp = KD.m && KD.m.root.querySelector("#kdName"); if (inp) setTimeout(() => inp.focus(), 250); });
/** حذف فرد من العيلة: يُحفظ فوراً على الخادم، ويوضح أثره على حجز المرحلة الحالية، ولا يمس السجل التاريخي للمراحل السابقة */
on("kdDel", async () => {
  const k = KD.list[KD.i]; if (!k) return;
  if (!k._saved) { KD.list.splice(KD.i, 1); if (!KD.list.length) KD.list.push(kdBlank()); KD.i = Math.max(0, Math.min(KD.i, KD.list.length - 1)); return kdRender(); } // فرد جديد لم يُحفظ: إلغاء بلا أثر
  const nm = k.name || (k.rel ? "القريب" : k.gender === "g" ? "بنتك" : "ابنك"), r = APP.emp, bm = Emp.bookMap(), ben = kidBen(k);
  const same = x => (x.name || "") === (k.name || "") && (x.rel || "") === (k.rel || "") && x.grade === k.grade && (x.gender || "b") === (k.gender || "b");
  const saved = (r.employee.kids || []).some(same);
  // كتب الابن تُعرف بالصف (أبناؤك) أو بالاسم (القريب) — لو فاضل ابن تاني بنفس الصف تفضل كتب الصف له
  const sharedGrade = !ben && KD.list.some((x, ix) => ix !== KD.i && !x.rel && x.grade === k.grade);
  const mine = (bid, b2) => ben ? b2 === ben : (!b2 && (bm[bid] || {}).Grade === k.grade);
  const its = (r.myReservationItems || []).filter(i => mine(i.Book_ID, i.Beneficiary) && !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward" && n(i.Requested_Qty) > 0);
  const cur = its.filter(i => i.Phase_ID === APP.phaseId), old = its.filter(i => i.Phase_ID !== APP.phaseId);
  const keys = k.grade && !sharedGrade ? Object.keys(APP.cart || {}).filter(key => mine(bk(key), bn(key))) : [];
  const cnt = keys.reduce((s2, key) => s2 + n(APP.cart[key]), 0), val = keys.reduce((s2, key) => s2 + n(APP.cart[key]) * n((bm[bk(key)] || {}).Emp_Selling_Price), 0);
  const open = Emp.open(), delivered = cur.some(i => n(i.Delivered_Qty) > 0), invoiced = (r.myInvoices || []).some(i => i.Phase_ID === APP.phaseId);
  const msg = [];
  if (open && cnt) msg.push(`• حجز ${nm} في المرحلة دي (${booksWord(cnt)} · ${moneyTxt(val)}) هيتلغي، وحجزك هيتحدث تلقائياً — باقي أفراد العيلة زي ما هم.`);
  else if (!open && cur.length && !sharedGrade) msg.push(delivered ? `• ${nm} استلم كتب في المرحلة دي — مش هيتلغي حاجة منها. لو عايز ترجّع كتاب استخدم «مرتجعاتي».`
    : `• الحجز في المرحلة دي اتقفل${invoiced ? " واتوزّع واتعملت الفاتورة" : " وطلب التوريد بيتجهز للمكتبة"} — كتب ${nm} هتفضل محجوزة وفاتورتك زي ما هي. لإلغائها كلّم المسؤول من «طلب إلغاء».`);
  if (sharedGrade && (cnt || cur.length)) msg.push(`• كتب ${gradeTitle(k.grade)} هتفضل لأن عندك فرد تاني في نفس الصف.`);
  if (old.length) msg.push(`• سجله في المراحل اللي فاتت (${booksWord(old.reduce((s2, i) => s2 + n(i.Requested_Qty), 0))}) محفوظ زي ما هو ومش هيتمسح.`);
  if (!msg.length) msg.push(`• هيتشال ${nm} من قائمة العيلة، وتقدر تضيفه تاني في أي وقت.`);
  if (!(await UI.confirm({ title: "حذف " + nm + "؟", message: msg.join("\n"), ok: open && cnt ? "احذف وألغِ حجزه" : "احذف", tone: "danger", icon: "trash-2" }))) return;
  KD.list.splice(KD.i, 1); KD.i = Math.max(0, KD.i - 1);
  if (saved) {
    const kids = (r.employee.kids || []).filter(x => !same(x)).map(x => ({ name: x.name || "", gender: x.gender || "b", grade: x.grade, type: x.type || "", track: x.track || "", rel: x.rel || "" }));
    const res = await call("SAVE_MY_KIDS", { kids }, { block: true });
    if (!res.success) { toast(res.message, "danger"); KD.list.splice(KD.i, 0, k); return kdRender(); }
    r.employee.kids = kids.map(x => Object.assign({ promoted: 0 }, x));
  }
  if (!KD.list.length) KD.list.push(kdBlank());
  if (open && keys.length) {
    keys.forEach(key => delete APP.cart[key]); Emp.dirty = true;
    if (KD.m) { KD.m.close(); KD.m = null; }
    if (Emp.activeItems().length) { toast(`اتحذف ${nm} — بنحدّث حجزك…`, "info"); return ACTIONS.submitRes(); }
    refreshCartViews(); Shell.rerender(); return toast(`اتحذف ${nm} واتشالت كتبه من السلة`, "success");
  }
  kdRender(); Shell.rerender(); toast(`اتحذف ${nm} من العيلة`, "success");
});
on("kdSave", async () => {
  const kids = KD.list.filter(k => k.grade).map(k => ({ name: (k.name || "").trim(), gender: k.gender, grade: k.grade, type: k.type || "", track: gradeTracks(k.grade).includes(k.track) ? k.track : "", rel: k.rel || "" }));
  if (!kids.length) return toast("اختر الصف لفرد واحد على الأقل", "warning");
  const noName = kids.findIndex(k => k.rel && !k.name); if (noName >= 0) { KD.i = KD.list.indexOf(KD.list.filter(k => k.grade)[noName]); kdRender(); return toast("اكتب اسم القريب", "warning"); }
  const seen = {}, dup = kids.find(k => { const key = (k.name + "|" + k.rel).trim(); if (k.name && seen[key]) return true; seen[key] = 1; return false; });
  if (dup) return toast(`الاسم «${dup.name}» متكرر — غيّر واحد منهم`, "warning");
  // تغيير صف فرد مسجّل: كتب صفه القديم في السلة (المرحلة المفتوحة) تتشال — بعد ما نعرّفه
  const bm0 = Emp.bookMap(), gradeChg = KD.list.filter(k => k._saved && k._origGrade && k.grade && k.grade !== k._origGrade);
  const dropKeys = [];
  gradeChg.forEach(k => { const shared = !k.rel && KD.list.some(x => x !== k && !x.rel && x.grade === k._origGrade);
    if (shared) return;
    Object.keys(APP.cart || {}).forEach(key => { const b = bm0[bk(key)] || {}; if (b.Grade !== k._origGrade) return;
      if (k.rel ? bn(key) === k._origBen : !bn(key)) dropKeys.push(key); }); });
  if (dropKeys.length) {
    const nm = gradeChg.map(k => (k.name || (k.rel ? "القريب" : k.gender === "g" ? "بنتك" : "ابنك")) + ": " + gradeShort(k._origGrade) + " ← " + gradeShort(k.grade)).join("\n");
    const cnt = dropKeys.reduce((a, key) => a + n(APP.cart[key]), 0);
    if (!(await UI.confirm({ title: "تغيير الصف", icon: "graduation-cap", ok: "تمام، غيّر الصف",
      message: `${nm}\n\nكتب الصف القديم اللي في السلة (${booksWord(cnt)}) هتتشال من حجز المرحلة دي، وتختار${gTxt("", "ي")} كتب الصف الجديد بعدها.\nالمراحل اللي اتقفلت أو اتسلّمت مش هتتأثر.` }))) return;
  }
  const before = (APP.emp.employee.kids || []).map(k => Object.assign({}, k));
  const r = await call("SAVE_MY_KIDS", { kids }, { block: true });
  if (!r.success) return toast(r.message, "danger");
  // قريب اتغير اسمه أو صلته وكتبه في السلة: ننقل كتبه للاسم الجديد عشان الحجز يفضل مربوط بيه
  let moved = 0;
  before.filter(o => o.rel).forEach(o => { const oldBen = kidBen(o), nk = kids.find(k => k.rel && k.grade === o.grade && kidBen(k) !== oldBen && !before.some(b => kidBen(b) === kidBen(k)));
    if (!nk) return; Object.keys(APP.cart || {}).filter(key => bn(key) === oldBen).forEach(key => { const nkey = ck(bk(key), kidBen(nk)); APP.cart[nkey] = (APP.cart[nkey] || 0) + APP.cart[key]; delete APP.cart[key]; moved++; }); });
  if (moved) { Emp.dirty = true; Emp.bens = [...new Set(Object.keys(APP.cart).map(bn).filter(Boolean))]; }
  if (dropKeys.length) { dropKeys.forEach(key => delete APP.cart[key]); Emp.dirty = true; if (Emp.activeItems().length && typeof ACTIONS.submitRes === "function") setTimeout(() => ACTIONS.submitRes(), 500); }
  APP.emp.employee.kids = kids.map(k => Object.assign({ promoted: 0 }, k));
  if (KD.m) KD.m.close(); KD.m = null;
  const lbl = k => (k.name || (k.rel ? "قريب" : k.gender === "g" ? "بنتك" : "ابنك")), key = k => (k.name || "") + "|" + (k.rel || "") + "|" + k.grade;
  const added = kids.filter(k => !before.some(b => key(b) === key(k) || (b.name && b.name === k.name && b.rel === k.rel))), removed = before.filter(b => !kids.some(k => key(b) === key(k) || (b.name && b.name === k.name && b.rel === k.rel)));
  const msg = [added.length ? "اتضاف " + added.map(lbl).join(" و") : "", removed.length ? "اتشال " + removed.map(lbl).join(" و") : ""].filter(Boolean).join(" · ");
  toast((msg || (kids.length > 1 ? `اتحفظت عيلتك (${kids.length} أفراد)` : "اتحفظ")) + " 🎉" + (moved ? " — ونقلنا كتب القريب لاسمه الجديد، أكّد الحجز عشان يتحدث" : "") + (dropKeys.length ? " — واتشالت كتب الصف القديم" : ""), "success");
  const last = KD._addRel ? kids.length - 1 : 0;
  if (Router.current === "/e/wiz") { WZ.sel = null; wzSave(); setTimeout(() => Shell.rerender(), 350); return; }
  setTimeout(() => openKid(last), 350); // بعد اكتمال رجوع السجل الخاص بإغلاق النافذة
});

/** بطاقة «مساعد الحجز» في الرئيسية: خطوات الرحلة وموضعك الحالي فيها */
function wzHomeCard(reqQty) {
  let saved = null; try { saved = JSON.parse(localStorage.getItem(WZ_KEY())); } catch (_) {}
  const steps = [["users", "العائلة"], ["book-open", "الكتب"], ["list-checks", "المراجعة"], ["wallet", "السداد"]];
  const cur = saved ? ["family", "member", "review", "pay"].indexOf(saved.step) : reqQty ? 4 : -1;
  const title = saved ? "كمّل حجزك من مكانك 👋" : reqQty ? "حجزك جاهز — تقدر تراجعه في أي وقت" : "احجز في دقيقتين خطوة بخطوة";
  const cta = saved ? "كمّل الحجز" : reqQty ? "راجع وعدّل حجزك" : "ابدأ مع مساعد الحجز";
  return `<section class="mt-4 lg:mt-6 card overflow-hidden">
    <div class="p-4 sm:p-5 flex items-center gap-3 border-b border-slate-100">
      <span class="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white flex items-center justify-center text-[22px] shrink-0 shadow-glow">🧭</span>
      <div class="flex-1 min-w-0"><div class="text-[11.5px] font-bold text-brand-600">مساعد الحجز</div><h2 class="font-display font-bold text-[16.5px] text-slate-900 leading-snug">${title}</h2></div>
    </div>
    <ol class="grid grid-cols-4 gap-1 px-4 sm:px-5 pt-4">${steps.map((st, k) => `<li class="flex flex-col items-center text-center gap-1.5">
      <span class="w-10 h-10 rounded-full flex items-center justify-center text-[17px] ${k < cur ? "bg-brand-600 text-white" : k === cur ? "bg-gold-400 text-brand-950 ring-4 ring-gold-100" : "bg-slate-100 text-slate-400"}">${ic(k < cur ? "check" : st[0])}</span>
      <span class="text-[11.5px] font-semibold ${k <= cur ? "text-slate-800" : "text-slate-400"}">${st[1]}</span></li>`).join("")}</ol>
    <div class="p-4 sm:p-5 pt-4"><button class="btn btn-primary w-full !h-12 !text-[15px]" data-act="wizStart">${ic("chevron-left")} ${cta}</button></div>
  </section>`;
}
/** بطاقة الرئيسية: دعوة لإضافة الأبناء أو شريطهم أو تهنئة بالصف الجديد */
function kidsHomeCard() {
  const all = (APP.emp.employee && APP.emp.employee.kids) || [], ks = myKids(), promoted = all.filter(k => k.promoted);
  if (!all.length) return `<section class="mt-4 lg:mt-6 rounded-4xl p-5 relative overflow-hidden ring-1 ring-gold-200" style="background:linear-gradient(135deg,#fff8e6,#fde9b0)">
      <div class="absolute -left-6 -bottom-8 opacity-90 hidden sm:block">${Art.books("w-44 h-auto")}</div>
      <div class="relative sm:pl-40"><div class="text-[28px] leading-none">👦👧</div>
        <h2 class="font-display font-bold text-[19px] text-brand-950 mt-2">عرّفنا على أبنائك… ووفّر وقتك</h2>
        <ul class="mt-2 space-y-1 text-[13px] text-brand-900/80">
          <li class="flex gap-1.5">${ic("check", "text-emerald-600 mt-0.5")} كتب كل ابن جاهزة له بضغطة — بدون بحث</li>
          <li class="flex gap-1.5">${ic("check", "text-emerald-600 mt-0.5")} المواد الأساسية والأشهر أولاً لصفه ونوع مدرسته</li>
          <li class="flex gap-1.5">${ic("check", "text-emerald-600 mt-0.5")} ننقلهم للصف الجديد تلقائياً كل سنة</li></ul>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4"><button class="btn btn-primary" data-act="kidsEdit">${ic("plus")} أضف أبنائي — أقل من دقيقة</button>
          <a href="#/e/books" class="text-[13px] font-semibold text-brand-800 underline underline-offset-4">أو احجز مباشرة بدون تسجيل ←</a></div></div></section>`;
  return `${promoted.length ? `<section class="mt-4 lg:mt-6 rounded-3xl bg-emerald-50 ring-1 ring-emerald-200 p-4 flex items-center gap-3">
      <span class="text-[30px]">🎓</span><div class="flex-1 min-w-0"><b class="block text-emerald-900 text-[14.5px]">سنة دراسية جديدة! نقلنا أبناءك للصف التالي</b>
      <span class="block text-[12.5px] text-emerald-800/80 mt-0.5">${all.map((k, i) => esc(kidName(k, i)) + " ← " + esc(k.graduated ? "تخرّج 🎉" : gradeShort(k.grade))).join(" · ")}</span></div>
      <button class="btn btn-success btn-sm shrink-0" data-act="kidsEdit">راجع وأكّد</button></section>` : ""}
    <section class="card card-pad mt-4 lg:mt-6"><div class="flex items-center justify-between mb-2"><h2 class="card-title">${ic("users", "text-brand-600")} أبنائي${myKids().some(k => k.rel) ? " وأقاربي" : ""}</h2><span class="text-[12px] text-slate-400">اضغط على الاسم لعرض كتبه</span></div>${kidsStrip(true)}</section>`;
}

function bookCard(b) {
  const q = APP.cart[ck(b.Book_ID, Emp.ben)] || 0, open = Emp.open(), [c1, c2] = toneOf(b.Subject);
  const elsewhere = Object.keys(APP.cart).filter(k => bk(k) === b.Book_ID && bn(k) !== Emp.ben).reduce((s, k) => s + APP.cart[k], 0);
  const save = n(b.Cover_Price) ? Math.round((1 - n(b.Emp_Selling_Price) / n(b.Cover_Price)) * 100) : 0;
  const mx = n(APP.emp.settings.MAX_QTY_PER_BOOK) || 3, pricing = b.Book_Status === "Pricing";
  const title = String(b.Book_Name || "").replace(new RegExp("\\s*[—-]\\s*" + String(b.Subject || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "") || b.Book_Name;
  return `<article class="card p-3 flex gap-3 transition ${q ? "ring-2 ring-brand-500 bg-brand-50/40" : ""} " id="bk_${esc(b.Book_ID)}">
    ${!b.Cover_URL && pubLogo(b.Publisher, b.Subject) ? `<div class="shrink-0 w-[68px] h-[88px] rounded-xl overflow-hidden relative shadow-soft ring-1 ring-slate-200 bg-white flex flex-col">
      <span class="flex-1 flex items-center justify-center p-1.5"><img src="${esc(pubLogo(b.Publisher, b.Subject))}" alt="${esc(b.Publisher)}" loading="lazy" decoding="async" class="max-w-full max-h-full object-contain"></span>
      <span class="text-[9.5px] font-bold text-white text-center py-0.5" style="background:${c2}">${esc(b.Subject || "")}</span></div>`
    : b.Cover_URL ? `<button class="shrink-0 w-[68px] h-[88px] rounded-xl overflow-hidden relative shadow-soft ring-1 ring-slate-200 bg-slate-100" data-act="coverZoom" data-id="${esc(b.Book_ID)}" aria-label="تكبير الغلاف">
      <img src="${esc(b.Cover_URL)}" alt="غلاف ${esc(b.Book_Name)}" loading="lazy" decoding="async" class="w-full h-full object-cover">
      <span class="absolute bottom-0 inset-x-0 text-[9.5px] font-bold text-white text-center py-0.5" style="background:${c2}cc">${esc(b.Subject || "")}</span></button>`
    : `<div class="shrink-0 w-[68px] h-[88px] rounded-xl flex flex-col justify-between p-2 text-white relative overflow-hidden shadow-soft" style="background:linear-gradient(150deg,${c1},${c2})">
      <span class="absolute -left-3 -bottom-5 text-[70px] opacity-15">${ic("book-open")}</span>
      <span class="text-[10px] font-bold bg-white/25 rounded px-1 py-0.5 self-start leading-tight">${esc(b.Subject || "")}</span>
      <span class="text-[10px] font-semibold opacity-90 leading-tight">${esc(gradeShort(b.Grade))}</span>
    </div>`}
    <div class="flex-1 min-w-0 flex flex-col">
      <div class="flex items-start gap-2"><h3 class="flex-1 font-bold text-slate-900 leading-snug text-[15px] line-clamp-2">${esc(title)}</h3>${q ? `<span class="shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-[13px]">${ic("check")}</span>` : ""}</div>
      ${(() => { const p = popInfo(b); return p ? `<div class="flex items-center gap-1.5 mt-1 text-[11.5px] font-bold ${p.top ? "text-orange-600" : "text-slate-500"}">${p.top ? `<span class="inline-flex items-center gap-1 rounded-full bg-orange-50 ring-1 ring-orange-200 px-2 h-5">🔥 الأكثر حجزاً</span>` : ""}<span class="font-semibold">اختيار ${p.pct}% من الزملاء</span></div>` : ""; })()}
      <div class="flex flex-wrap items-center gap-1 mt-1">${b.Book_Part ? `<span class="inline-flex items-center rounded-md px-1.5 h-5 text-[10.5px] font-bold bg-brand-50 text-brand-700 ring-1 ring-brand-100">${esc(b.Book_Part)}</span>` : ""}${schoolBadges(b.School_Types)}${elsewhere ? pill("", `${elsewhere} لمستفيد آخر`, "blue") : ""}${b.Book_Status === "Not_Yet_Printed" ? pill("Not_Yet_Printed") : ""}</div>
      <div class="mt-auto pt-2 flex items-end justify-between gap-2">
        ${pricing ? `<div class="leading-tight text-[12px] text-amber-700 font-semibold">🚚 السعر جاي مع الشحنة<div class="text-[11px] text-slate-500 font-normal">احجز دلوقتي وخلّيك مطمّن 😉 بخصم العاملين برضه</div></div>`
        : `<div class="leading-tight"><span class="text-[11px] text-slate-400 line-through num">${fmt(b.Cover_Price)}</span>${save > 0 ? ` <span class="text-[11px] font-bold text-emerald-600">وفّر ${save}%</span>` : ""}
          <div><span class="text-[19px] font-bold text-brand-800 num">${fmt(b.Emp_Selling_Price)}</span> <span class="text-[11px] text-slate-500">ج.م</span></div></div>`}
        ${q ? `<div class="stepper"><button data-act="cartInc" data-id="${esc(b.Book_ID)}" ${!open || q >= mx ? "disabled" : ""} aria-label="زيادة">${ic("plus")}</button><span>${q}</span><button data-act="cartDec" data-id="${esc(b.Book_ID)}" ${open ? "" : "disabled"} aria-label="تقليل">${ic(q === 1 ? "trash-2" : "minus")}</button></div>`
          : `<button class="btn btn-primary btn-sm !px-3 shrink-0" data-act="cartInc" data-id="${esc(b.Book_ID)}" ${open ? "" : "disabled"}>${ic("plus")} أضف</button>`}
      </div>
    </div></article>`;
}
/** شاشة اختيار الصف: بطاقات كبيرة مجمعة حسب المرحلة */
function gradePicker() {
  const r = APP.emp, cat = r.catalog || {}, cnt = {}; r.books.forEach(b => { if (b.Grade && typeOk(b, Emp.filter.type)) cnt[b.Grade] = (cnt[b.Grade] || 0) + 1; });
  const stOf = {}; (cat.grades || []).forEach(g => stOf[g.label] = g.stage);
  const guess = g => stOf[g] || (/ابتدائي/.test(g) ? "المرحلة الابتدائية" : /إعدادي/.test(g) ? "المرحلة الإعدادية" : /ثانوي/.test(g) ? "المرحلة الثانوية" : /كي جي|روضة|تأسيس|KG/i.test(g) ? "رياض الأطفال" : "أخرى");
  const go = gradeOrder(), grades = Object.keys(cnt).sort((a, b) => (go[a] ?? 99) - (go[b] ?? 99) || a.localeCompare(b, "ar"));
  const stages = uniq([...(cat.grades || []).map(g => g.stage), "أخرى"]).filter(s => grades.some(g => guess(g) === s));
  const ks = myKids();
  return `${Emp.open() ? "" : ks.length ? `<section class="mb-5"><h2 class="font-display font-bold text-slate-800 mb-2 flex items-center gap-2">${ic("users", "text-brand-600")} أبنائي${ks.some(k => k.rel) ? " وأقاربي" : ""}</h2>
      <div class="grid grid-cols-2 gap-2">${ks.map((k, i) => { const c = kidCartCount(k); return `<button class="card p-2.5 min-w-0 text-right flex items-center gap-2 active:scale-[.98] transition" data-act="pickKid" data-id="${i}"><span class="w-10 h-10 rounded-xl bg-gold-50 flex items-center justify-center text-[22px] shrink-0">${kidEmoji(k)}</span><span class="flex-1 min-w-0"><span class="block font-bold text-[15px] text-slate-900 truncate">${esc(kidName(k, i))}</span><span class="block text-[11.5px] text-slate-500 leading-snug">${k.rel ? `<b class="text-sky-700">${esc(k.rel)}</b> · ` : ""}${esc(gradeShort(k.grade))}${k.type ? " · " + esc(k.type) : ""}${k.track ? " · " + esc(k.track) : ""}</span><span class="block text-[11px] font-bold mt-0.5 ${c ? "text-emerald-600" : "text-brand-600"}">${c ? c + " في السلة" : kidAvail(k) + " كتاب"}</span></span></button>`; }).join("")}</div>
      <div class="flex gap-2 mt-2"><button class="btn btn-ghost btn-sm" data-act="kidsEdit">${ic("pencil")} تعديل</button>${relOn() ? `<button class="btn btn-ghost btn-sm text-sky-700" data-act="addRel">${ic("users")} إضافة قريب</button>` : ""}</div></section>`
    : `<button class="w-full mb-5 rounded-3xl p-4 text-right flex items-center gap-3 ring-1 ring-gold-200 active:scale-[.99] transition" style="background:linear-gradient(135deg,#fff8e6,#fde9b0)" data-act="kidsEdit"><span class="text-[30px]">👦👧</span><span class="flex-1"><b class="block text-brand-950">احفظ أبناءك وأقاربك مرة واحدة <span class="text-[11px] font-semibold text-brand-700">(اختياري)</span></b><span class="block text-[12.5px] text-brand-900/70">ونجهّز لكل واحد كتبه بضغطة — أو اختر الصف مباشرة تحت 👇</span></span><span class="btn btn-primary btn-sm">${ic("plus")} أضف</span></button>`}
    ${Emp.open() ? (ks.length ? `<div class="flex items-center gap-2 my-3"><span class="h-px flex-1 bg-slate-200"></span><span class="text-[12px] font-bold text-slate-500">أو احجز لصف تاني</span><span class="h-px flex-1 bg-slate-200"></span></div>` : "") : `<h2 class="font-display font-bold text-slate-800 mb-1 flex items-center gap-2">${ic("graduation-cap", "text-brand-600")} ${ks.length ? "أو اختر صفاً آخر" : "اختر صف ابنك"}</h2>
    <p class="text-[13px] text-slate-500 mb-4">نعرض لك كتب الصف مرتبة: المواد الأساسية أولاً ثم الأشهر.</p>`}
    ${Emp.open() ? `<button type="button" class="w-full mb-5 rounded-3xl p-4 text-right flex items-center gap-3 text-white shadow-soft active:scale-[.99] transition" style="background:linear-gradient(135deg,#552c83,#2e1650)" data-act="gbOpen"><span class="w-12 h-12 rounded-2xl bg-gold-400 text-brand-950 flex items-center justify-center text-[24px] shrink-0">📚</span><span class="flex-1"><b class="block text-[15px]">احجز بالصف الدراسي خطوة بخطوة</b><span class="block text-[12px] text-brand-200">المرحلة ← الصف ← نوع المدرسة — ${gTxt("وتقدر تضيف", "وتقدري تضيفي")} أكتر من صف</span></span>${ic("chevron-left")}</button>` : ""}
    ${Emp.open() ? "" : stages.map(s => `<section class="mb-5"><div class="text-[13px] font-bold text-brand-700 mb-2">${esc(s)}</div>
      <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">${grades.filter(g => guess(g) === s).map(g => { const on = (Emp.gsel || []).includes(g); return `<div class="relative"><button class="w-full rounded-2xl p-3 text-center active:scale-95 transition shadow-soft ring-1 ${on ? "bg-brand-50 ring-2 ring-brand-600" : "bg-white ring-slate-200 hover:ring-brand-300"}" data-act="fGrade" data-id="${esc(g)}">
        <span class="block font-display font-bold text-[16px] text-slate-900 leading-tight">${esc(gradeShort(g))}</span><span class="block text-[11px] text-slate-500 mt-1 num">${cnt[g]} كتاب</span></button>
</div>`; }).join("")}</div></section>`).join("")}
`;
}
// ============================================================ جهّز الشنطة: كتاب لكل مادة بضغطة
const BAG = { rows: [], m: null };
/** يبني الشنطة المقترحة: لكل مادة كتاب واحد؛ يفضّل سلسلة واحدة تغطي أكثر المواد، ثم الأشهر */
function bagBuild() {
  const pr = pubRank(), list = gradeList().list;
  const bySub = {}; list.forEach(b => (bySub[b.Subject] = bySub[b.Subject] || []).push(b));
  const cover = {}; list.forEach(b => { cover[b.Publisher] = cover[b.Publisher] || new Set(); cover[b.Publisher].add(b.Subject); });
  const series = Object.keys(cover).sort((a, b) => cover[b].size - cover[a].size || (pr[b] || 0) - (pr[a] || 0))[0];
  return Object.keys(bySub).sort((a, b) => subjRank(a) - subjRank(b) || a.localeCompare(b, "ar")).map(s => {
    const opts = bySub[s].slice().sort((a, b) => (a.Publisher === series ? -1 : 0) - (b.Publisher === series ? -1 : 0) || (pr[b.Publisher] || 0) - (pr[a.Publisher] || 0) || ((a.Book_Status === "Pricing") - (b.Book_Status === "Pricing")) || n(a.Emp_Selling_Price) - n(b.Emp_Selling_Price));
    const inCart = opts.find(b => APP.cart[ck(b.Book_ID, Emp.ben)]);
    return { s, opts, pick: inCart ? inCart.Book_ID : "", on: !!inCart, had: !!inCart, qty: inCart ? APP.cart[ck(inCart.Book_ID, Emp.ben)] : 1 }; // لا اختيار مسبق: الموظف يختار بنفسه من كل كتب المادة
  });
}
function bagHTML() {
  const m = Emp.bookMap(), sel = BAG.rows.filter(r => r.on && m[r.pick]), tot = sel.reduce((a, r) => a + n(m[r.pick].Emp_Selling_Price) * (r.qty || 1), 0), cov = sel.reduce((a, r) => a + n(m[r.pick].Cover_Price) * (r.qty || 1), 0);
  const opt = (r, i, o) => { const on = r.on && o.Book_ID === r.pick, lg = pubLogo(o.Publisher);
    return `<button class="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-right ring-1 transition active:scale-[.99] ${on ? "bg-brand-50 ring-2 ring-brand-600" : "bg-white ring-slate-200"}" data-act="bagPick" data-id="${i}|${esc(o.Book_ID)}" aria-pressed="${on}">
      <span class="w-5 h-5 rounded-full shrink-0 flex items-center justify-center ${on ? "bg-brand-600 text-white" : "ring-2 ring-slate-300"}">${on ? ic("check", "!w-3 !h-3") : ""}</span>
      ${lg ? `<span class="w-9 h-7 rounded-md bg-white ring-1 ring-slate-100 p-0.5 shrink-0 flex items-center justify-center"><img src="${esc(lg)}" alt="" class="max-w-full max-h-full object-contain" loading="lazy"></span>` : ""}
      <span class="flex-1 min-w-0 leading-tight"><b class="block text-[13.5px] text-slate-900 truncate">${esc(o.Publisher)}</b>${o.Book_Part ? `<span class="block text-[11px] text-slate-500 truncate">${esc(o.Book_Part)}</span>` : ""}</span>
      <span class="text-left shrink-0">${o.Book_Status === "Pricing" ? `<span class="text-[11px] font-bold text-amber-700">🚚 يتسعّر مع الشحنة</span>` : `<b class="block num text-brand-800 text-[13.5px]">${fmt(o.Emp_Selling_Price)}</b><span class="block text-[10.5px] text-slate-400 line-through num">${fmt(o.Cover_Price)}</span>`}</span></button>`; };
  const nSub = BAG.rows.length, nOn = BAG.rows.filter(r => r.on).length, copies = sel.reduce((a, r) => a + (r.qty || 1), 0);
  return `<div class="relative overflow-hidden rounded-3xl p-4 mb-4 text-white shadow-soft" style="background:linear-gradient(135deg,#0f3d63 0%,#1d5f8f 60%,#2f7fb5 100%)">
    <span class="absolute -left-6 -top-6 w-28 h-28 rounded-full bg-white/10"></span><span class="absolute left-10 -bottom-10 w-24 h-24 rounded-full bg-gold-400/20"></span>
    <div class="relative flex items-start gap-3"><span class="w-12 h-12 rounded-2xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center text-[26px] shrink-0">🎒</span>
      <div class="flex-1 min-w-0"><div class="text-[11px] font-semibold tracking-wide text-gold-200">شنطة ${esc(gradeTitle(Emp.filter.grade))}</div>
        <div class="font-display font-bold text-[17px] leading-snug mt-0.5">${gTxt("اختار كتاب لكل مادة", "اختاري كتاب لكل مادة")}</div>
        <div class="text-[12px] text-brand-100 mt-1 leading-relaxed">تحت كل مادة كل الكتب المتاحة منها · ${gTxt("حدد", "حددي")} عدد النسخ بـ − و + · الضغط مرة تانية يلغي الاختيار</div></div></div>
    <div class="relative mt-3.5"><div class="flex justify-between text-[11.5px] text-brand-100 mb-1.5"><span>تم اختيار <b class="num text-white">${nOn}</b> من <span class="num">${nSub}</span> مادة</span><span>${copies ? `<b class="num text-white">${copies}</b> نسخة` : ""}</span></div>
      <div class="h-2 rounded-full bg-white/15 overflow-hidden"><span class="block h-full rounded-full bg-gold-400 transition-all" style="width:${nSub ? Math.round(nOn / nSub * 100) : 0}%"></span></div></div></div>
  <div class="space-y-3">${BAG.rows.map((r, i) => { const [c1] = toneOf(r.s); return `<section class="rounded-2xl ring-1 ring-slate-200 bg-slate-50/60 p-3">
    <div class="flex items-center gap-2 mb-2"><span class="w-1.5 h-6 rounded-full" style="background:${c1}"></span><b class="text-[15px] text-slate-900 flex-1">${esc(r.s)}</b><span class="text-[11.5px] ${r.on ? "font-bold text-emerald-700" : "text-slate-400"}">${r.on ? "✓ تم الاختيار" : r.opts.length + (r.opts.length > 2 ? " كتب" : r.opts.length === 2 ? " كتابين" : " كتاب")}</span></div>
    <div class="grid sm:grid-cols-2 gap-1.5">${r.opts.map(o => opt(r, i, o)).join("")}</div>
    ${r.on ? `<div class="mt-2.5 flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-white shadow-soft" style="background:linear-gradient(135deg,#552c83 0%,#7a45b8 55%,#c99a2e 130%)"><span class="flex items-center gap-2 text-[13px] font-bold"><span class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">${ic("copy", "!w-4 !h-4")}</span>عدد النسخ</span>
      <span class="flex items-center gap-1.5 rounded-xl bg-white/15 ring-1 ring-white/25 p-1"><button type="button" class="w-9 h-9 rounded-lg bg-white/90 text-brand-800 text-lg font-bold active:scale-90 transition disabled:opacity-40" data-act="bagQty" data-id="${i}|-1" aria-label="أقل" ${(r.qty || 1) <= 1 ? "disabled" : ""}>−</button>
        <b class="w-8 text-center num text-[17px] text-white">${r.qty || 1}</b>
        <button type="button" class="w-9 h-9 rounded-lg bg-gold-400 text-brand-950 text-lg font-bold active:scale-90 transition disabled:opacity-40" data-act="bagQty" data-id="${i}|1" aria-label="أكثر" ${(r.qty || 1) >= 10 ? "disabled" : ""}>+</button></span></div>` : ""}</section>`; }).join("")}</div>
  <div class="rounded-2xl bg-slate-50 p-3.5 mt-3 text-[13.5px] space-y-1">
    <div class="flex justify-between text-slate-500"><span>${booksWord(copies)} قبل الخصم</span><span class="line-through num">${moneyTxt(cov)}</span></div>
    <div class="flex justify-between text-emerald-600 font-semibold"><span>توفيرك</span><span class="num">${moneyTxt(cov - tot)}</span></div>
    <div class="flex justify-between items-baseline pt-1 border-t border-slate-200"><b>إجمالي الشنطة</b><span class="text-xl font-bold text-brand-800 num">${money(tot)}</span></div></div>`;
}
const bagRender = () => { if (BAG.inline && $("#wzBag")) return bagRenderInline(); if (!BAG.m) return; BAG.m.body.innerHTML = bagHTML(); const c = BAG.rows.filter(r => r.on).length, b = BAG.m.root.querySelector("[data-act=bagAdd]"); if (b) { b.disabled = !c; b.innerHTML = `${ic("shopping-cart")} أضف ${c ? booksWord(c) : ""} للسلة`; } };
on("bagOpen", () => { BAG.inline = false; BAG._for = "";
  if (!Emp.open()) return toast("الحجز مغلق حالياً", "warning");
  if (!Emp.filter.grade) return toast("اختر الصف أولاً", "info");
  BAG.rows = bagBuild();
  if (!BAG.rows.length) return toast("لا توجد كتب مسعّرة لهذا الصف بعد", "info");
  const ki = myKids().findIndex(k => k.grade === Emp.filter.grade && (k.type || "") === (Emp.filter.type || ""));
  BAG.m = UI.open(bagHTML(), { title: "🎒 شنطة " + (ki >= 0 ? kidName(myKids()[ki], ki) : gradeShort(Emp.filter.grade)), sub: gradeTitle(Emp.filter.grade) + " · " + kidTypeTxt(Emp.filter.type),
    footer: `<button class="btn btn-primary btn-lg w-full" data-act="bagAdd">${ic("shopping-cart")} أضف للسلة</button>` });
  bagRender();
});
on("bagQty", v => { const [i, d] = String(v).split("|"), r = BAG.rows[+i]; r.qty = Math.min(10, Math.max(1, (r.qty || 1) + +d)); bagRender(); if (navigator.vibrate) navigator.vibrate(6); });
on("bagTog", v => { const r = BAG.rows[+v]; r.on = !r.on; bagRender(); });
on("bagPick", v => { const [i, id] = String(v).split("|"), r = BAG.rows[+i]; if (r.on && r.pick === id) r.on = false; else { r.pick = id; r.on = true; } bagRender(); });
on("bagAdd", () => {
  const sel = BAG.rows.filter(r => r.on); let added = 0;
  sel.forEach(r => { r.opts.forEach(o => { const k = ck(o.Book_ID, Emp.ben); if (o.Book_ID !== r.pick && APP.cart[k] && r.had) delete APP.cart[k]; }); const k = ck(r.pick, Emp.ben); if (APP.cart[k] !== (r.qty || 1)) { added += (r.qty || 1) - (APP.cart[k] || 0) > 0 ? (r.qty || 1) - (APP.cart[k] || 0) : 0; APP.cart[k] = r.qty || 1; } });
  Emp.dirty = true; if (BAG.m) BAG.m.close(); BAG.m = null;
  renderBookGrid(); refreshCartViews();
  toast(added ? `🎒 الشنطة جاهزة! اتضاف ${booksWord(added)} للسلة` : "الشنطة في السلة بالفعل ✅", "success");
});

/** باقات سريعة: كل كتب ناشر واحد للصف بضغطة */
function bundles(list) {
  const by = {}; list.forEach(b => (by[b.Publisher] = by[b.Publisher] || []).push(b));
  const pr = pubRank(), pubs = Object.keys(by).filter(p => by[p].length >= 2 && p !== "-").sort((a, b) => by[b].length - by[a].length || (pr[b] || 0) - (pr[a] || 0)).slice(0, 8);
  if (!pubs.length || !Emp.open()) return "";
  return `<section class="mb-4"><div class="flex items-center justify-between mb-2"><h3 class="font-bold text-slate-800 text-[14px] flex items-center gap-1.5">${ic("sparkles", "text-gold-500")} حجز سريع بالسلسلة</h3><span class="text-[11.5px] text-slate-400">نسخة من كل كتاب</span></div>
    <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">${pubs.map(p => { const sum = by[p].reduce((s, b) => s + n(b.Emp_Selling_Price), 0), subs = uniq(by[p].map(b => b.Subject)).slice(0, 4);
      return `<button class="min-w-0 w-full text-right rounded-2xl p-3 bg-gradient-to-bl from-brand-700 to-brand-900 text-white active:scale-[.98] transition" data-act="addBundle" data-id="${esc(p)}">
        <span class="flex items-center gap-2">${pubLogo(p) ? `<span class="w-8 h-8 rounded-lg bg-white p-0.5 shrink-0 flex items-center justify-center"><img src="${esc(pubLogo(p))}" alt="" class="max-w-full max-h-full object-contain"></span>` : ""}<span class="block font-bold text-[15px]">${esc(p)}</span></span><span class="block text-[11.5px] text-brand-200 truncate mt-0.5">${esc(subs.join(" · "))}</span>
        <span class="flex items-center justify-between mt-2"><span class="text-[12px] text-brand-100 num">${by[p].length} كتب · ${fmt(sum)} ج.م</span><span class="w-7 h-7 rounded-lg bg-gold-400 text-brand-950 flex items-center justify-center">${ic("plus")}</span></span></button>`; }).join("")}</div></section>`;
}
/** شريط سياق الحجز (لاصق أعلى الصفحة): يوضح للموظف دائمًا لمن يحجز الآن (الاسم + المرحلة/الصف) ويتيح التبديل بين الأبناء */
/** شارة نوع المدرسة بلون مميز (أعلى الصف) حتى يعرف ولي الأمر بالضبط لمين وإيه بيحجز */
function schoolTypeBadge(t) {
  const m = { "حكومي": ["🏫", "عربي حكومي", "bg-sky-400 text-sky-950"], "لغات": ["🌐", "لغات / تجريبي", "bg-gold-400 text-brand-950"], "أزهر": ["🕌", "أزهري", "bg-emerald-400 text-emerald-950"] }[t || ""] || ["📚", "كل أنواع المدارس", "bg-white/20 text-white"];
  return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${m[2]}">${m[0]} ${m[1]}</span>`;
}
/** لوحة «أبنائي» الموحّدة في صفحة احجز: إدارة الأفراد (إضافة/تعديل/قريب) + اختيار لمين تحجز */
function familyPanel() {
  const ks = myKids(), f = Emp.filter, ro = relOn();
  const sel = k => k.grade === f.grade && kidBen(k) === Emp.ben;
  const act = (a, icn, t, cls) => `<button type="button" class="inline-flex items-center gap-1 h-8 px-2.5 rounded-xl text-[12px] font-bold ring-1 transition active:scale-95 ${cls}" data-act="${a}">${ic(icn, "!w-3.5 !h-3.5")} ${t}</button>`;
  const card = (k, i) => { const on = sel(k), c = kidCartCount(k);
    return `<button type="button" class="relative shrink-0 w-[132px] snap-start text-right rounded-2xl p-2.5 ring-1 transition active:scale-[.97] ${on ? "bg-brand-700 text-white ring-brand-700 shadow-glow" : k.rel ? "bg-sky-50/60 ring-sky-200 text-slate-800" : "bg-white ring-slate-200 text-slate-800"}" data-act="pickKid" data-id="${i}" aria-pressed="${on}">
      ${c ? `<span class="absolute top-1.5 left-1.5 min-w-[20px] h-5 px-1 rounded-full text-[10.5px] font-bold num flex items-center justify-center ${on ? "bg-gold-400 text-brand-950" : "bg-brand-600 text-white"}">${c}</span>` : ""}
      <span class="w-10 h-10 rounded-xl flex items-center justify-center text-[22px] ${on ? "bg-white/15" : k.rel ? "bg-sky-100" : "bg-gold-50"}">${kidEmoji(k)}</span>
      <b class="block text-[13.5px] mt-1.5 truncate">${esc(kidName(k, i))}</b>
      <span class="block text-[11px] truncate ${on ? "text-brand-100" : "text-slate-500"}">${k.rel ? esc(k.rel) + " · " : ""}${esc(gradeShort(k.grade))}${k.type ? " · " + esc(k.type) : ""}</span>
      ${on ? `<span class="mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-bold text-gold-300">${ic("check", "!w-3 !h-3")} بتحجز له دلوقتي</span>` : `<span class="mt-1.5 inline-block text-[10.5px] font-semibold ${k.rel ? "text-sky-700" : "text-brand-700"}">اضغط للحجز ←</span>`}</button>`; };
  if (!ks.length) return `<section class="rounded-3xl ring-1 ring-gold-200 p-4 mb-3 flex items-center gap-3" style="background:linear-gradient(135deg,#fff8e6,#fde9b0)">
      <span class="w-12 h-12 rounded-2xl bg-white/70 flex items-center justify-center text-[26px] shrink-0">👦👧</span>
      <div class="flex-1 min-w-0"><b class="block text-brand-950 text-[15px]">أبنائي</b><span class="block text-[12px] text-brand-900/75 leading-relaxed">${gTxt("سجّل أولادك مرة واحدة — أو احجز «بالصف» خطوة بخطوة", "سجّلي أولادك مرة واحدة — أو احجزي «بالصف» خطوة بخطوة")}</span></div>
      <div class="flex flex-col gap-1.5 shrink-0">${act("kidsEdit", "plus", "أبنائي", "bg-brand-700 text-white ring-brand-700")}${act("gbOpen", "graduation-cap", "بالصف", "bg-white text-brand-800 ring-brand-200")}${ro ? act("addRel", "users", "قريب", "bg-white text-sky-700 ring-sky-200") : ""}</div></section>`;
  const nk = ks.filter(k => !k.rel).length, nr = ks.length - nk;
  return `<section class="rounded-3xl bg-white ring-1 ring-slate-200 shadow-xs p-3.5 mb-3">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0"><span class="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">${ic("users")}</span>
        <div class="min-w-0 leading-tight"><b class="block text-[15px] text-slate-900">أبنائي</b><span class="block text-[11px] text-slate-500">${nk ? nk + (nk === 1 ? " فرد" : " أفراد") : ""}${nk && nr ? " · " : ""}${nr ? nr + " قريب" : ""}</span></div></div>
      <div class="flex items-center gap-1.5 shrink-0">${act("kidsAddNew", "plus", "إضافة", "bg-brand-700 text-white ring-brand-700")}${act("kidsEdit", "pencil", "تعديل", "bg-white text-slate-700 ring-slate-200")}${ro ? act("addRel", "users", "قريب", "bg-sky-50 text-sky-700 ring-sky-200") : ""}</div>
    </div>
    <div class="flex items-center gap-2 mt-3 mb-2"><span class="h-px flex-1 bg-slate-100"></span><span class="text-[11.5px] font-bold text-slate-500">${gTxt("اختار لمين تحجز", "اختاري لمين تحجزي")}</span><span class="h-px flex-1 bg-slate-100"></span></div>
    <div class="flex gap-2 overflow-x-auto snap-x pb-1 -mx-1 px-1" style="scrollbar-width:none">${ks.map(card).join("")}</div>
  </section>`;
}
function ctxBar() {
  const ks = myKids(), f = Emp.filter;
  if (!Emp.open() || !f.grade) return "";
  const match = (k, strict) => k.grade === f.grade && kidBen(k) === Emp.ben && (!strict || (k.type || "") === (f.type || ""));
  let i = ks.findIndex(k => match(k, true)); if (i < 0) i = ks.findIndex(k => match(k, false));
  const cur = i >= 0 ? ks[i] : null;
  const who = cur
    ? `<span class="w-9 h-9 shrink-0 rounded-xl bg-white/15 flex items-center justify-center text-[20px]">${kidEmoji(cur)}</span>
       <div class="min-w-0 flex-1"><div class="flex items-center gap-1.5 leading-none"><span class="text-[11px] text-brand-200">جارٍ الحجز الآن لـ</span>${schoolTypeBadge(cur.type)}</div>
       <div class="font-bold text-[15px] truncate">${esc(kidName(cur, i))}<span class="font-medium text-brand-100"> · ${esc(gradeTitle(cur.grade))}</span></div></div>`
    : `<div class="min-w-0 flex-1 text-[13px]">لم تحدد ابنًا للحجز — اختر من الأسماء</div>`;
  const pills = ks.length > 1 ? `<div class="scroll-x !mx-0 !px-0 mt-2 !pb-0">${ks.map((k, j) => { const on = j === i, c = kidCartCount(k);
    return `<button class="shrink-0 inline-flex items-center gap-1.5 h-8 rounded-full px-2.5 text-[12px] font-semibold ring-1 transition ${on ? "bg-gold-400 text-brand-950 ring-gold-400" : "bg-white/10 text-white ring-white/25 hover:bg-white/20"}" data-act="pickKid" data-id="${j}" aria-pressed="${on}">${kidEmoji(k)} ${esc(kidName(k, j))}${c ? `<span class="min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] font-bold flex items-center justify-center ${on ? "bg-brand-900 text-white" : "bg-gold-400 text-brand-950"}">${c}</span>` : ""}</button>`; }).join("")}</div>` : "";
  // بدون ابن مسجّل (الحجز بالصف): الشريط يوضح الصف ونوع المدرسة والشعبة
  const whoG = `<span class="w-9 h-9 shrink-0 rounded-xl bg-white/15 flex items-center justify-center text-[20px]">📚</span>
       <div class="min-w-0 flex-1"><div class="flex items-center gap-1.5 leading-none"><span class="text-[11px] text-brand-200">${gTxt("أنت تحجز الآن لـ", "أنتِ تحجزين الآن لـ")}</span>${schoolTypeBadge(f.type)}</div>
       <div class="font-bold text-[15px] truncate">${esc(gradeTitle(f.grade))}${f.track ? `<span class="font-medium text-brand-100"> · ${esc(f.track)}</span>` : ""}</div></div>`;
  return `<div id="ctxStick" class="hero text-white rounded-2xl px-3 py-2.5 mb-2 shadow-soft"><div class="flex items-center gap-2.5">${cur ? who : whoG}${Emp.wzManual ? `<button type="button" class="text-[12px] font-bold px-3 py-1.5 rounded-xl bg-gold-400 text-brand-950 shrink-0" data-act="${Emp.wzManual === "review" ? "wzBackReview" : "wzBack"}">${ic("check", "inline !w-3.5 !h-3.5")} ${Emp.wzManual === "review" ? "المراجعة" : "التالي"}</button>` : ""}<button type="button" class="${Emp.wzManual ? "hidden " : ""}text-[11.5px] font-semibold px-2.5 py-1.5 rounded-xl bg-white/15 shrink-0" data-act="famTop">${myKids().length > 1 ? "👨‍👩‍👧 ابن تاني" : "تغيير"}</button></div></div>`;
}
function gradeList() {
  const f = Emp.filter, list = APP.emp.books.filter(b => b.Grade === f.grade && typeOk(b, f.type));
  return { list, sorted: sortBooks(list) };
}
/** طرق الحجز: الشنطة · السلسلة · بنفسي — ثم قائمة الكتب بالمادة */
function bookModeTabs() {
  if (!Emp.open()) return "";
  const m = Emp.bookMode || "";
  const t = (id, e, ttl, sub, act) => `<button type="button" class="min-w-0 text-right rounded-2xl p-3 ring-1 transition active:scale-[.98] ${m === id ? "bg-brand-700 text-white ring-brand-700 shadow-glow" : "bg-white text-slate-800 ring-slate-200"}" data-act="${act}" data-id="${id}" aria-pressed="${m === id}">
    <span class="block text-[24px] leading-none">${e}</span><b class="block text-[13px] mt-1.5 leading-tight">${ttl}</b><span class="block text-[10.5px] mt-0.5 leading-snug ${m === id ? "text-brand-100" : "text-slate-500"}">${sub}</span></button>`;
  return `<section class="mb-4"><div class="text-[12px] font-bold text-slate-500 mb-2">${gTxt("تحب تحجز إزاي؟", "تحبي تحجزي إزاي؟")}</div>
    <div class="grid grid-cols-3 gap-2">${t("manual", "🔍", "أختار بنفسي", "كتاب بكتاب", "bookMode")}${t("bag", "🎒", "جهّز الشنطة", "كل مادة وكتبها", "bagOpen")}${t("series", "📚", "حجز بالسلسلة", "كتب ناشر واحد", "bookMode")}</div></section>`;
}
on("bookMode", v => { Emp.bookMode = Emp.bookMode === v ? "" : v; renderBookGrid(); const g = $("#bookGrid"); if (Emp.bookMode && g) { const y = g.getBoundingClientRect().top + scrollY - 140; if (y < scrollY) scrollTo({ top: y, behavior: "smooth" }); } });
/** رسالة الترحيب قبل اختيار طريقة الحجز */
function bookModeHello() {
  const ki = myKids().findIndex(k => k.grade === Emp.filter.grade && kidBen(k) === Emp.ben), who = ki >= 0 ? kidName(myKids()[ki], ki) : "";
  return `<div class="relative overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200 shadow-xs px-5 py-8 text-center">
    <span class="absolute -top-10 -left-10 w-36 h-36 rounded-full bg-brand-50"></span><span class="absolute -bottom-12 -right-8 w-32 h-32 rounded-full bg-gold-50"></span>
    <div class="relative">
      <div class="mx-auto w-16 h-16 rounded-3xl flex items-center justify-center text-[34px] shadow-soft" style="background:linear-gradient(135deg,#fff8e6,#fde9b0)">📚</div>
      <h3 class="font-display font-bold text-[18px] text-slate-900 mt-4">${who ? `كتب ${esc(who)} جاهزة` : "كتب الصف جاهزة"} ✨</h3>
      <p class="text-[13px] text-slate-500 mt-1.5 leading-relaxed max-w-xs mx-auto">${gTxt("اختار من فوق الطريقة اللي تريحك", "اختاري من فوق الطريقة اللي تريحك")} — وكل الكتب بخصم العاملين وتقدر${gTxt("", "ي")} تعدّل${gTxt("", "ي")} في أي وقت قبل القفل.</p>
      <div class="mt-5 grid gap-2 text-right max-w-xs mx-auto text-[12.5px]">
        <div class="flex items-center gap-2.5 rounded-2xl bg-slate-50 px-3 py-2"><span class="text-[18px]">🔍</span><span><b class="text-slate-800">أختار بنفسي</b> <span class="text-slate-500">— كل الكتب مادة مادة</span></span></div>
        <div class="flex items-center gap-2.5 rounded-2xl bg-slate-50 px-3 py-2"><span class="text-[18px]">🎒</span><span><b class="text-slate-800">جهّز الشنطة</b> <span class="text-slate-500">— كتاب لكل مادة بسرعة</span></span></div>
        <div class="flex items-center gap-2.5 rounded-2xl bg-slate-50 px-3 py-2"><span class="text-[18px]">📚</span><span><b class="text-slate-800">بالسلسلة</b> <span class="text-slate-500">— كتب ناشر واحد بضغطة</span></span></div>
      </div>
      <div class="mt-5 inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-700 animate-bounce">${ic("arrow-up", "!w-4 !h-4")} ${gTxt("اختار طريقة", "اختاري طريقة")}</div>
    </div></div>`;
}
/** فاصل السلة بعد قائمة الكتب */
function cartDivider() {
  const t = Emp.totals(); if (!t.count) return "";
  return `<div class="flex items-center gap-2 my-5"><span class="h-px flex-1 bg-slate-200"></span><span class="text-[12px] font-bold text-slate-500">${ic("shopping-cart", "inline -mt-0.5")} السلة</span><span class="h-px flex-1 bg-slate-200"></span></div>
    <button type="button" class="w-full rounded-2xl bg-white ring-1 ring-brand-200 p-3.5 flex items-center gap-3 text-right shadow-xs active:scale-[.99]" data-act="openCart">
      <span class="w-11 h-11 rounded-xl bg-brand-700 text-white flex items-center justify-center shrink-0">${ic("shopping-cart")}</span>
      <span class="flex-1 min-w-0"><b class="block text-[14px] text-slate-900">${booksWord(t.count)} في السلة</b><span class="block text-[12px] text-emerald-600 font-semibold">${gTxt("وفّرت", "وفّرتي")} ${moneyTxt(t.cover - t.net)}</span></span>
      <span class="text-left"><b class="block num text-brand-800 text-[16px]">${money(t.net)}</b><span class="text-[11px] font-bold text-brand-700">${gTxt("راجع وأكّد", "راجعي وأكّدي")} ←</span></span></button>`;
}
function renderBookGrid() {
  const r = APP.emp, f = Emp.filter, el = $("#bookGrid"); if (!el) return;
  let count = 0;
  if (f.q) {
    const q = f.q.toLowerCase(), list = sortBooks(r.books.filter(b => typeOk(b, f.type) && (!f.grade || b.Grade === f.grade) && (b.Book_Name + " " + b.Subject + " " + b.Publisher + " " + b.Book_ID + " " + b.Grade + " " + gradeTitle(b.Grade)).toLowerCase().includes(q)));
    count = list.length;
    el.innerHTML = list.length ? `<div class="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">${list.slice(0, 120).map(bookCard).join("")}</div>` : Art.empty("books", "لا توجد كتب مطابقة", "جرّب كلمة أخرى أو امسح البحث.");
  } else if (!f.grade) {
    el.innerHTML = gradePicker();
  } else {
    const { list, sorted } = gradeList(); count = list.length;
    const groups = []; sorted.forEach(b => { const key = b.Subject; let g = groups.find(x => x.k === key); if (!g) groups.push(g = { k: key, items: [] }); g.items.push(b); });
    el.innerHTML = !list.length ? Art.empty("books", "لا توجد كتب لهذا الاختيار", f.type ? (curKid() ? "مفيش كتب مسجّلة لمدارس " + f.type + " في الصف ده لسه." : "جرّب «كل المدارس».") : "", f.type ? `<button class="btn btn-outline mt-4" data-act="fTypeAll">${ic("layout-grid")} اعرض كتب كل المدارس</button>` : "")
      : bookModeTabs() + (Emp.open() && !Emp.wzManual && !Emp.bookMode ? bookModeHello() + `<div id="cartDiv">${cartDivider()}</div>` : Emp.open() && Emp.bookMode === "series" ? bundles(list) + `<div id="cartDiv">${cartDivider()}</div>` : groups.map(g => `<section class="mb-5 scroll-mt-48" id="sub_${esc(g.k)}"><div class="subj-head sticky z-[19] mb-2.5 flex items-center gap-2 rounded-2xl px-2 py-1.5 ring-1 shadow-sm" style="top:var(--subjTop,8.5rem);--tc:${g.k === "__p" ? "#f59e0b" : toneOf(g.k)[0]};background:linear-gradient(to left,color-mix(in srgb,var(--tc) 18%,#fff) 0%,#fff 80%);--tw-ring-color:color-mix(in srgb,var(--tc) 30%,#fff)">
          <span class="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 shadow-soft" style="background:var(--tc)">${ic("book-open", "!w-3.5 !h-3.5")}</span><h3 class="font-display font-bold text-slate-900 text-[14.5px] flex-1 min-w-0 truncate">${g.k === "__p" ? "قريباً (جاري التسعير)" : esc(g.k)}<span class="font-sans font-semibold text-[12px] text-slate-500"> — ${esc(gradeShort(Emp.filter.grade || ""))}</span></h3><span class="text-[12px] text-slate-400 num">${g.items.length}</span>
          ${g.k !== "__p" && subjRank(g.k) < 8 ? `<span class="text-[10.5px] font-bold text-brand-600 bg-brand-50 rounded-full px-2 py-0.5">مادة أساسية</span>` : ""}</div>
        <div class="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">${g.items.map(bookCard).join("")}</div></section>`).join("") + `<div id="nextKid">${nextKidCard()}</div><div id="cartDiv">${cartDivider()}</div>`);
  }
  const bc = $("#bookCount"); if (bc) bc.textContent = count ? count + " كتاب" : "";
  // اسم المادة يثبت تحت شريط البحث اللاصق مباشرة
  const fixTop = () => { const st = $("#bkSticky"); if (st) el.style.setProperty("--subjTop", (64 + st.offsetHeight) + "px"); };
  fixTop(); requestAnimationFrame(fixTop);
}
Router.add("/e/books", view => {
  const r = APP.emp, f = Emp.filter;
  if (!r.activePhase) { view.innerHTML = Art.empty("calendar", "لا توجد مرحلة حجز", "سيظهر الكتالوج عند فتح مرحلة حجز جديدة."); return; }
  const types = (r.catalog || {}).schoolTypes || [];
  const subs = f.grade && !f.q ? uniq(sortBooks(gradeList().list).map(b => b.Subject)) : [];
  const [c1, c2] = toneOf(f.grade || "x");
  view.innerHTML = `
  <div class="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 items-start">
    <div>
      ${!Emp.open() ? (() => { const psi = phaseStatusInfo(r.activePhase), carry = carryNotice(r.activePhase); const cls = psi.tone === "sky" ? "bg-sky-50 ring-sky-200 text-sky-950" : psi.tone === "slate" ? "bg-slate-100 ring-slate-200 text-slate-800" : "bg-amber-50 ring-amber-200 text-amber-950"; const icCls = psi.tone === "sky" ? "text-sky-600" : psi.tone === "slate" ? "text-slate-600" : "text-amber-600"; return `<div class="rounded-2xl ${cls} ring-1 p-4 mb-4 space-y-2.5 text-sm"><div class="flex items-start gap-3">${ic(psi.icon, "text-lg mt-0.5 shrink-0 " + icCls)}<div class="flex-1 min-w-0"><b class="block text-[14.5px] leading-snug">${esc(psi.title)}</b><div class="text-[12.5px] opacity-85 mt-0.5 leading-relaxed">${esc(psi.sub)}</div></div></div>${carry ? `<div class="rounded-xl bg-white/80 ring-1 ring-black/5 px-3 py-2 text-[12.5px] flex flex-wrap items-center justify-between gap-2"><span class="flex items-center gap-2 font-semibold">${ic("arrow-left-right", "shrink-0 " + icCls)}<span>${esc(carry.text)}</span></span><a href="#/e/orders" class="font-bold underline shrink-0">عرض حجوزاتي ←</a></div>` : ""}</div>`; })() : ""}
      ${Emp.wzManual ? "" : Emp.open() ? familyPanel() : ""}
      ${f.grade ? `<div class="rounded-3xl p-4 mb-3 text-white relative overflow-hidden" style="background:linear-gradient(135deg,#552c83,#2e1650)">
        <span class="absolute -left-6 -top-8 w-32 h-32 rounded-full bg-white/5"></span>
        <div class="flex items-center gap-3 relative"><span class="w-12 h-12 rounded-2xl bg-gold-400 text-brand-950 flex items-center justify-center text-2xl shrink-0">${ic("graduation-cap")}</span>
          <div class="flex-1 min-w-0"><div class="text-[12px] text-brand-200">${(() => { const i = myKids().findIndex(k => k.grade === f.grade && (k.type || "") === (f.type || "") && kidBen(k) === Emp.ben); return i >= 0 ? "كتب " + esc(kidName(myKids()[i], i)) + " " + kidEmoji(myKids()[i]) : "كتب"; })()}</div><div class="font-display font-bold text-[15px] leading-tight">${esc(gradeTitle(f.grade))}</div></div>
          <button class="btn btn-sm !bg-white/15 !text-white !ring-white/20" data-act="fGrade" data-id="">${ic("arrow-left-right")} تغيير</button></div>
        <div class="seg grid-cols-${types.length + 1} mt-3 !bg-white/10">${[["", "كل المدارس"], ...types.map(t => [t, t])].map(t => `<button data-act="fType" data-id="${esc(t[0])}" aria-pressed="${f.type === t[0]}" class="!text-[13px] ${f.type === t[0] ? "" : curKid() ? "!text-white/45" : "!text-white/85"}">${f.type === t[0] && curKid() ? ic("lock", "inline !w-3 !h-3 -mt-0.5 ml-0.5") : ""}${esc(t[1])}</button>`).join("")}</div>${gradeTracks(f.grade).length ? `<div class="flex gap-1.5 overflow-x-auto mt-2 pb-0.5">${[["", "كل الشعب"], ...gradeTracks(f.grade).map(t => [t, t])].map(t => `<button data-act="fTrack" data-id="${esc(t[0])}" class="shrink-0 rounded-full px-3 h-8 text-[12px] font-bold ring-1 ${(f.track || "") === t[0] ? "bg-gold-400 text-brand-950 ring-gold-400" : "bg-white/10 text-white ring-white/25"}">${esc(t[1])}</button>`).join("")}</div>` : ""}</div>` : ""}
      <div id="bkSticky" class="sticky top-16 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 pt-1 pb-2 bg-slate-50/90 backdrop-blur-xl">
        ${ctxBar()}
        <div class="input-icon">${ic("search")}<input class="input !h-12 !rounded-2xl shadow-soft !ring-slate-200/80" placeholder="${f.grade ? "ابحث في كتب " + esc(gradeShort(f.grade)) : "ابحث باسم الكتاب أو الناشر أو المادة"}" value="${esc(f.q)}" data-input="bookSearch" type="search"></div>
        ${relOn() && Emp.open() && Emp.ben && !myKids().some(k => kidBen(k) === Emp.ben) ? `<div class="mt-2 rounded-xl bg-sky-50 ring-1 ring-sky-200 text-sky-800 text-[12.5px] px-3 py-2 flex items-center gap-2">${ic("users")} تحجز الآن لـ <b>${esc(Emp.ben)}</b><button class="mr-auto text-sky-700 underline" data-act="pickBen" data-id="">رجوع لأبنائي</button></div>` : ""}
        ${subs.length > 1 ? `<div class="scroll-x mt-2">${subs.map(x => `<button class="chip !h-8 !text-xs" data-act="jumpSubj" data-id="${esc(x)}">${esc(x)}</button>`).join("")}</div>` : ""}
        ${!f.grade && types.length && !Emp.open() ? `<div class="scroll-x mt-2"><span class="text-[12px] font-semibold text-slate-500 shrink-0 self-center">نوع المدرسة:</span>${[["", "الكل"], ...types.map(t => [t, t])].map(t => `<button class="chip !h-8 !text-xs" data-act="fType" data-id="${esc(t[0])}" aria-pressed="${f.type === t[0]}">${esc(t[1])}</button>`).join("")}</div>` : ""}
      </div>
      <div class="flex items-center justify-between mb-2"><span id="bookCount" class="text-sm text-slate-500"></span><span class="text-xs text-slate-400">أقصى ${fmt(r.settings.MAX_QTY_PER_BOOK || 3)} من نفس الكتاب</span></div>
      <div id="bookGrid"></div>
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
on("fGrade", v => { Emp.filter.grade = v; Emp.filter.track = ""; Emp.filter.q = ""; Shell.rerender(); scrollTo({ top: 0 }); });
/** الابن المسجّل اللي بنحجز له دلوقتي (لو موجود) */
const curKid = () => { const ks = myKids(), f = Emp.filter; const i = ks.findIndex(k => k.grade === f.grade && kidBen(k) === Emp.ben); return i >= 0 ? { k: ks[i], i } : null; };
/** نوع المدرسة/الشعبة مقفولين على بيانات الابن المسجّلة — التغيير من «تغيير» أو تعديل بياناته */
function lockedKidMsg(what) {
  const c = curKid(); if (!c) return false;
  const nm = kidName(c.k, c.i), cur = what === "type" ? (c.k.type ? "مدارس " + c.k.type : "كل المدارس") : (c.k.track || "بدون شعبة");
  const m = UI.open(`<div class="text-center px-1"><div class="mx-auto w-14 h-14 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center">${ic("lock", "!w-6 !h-6")}</div>
    <p class="text-[14px] text-slate-700 mt-3 leading-relaxed">${esc(nm)} متسجّل ${what === "type" ? "في" : "شعبة"} <b class="text-brand-800">${esc(cur)}</b>،<br>والكتب معروضة على أساس بياناته.</p>
    <p class="text-[12.5px] text-slate-500 mt-2">${gTxt("لو عاوز تغيّر", "لو عاوزة تغيّري")} ${what === "type" ? "نوع المدرسة" : "الشعبة"}، ${gTxt("عدّل", "عدّلي")} بياناته الأول عشان الحجز يفضل مظبوط.</p></div>`,
    { title: what === "type" ? "نوع المدرسة محدد" : "الشعبة محددة", footer: `<div class="grid grid-cols-2 gap-2"><button class="btn btn-primary" data-lock-edit>${ic("pencil")} تعديل بياناته</button><button class="btn btn-outline" data-close>تمام</button></div>` });
  const b = m.root.querySelector("[data-lock-edit]"); if (b) b.onclick = () => { m.close(); setTimeout(() => kidsEditor(false, { kid: c.k }), 250); };
  return true;
}
on("fTypeAll", () => { Emp.filter.type = ""; Shell.rerender(); });
on("fType", v => { if (curKid() && (v || "") !== (Emp.filter.type || "") && lockedKidMsg("type")) return; Emp.filter.type = v; Shell.rerender(); });
on("fTrack", v => { if (curKid() && (v || "") !== (Emp.filter.track || "") && lockedKidMsg("track")) return; Emp.filter.track = v; Shell.rerender(); });
on("jumpSubj", v => { const el = document.getElementById("sub_" + v); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); });
on("addBundle", async pub => {
  const list = gradeList().list.filter(b => b.Publisher === pub);
  const add = list.filter(b => !APP.cart[ck(b.Book_ID, Emp.ben)]);
  if (!add.length) return toast("كل كتب " + pub + " في السلة بالفعل ✅", "info");
  const sum = add.reduce((s, b) => s + n(b.Emp_Selling_Price), 0);
  if (!await UI.confirm({ title: "إضافة سلسلة " + pub, message: `${add.map(b => "• " + b.Subject + (b.Book_Part ? " (" + b.Book_Part + ")" : "")).join("\n")}\n\n${add.length} كتب بإجمالي ${fmt(sum)} ج.م`, ok: "أضف للسلة", icon: "sparkles" })) return;
  add.forEach(b => { APP.cart[ck(b.Book_ID, Emp.ben)] = 1; });
  Emp.dirty = true; renderBookGrid(); refreshCartViews(); toast(`اتضاف ${add.length} كتب للسلة 🛒`, "success");
});

on("pickBen", v => { Emp.ben = v; Shell.rerender(); });
on("addBen", () => ACTIONS.addRel());
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
  if (!APP.emp.activePhase) { view.innerHTML = Art.empty("cart", "السلة فاضية", "اختار كتب أولادك من «احجز» 😊", `<a href="#/e/books" class="btn btn-primary btn-sm mt-4">${ic("library")} ابدأ الحجز</a>`); return; }
  const t = Emp.totals();
  view.innerHTML = `<div class="max-w-xl mx-auto">${UI.pageHead(`${ic("shopping-cart", "text-brand-600")} سلة الكتب`, t.count ? booksWord(t.count) + " · " + esc(APP.emp.activePhase.Phase_Name) : esc(APP.emp.activePhase.Phase_Name), `<a href="#/e/books" class="btn btn-outline btn-sm">${ic("plus")} أضف كتب</a>`)}
    <section class="card card-pad"><div class="cart-body"></div></section></div>`;
  refreshCartViews();
});
on("cartStep", v => {
  if (v === "list" && Router.current === "/e/wiz") { Emp.cartStep = "pay"; return wzGo("review"); }
  if (v === "confirm" && APP.plan.method === "INSTALLMENT" && !Emp.planCalc(Emp.totals().net).ok) return toast("راجع المقدم الأول", "warning");
  Emp.cartStep = v; refreshCartViews(); const c = document.querySelector(".cart-body,.wiz-pay"); if (c && c.scrollIntoView) c.scrollIntoView({ block: "start", behavior: "smooth" });
});
on("cartLater", async () => {
  if (Emp.dirty) await call("SAVE_CART_DRAFT", { phaseId: APP.phaseId, cart: APP.cart }).catch(() => {});
  if (Emp._cartSheet) { Emp._cartSheet.close(); Emp._cartSheet = null; }
  Emp.cartStep = "list"; toast(gTxt("اتحفظت سلتك مؤقتاً 🕒 — ارجع أكّد قبل قفل الحجز عشان تتحسب أسبقيتك", "اتحفظت سلتك مؤقتاً 🕒 — ارجعي أكّدي قبل قفل الحجز عشان تتحسب أسبقيتك"), "info");
  Router.go("/e/home");
});
on("cartDelete", () => { const had = Emp.activeItems().length > 0;
  if (had && ACTIONS.empCancel) return ACTIONS.empCancel(); return ACTIONS.discardDraft && ACTIONS.discardDraft(); });
on("openCart", () => { Emp.cartStep = "list"; if (window.innerWidth < 1024 && !window.__forceSheet) return Router.go("/e/cart");
  const m = UI.open(`<div class="cart-body"></div>`, { title: "سلة الكتب", sub: APP.emp.activePhase.Phase_Name, onClose: () => refreshCartViews() });
  m.body.querySelector(".cart-body").innerHTML = cartHTML();
  Emp._cartSheet = m;
});
/** تجميع بنود الحجز حسب الابن (بالصف المسجَّل في «أبنائي») أو القريب، مع إجمالي كل مجموعة */
function resGroups(lines) {
  const ks = myKids(), go = gradeOrder(), map = {};
  lines.forEach(l => {
    const key = l.ben ? "ben:" + l.ben : "g:" + (l.grade || "");
    const g = map[key] || (map[key] = { key, lines: [], count: 0, net: 0, cover: 0 });
    g.lines.push(l); g.count += l.qty; g.net += l.qty * n(l.price); g.cover += l.qty * n(l.cover);
  });
  Object.values(map).forEach(g => {
    if (g.key.startsWith("ben:")) { const b = g.key.slice(4), ri = ks.findIndex(k => kidBen(k) === b), rk = ks[ri];
      g.title = rk ? rk.name + " (" + rk.rel + ")" : b; g.emoji = "🧒"; g.sub = rk ? gradeTitle(rk.grade) : "قريب"; g.ord = rk ? 500 + ri : 900; return; }
    const grade = g.key.slice(2), kids = ks.map((k, i) => ({ k, i })).filter(x => x.k.grade === grade && !x.k.rel);
    g.title = kids.length ? kids.map(x => kidName(x.k, x.i)).join(" و") : gradeTitle(grade) || "كتب أخرى";
    g.emoji = kids.length ? kidEmoji(kids[0].k) : "📚"; g.sub = kids.length ? gradeTitle(grade) : ""; g.ord = kids.length ? kids[0].i : 100 + (go[grade] ?? 99);
  });
  return Object.values(map).sort((a, b) => a.ord - b.ord);
}
const cartLines = () => { const bm = Emp.bookMap(); return Object.keys(APP.cart).map(k => { const b = bm[bk(k)] || {}; return { key: k, code: bk(k), name: b.Book_Name || bk(k), subject: b.Subject || "", grade: b.Grade, ben: bn(k), qty: APP.cart[k], cover: b.Cover_Price, price: b.Emp_Selling_Price }; }); };
/** محتوى صفحة تأكيد الحجز: كتب كل ابن وصفه ثم الإجمالي وخطة السداد */
function resSummaryHTML(lines, opts) {
  const gs = resGroups(lines), cnt = lines.reduce((a, l) => a + l.qty, 0), net = gs.reduce((a, g) => a + g.net, 0), cover = gs.reduce((a, g) => a + g.cover, 0), pc = Emp.planCalc(net), p = APP.plan;
  return `<div class="text-center"><div class="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl animate-pop-in">${ic("circle-check")}</div>
    <h3 class="text-xl font-bold text-slate-900 mt-3">${esc(opts.title)}</h3>${opts.msg ? `<p class="text-[13px] text-slate-500 mt-1">${esc(opts.msg)}</p>` : ""}</div>
  <div class="space-y-3 mt-4">${gs.map(g => `<section class="rounded-2xl ring-1 ring-slate-200 overflow-hidden">
      <div class="flex items-center gap-3 px-3.5 py-2.5 bg-brand-50/60"><span class="text-[26px] leading-none">${g.emoji}</span>
        <div class="flex-1 min-w-0"><div class="font-bold text-slate-900 truncate">${esc(g.title)}</div>${g.sub ? `<div class="text-[12px] text-brand-700 font-semibold">${esc(g.sub)}</div>` : ""}</div>
        <div class="text-left shrink-0"><div class="font-bold text-brand-800 num">${moneyTxt(g.net)}</div><div class="text-[11px] text-slate-500">${booksWord(g.count)}</div></div></div>
      <ul class="divide-y divide-slate-100">${g.lines.map(l => `<li class="flex items-center gap-2 px-3.5 py-2 text-[13px]"><span class="flex-1 min-w-0 truncate text-slate-700">${esc(l.name)}</span>${l.qty > 1 ? `<span class="text-slate-400 num">×${l.qty}</span>` : ""}<span class="num font-semibold text-slate-800 text-left whitespace-nowrap">${lineAmt(l)}</span></li>`).join("")}</ul></section>`).join("")}</div>
  <div class="rounded-2xl bg-slate-50 p-3.5 mt-3 space-y-1.5 text-[13.5px]">
    <div class="flex justify-between text-slate-500"><span>${booksWord(cnt)} قبل الخصم</span><span class="line-through num">${moneyTxt(cover)}</span></div>
    <div class="flex justify-between text-emerald-600 font-semibold"><span>وفّرت 🎉</span><span class="num">${moneyTxt(cover - net)}</span></div>
    <div class="flex justify-between items-baseline pt-1.5 border-t border-slate-200"><b class="text-slate-900">الإجمالي</b><span class="text-2xl font-bold text-brand-800 num">${money(net)}</span></div>
    ${p.method === "INSTALLMENT" ? `<div class="flex justify-between text-[12.5px] text-slate-600 pt-1"><span>مقدم عند الاستلام</span><b class="num">${moneyTxt(pc.down)}</b></div><div class="flex justify-between text-[12.5px] text-slate-600"><span>ثم ${pc.cnt} أقساط شهرية</span><b class="num">${moneyTxt(pc.per)}${pc.last !== pc.per ? " (الأخير " + fmt(pc.last) + ")" : ""}</b></div>`
      : `<div class="flex justify-between text-[12.5px] text-slate-600 pt-1"><span>السداد</span><b>${esc(Doc.methodAr(p.method))} عند الاستلام</b></div>`}
  </div>
  <div class="mt-3 rounded-2xl bg-brand-50 text-brand-900 text-[12.5px] p-3 flex gap-2">${ic("info", "mt-0.5 shrink-0")}<span>تقدر تعدّل حجزك لحد قفل الحجز. هنبلغك بإشعار لما الكتب تبقى جاهزة للاستلام 📦</span></div>`;
}
on("submitRes", async () => {
  const items = Object.keys(APP.cart).map(id => ({ bookId: bk(id), beneficiary: bn(id), qty: APP.cart[id] }));
  const t = Emp.totals(), pc = Emp.planCalc(t.net);
  if (APP.plan.method === "INSTALLMENT" && items.length && !pc.ok) return toast(`أقل مقدم مسموح ${moneyTxt(pc.minDown)}`, "warning");
  if (!items.length && !(await UI.confirm({ title: "إلغاء الحجز", message: "الاستمارة فارغة، وسيتم إلغاء حجزك في هذه المرحلة بالكامل. متابعة؟", tone: "danger", ok: "إلغاء الحجز" }))) return;
  const r = await call("SUBMIT_OR_UPDATE_RESERVATION", { phaseId: APP.phaseId, items, paymentMethod: APP.plan.method, downPaymentType: APP.plan.downType, downPaymentInput: n(APP.plan.down), installmentCount: APP.plan.count }, { block: true });
  if (!r.success) return toast(r.message, "danger");
  if (r.queued) { if (Emp._cartSheet) { Emp._cartSheet.close(); Emp._cartSheet = null; } return UI.open(`<div class="text-center py-4"><div class="text-4xl">${r.busy ? "⏳" : "📴"}</div><h3 class="text-xl font-bold mt-3">حجزك اتحفظ على موبايلك</h3><p class="text-sm text-slate-600 mt-1">${esc(r.message)} — هيوصلك تأكيد أول ما يتبعت. ما تمسحش التطبيق لحد ما يتبعت 🙏</p></div>`, { footer: `<button data-close class="btn btn-primary w-full">تمام</button>` }); }
  Emp.dirty = false; Emp.cartStep = "list";
  if (Emp._cartSheet) { Emp._cartSheet.close(); Emp._cartSheet = null; }
  if (Router.current === "/e/cart" || Router.current === "/e/wiz") Router.go("/e/home");
  (r.warnings || []).forEach(w => toast(w, "warning"));
  await Emp.load();
  if (!items.length) { UI.open(`<div class="text-center py-4"><div class="text-4xl">🗑️</div><h3 class="text-xl font-bold mt-3">تم إلغاء الحجز</h3><p class="text-sm text-slate-600 mt-1">ولا يهمك — شكراً إنك كنت معانا، والمبادرة مستنياك في أي وقت 🌷</p><p class="text-sm text-slate-500 mt-2">${esc(r.message || "")}</p></div>`, { footer: `<button data-close class="btn btn-primary w-full">تم</button>` }); return; }
  UI.open(resSummaryHTML(cartLines(), { title: "تمام! حجزك اتسجل 🎉 — شكراً لثقتك 💜", msg: r.message }), { title: "تأكيد الحجز",
    footer: `<div class="grid grid-cols-2 gap-2 mb-2"><button data-act="printRes" class="btn btn-outline">${ic("download")} صورة / PDF</button><button data-act="shareWa" class="btn btn-success">${ic("message-circle")} أرسله واتساب</button></div><div class="flex gap-2"><a href="#/e/orders" data-act="goClose" data-id="/e/orders" class="btn btn-primary flex-1">متابعة حجوزاتي</a><button data-close class="btn btn-outline">تم</button></div>` });
  wzClear(); Emp.wzManual = false;
});

// ============================================================ معالج الحجز خطوة بخطوة
// العائلة ← حجز كل فرد (الأشهر / سلسلة / بنفسي) ← المراجعة ← السداد ← الحفظ والمشاركة
const WZ_KEY = () => "wb_wz_" + (APP.user && APP.user.empId);
const WZ = { step: "family", i: 0, sel: null, temp: [], mode: {}, pub: {}, later: {}, noBooks: {}, done: {}, guideStep: 0, forceGuide: false };
const wzSave = () => { try { localStorage.setItem(WZ_KEY(), JSON.stringify({ step: WZ.step, i: WZ.i, sel: WZ.sel, temp: WZ.temp, mode: WZ.mode, pub: WZ.pub, later: WZ.later, noBooks: WZ.noBooks, done: WZ.done })); } catch (_) {} };
const wzLoad = () => { try { const o = JSON.parse(localStorage.getItem(WZ_KEY())); if (o) Object.assign(WZ, o); return !!o; } catch (_) { return false; } };
const wzClear = () => { Object.assign(WZ, { step: "family", i: 0, sel: null, temp: [], mode: {}, pub: {}, later: {}, noBooks: {}, done: {}, guideStep: 0, forceGuide: false }); try { localStorage.removeItem(WZ_KEY()); } catch (_) {} };
/** أفراد الرحلة: المختارون من «أبنائي وأقاربي» + صفوف أُضيفت بدون تسجيل */
function wzMembers() { const ks = myKids(), sel = WZ.sel || ks.map((_, i) => i); return sel.filter(i => ks[i]).map(i => Object.assign({ _ix: i }, ks[i])).concat(WZ.temp.map(t => Object.assign({ _temp: true }, t))); }
/** حالة كل فرد (اتحجز/مؤجل/مش محتاج) بمفتاح ثابت للفرد نفسه — لا تتلخبط لو اتغير ترتيب الأفراد أو اتضاف/اتشال حد */
const wzKey = m => !m ? "" : m._temp ? "g:" + m.grade + "|" + (m.type || "") + "|" + (m.track || "") : (kidBen(m) || "k:" + m.grade + "|" + (m.name || "") + "|" + (m.gender || ""));
const wzSt = (kind, idx) => !!(WZ[kind] || {})[wzKey(wzMembers()[+idx])];
const wzSet = (kind, idx, on) => { const k = wzKey(wzMembers()[+idx]); if (!k) return; WZ[kind] = WZ[kind] || {}; if (on) WZ[kind][k] = true; else delete WZ[kind][k]; };
const wzName = (m, i) => m._temp ? gradeTitle(m.grade) : kidName(m, m._ix);
function wzFocus(m) { Emp.filter.grade = m.grade; Emp.filter.type = m.type || ""; Emp.filter.track = m.track || ""; Emp.filter.q = ""; Emp.ben = kidBen(m); if (Emp.ben && !Emp.bens.includes(Emp.ben)) Emp.bens.push(Emp.ben); }
const wzGo = (step, i) => { WZ.step = step; if (i !== undefined) WZ.i = i; wzSave(); if (Router.current !== "/e/wiz") Router.go("/e/wiz"); else Shell.rerender(); scrollTo({ top: 0 }); };

function wzSteps() {
  const ms = wzMembers(), steps = [["family", "العائلة"], ["member", "الكتب"], ["review", "المراجعة"], ["pay", "السداد"]], cur = steps.findIndex(s => s[0] === WZ.step);
  return `<ol class="flex items-center gap-1.5 mb-4">${steps.map((s, k) => `<li class="flex-1"><div class="h-1.5 rounded-full ${k <= cur ? "bg-brand-600" : "bg-slate-200"}"></div><div class="text-[11px] mt-1 font-semibold ${k === cur ? "text-brand-800" : "text-slate-400"}">${s[1]}${s[0] === "member" && ms.length > 1 && WZ.step === "member" ? ` <span class="num">${WZ.i + 1}/${ms.length}</span>` : ""}</div></li>`).join("")}</ol>`;
}
const personCard = (k, i, on, act) => `<button class="min-w-0 text-right rounded-2xl p-2.5 ring-2 transition active:scale-[.98] flex items-center gap-2 ${on ? "ring-brand-600 bg-brand-50" : "ring-slate-200 bg-white opacity-70"}" data-act="${act}" data-id="${i}">
  <span class="w-10 h-10 rounded-xl ${k.rel ? "bg-sky-50" : "bg-gold-50"} flex items-center justify-center text-[22px] shrink-0">${kidEmoji(k)}</span>
  <span class="flex-1 min-w-0"><b class="block text-[14.5px] text-slate-900 truncate">${esc(kidName(k, i))}</b><span class="block text-[11.5px] text-slate-500 truncate">${k.rel ? esc(k.rel) + " · " : ""}${esc(gradeShort(k.grade))}${k.type ? " · " + esc(k.type) : ""}${k.track ? " · " + esc(k.track) : ""}</span></span>
  <span class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${on ? "bg-brand-600 text-white" : "ring-2 ring-slate-300"}">${on ? ic("check") : ""}</span></button>`;

const wzGuideKey = () => "wb_wz_guide_off_" + ((APP.user && APP.user.empId) || "");
const wzMarkGuideOff = () => { try { localStorage.setItem(wzGuideKey(), "1"); } catch (_) {} };

function wzFamily() {
  const ks = myKids(), sel = WZ.sel || ks.map((_, i) => i), kids = ks.map((k, i) => [k, i]).filter(x => !x[0].rel), rels = ks.map((k, i) => [k, i]).filter(x => x[0].rel);
  if (WZ.skip) return wzGradePick();
  const firstName = String((APP.user && APP.user.fullName) || "").trim().split(/\s+/)[0];
  const fem = empGender() === "F";
  const greet = `${fem ? "أهلاً بكِ" : "أهلاً بك"}${firstName ? " يا " + firstName : ""} — نجهّز كتب أولادك في دقائق`;
  const cheer = fem ? "تعبك مع أولادك مقدَّر — وإحنا هنا نشيل عنكِ هَمّ الكتب، وربنا يكتب لهم التفوق 🤍" : "تعبك مع أولادك مقدَّر — وإحنا هنا نشيل عنك هَمّ الكتب، وربنا يكتب لهم التفوق 🤍";
  let guideHidden = false;
  try { guideHidden = !!localStorage.getItem(wzGuideKey()); } catch (_) {}
  const showGuide = (!ks.length && !WZ.temp.length && !guideHidden) || !!WZ.forceGuide;
  const gs = Math.max(0, Math.min(2, WZ.guideStep || 0));

  if (showGuide) {
    const why = [["🎯", "كتب كل ابن لوحدها"], ["✏️", "تعديل ابن بدون الباقي"], ["🔁", "استدعاء سريع السنة الجاية"]];
    return `
      <section class="rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden mb-4">
        <div class="p-5 text-white" style="background:linear-gradient(135deg,#552c83,#2e1650)">
          <h1 class="font-display font-bold text-[19px] leading-snug">${esc(greet)}</h1>
          <p class="text-[13px] text-gold-200 mt-1.5 leading-relaxed">${esc(cheer)}</p><p class="text-[12px] text-brand-100 mt-1">${gTxt("اختار طريقة البداية — تقدر تغيّرها في أي وقت.", "اختاري طريقة البداية — تقدري تغيّريها في أي وقت.")}</p>
        </div>
        <div class="p-4 space-y-3">
          <button type="button" data-act="wzGuidePick" data-id="kids" class="w-full text-right rounded-2xl p-4 ring-2 ring-brand-500 bg-brand-50/60 active:scale-[.99] transition">
            <div class="flex items-center gap-3"><span class="w-11 h-11 rounded-xl bg-brand-700 text-white flex items-center justify-center shrink-0">${ic("users")}</span>
              <div class="flex-1 min-w-0"><div class="flex items-center gap-2"><b class="text-[15px] text-brand-950">${gTxt("سجّل أولادك ونبدأ", "سجّلي أولادك ونبدأ")}</b><span class="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-gold-300 text-brand-950">موصى به</span></div>
                <div class="flex flex-wrap gap-1.5 mt-1.5">${why.map(w => `<span class="text-[11px] text-brand-800 bg-white ring-1 ring-brand-100 rounded-full px-2 py-0.5">${w[0]} ${w[1]}</span>`).join("")}</div></div>${ic("chevron-left", "text-brand-400")}</div>
          </button>
          <button type="button" data-act="wzGuidePick" data-id="skip" class="w-full text-right rounded-2xl p-4 ring-1 ring-slate-200 bg-white hover:bg-slate-50 active:scale-[.99] transition">
            <div class="flex items-center gap-3"><span class="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">${ic("zap")}</span>
              <div class="flex-1"><b class="block text-[15px] text-slate-900">${gTxt("احجز بالصف مباشرة", "احجزي بالصف مباشرة")}</b><span class="block text-[12px] text-slate-500 mt-0.5">من غير تسجيل — اختيار الصف والكتب فوراً</span></div>${ic("chevron-left", "text-slate-300")}</div>
          </button>
          <div class="flex items-center justify-between text-[12px] pt-1">${relOn() ? `<button type="button" data-act="addRel" class="font-semibold text-sky-700">${ic("users", "inline -mt-0.5")} إضافة قريب</button>` : "<span></span>"}<button type="button" data-act="wzHideGuide" class="font-semibold text-slate-400">تخطي</button></div>
        </div>
      </section>`;
  }
  const wzMemberLines = m => { const b = kidBen(m); return cartLines().filter(l => b ? l.ben === b : (!l.ben && l.grade === m.grade)); };
  const ms = wzMembers();
  const pickCard = (k, i) => {
    const mIdx = ms.findIndex(x => !x._temp && x._ix === i);
    const lines = wzMemberLines(k);
    const status = lines.length ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">في السلة (${lines.length}) ✓</span>`
      : wzSt("later", mIdx) ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200">متأجل لبعدين ⏳</span>`
      : wzSt("noBooks", mIdx) ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">مش محتاج كتب</span>`
      : `<span class="text-[11px] font-semibold text-brand-600">جاهز للحجز</span>`;
    return `<div class="rounded-2xl p-3 ring-2 ${sel.includes(i) ? "ring-brand-300 bg-white" : "ring-slate-200 bg-slate-50/70 opacity-75"} shadow-xs flex flex-col gap-2.5">
      <div class="flex items-center gap-2.5">
        <span class="w-10 h-10 rounded-xl ${k.rel ? "bg-sky-50" : "bg-gold-50"} flex items-center justify-center text-[22px] shrink-0">${kidEmoji(k)}</span>
        <div class="flex-1 min-w-0">
          <b class="block text-[14.5px] text-slate-900 truncate">${esc(kidName(k, i))}</b>
          <span class="block text-[11.5px] text-slate-500 truncate">${k.rel ? esc(k.rel) + " · " : ""}${esc(gradeShort(k.grade))}${k.type ? " · " + esc(k.type) : ""}${k.track ? " · " + esc(k.track) : ""}</span>
        </div>
        <button type="button" data-act="wzSel" data-id="${i}" aria-label="تضمين في الحجز" class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${sel.includes(i) ? "bg-brand-600 text-white" : "ring-2 ring-slate-300"}">${sel.includes(i) ? ic("check") : ""}</button>
      </div>
      <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <span class="flex items-center gap-2 min-w-0">${status}<button type="button" data-act="kdEditOne" data-id="${i}" class="text-[11.5px] font-semibold text-slate-500 hover:text-brand-700 inline-flex items-center gap-1 shrink-0">${ic("pencil", "!w-3.5 !h-3.5")} البيانات</button></span>
        ${sel.includes(i) && mIdx >= 0 ? `<button type="button" data-act="wzStartOne" data-id="${mIdx}" class="btn btn-primary btn-sm !py-1.5 !px-3 text-[12px]">${lines.length ? "تعديل الكتب" : "ابدأ بـ " + esc(kidName(k, i).split(/\s+/)[0])} ←</button>` : ""}
      </div>
    </div>`;
  };

  return `
    <div class="rounded-3xl p-4 sm:p-5 mb-4 ring-1 ring-brand-200/80 shadow-sm" style="background:linear-gradient(135deg,#faf7ff 0%,#f3ecfc 100%)">
      <div class="flex items-start gap-3">
        <span class="w-11 h-11 rounded-2xl bg-brand-700 text-white flex items-center justify-center shrink-0">${ic("users")}</span>
        <div class="flex-1 min-w-0">
          <h1 class="font-display font-bold text-[18px] sm:text-[20px] text-brand-950 leading-snug">${esc(greet)}</h1>
          <p class="text-[12.5px] text-brand-700 mt-1 leading-relaxed">${esc(cheer)}</p>
          <p class="text-[13px] text-brand-800/80 mt-1 leading-relaxed">${ks.length ? gTxt("اختر تحب تبدأ بحجز مين الأول، أو أضف فرد جديد.", "اختاري تحبي تبدأي بحجز مين الأول، أو أضيفي فرد جديد.") : gTxt("اختر من أولادك أو قرايبك، أو أضف فرد جديد ونجهّزلك الكتب في ثواني.", "اختاري من أولادك أو قرايبك، أو أضيفي فرد جديد ونجهّزلكِ الكتب في ثواني.")}</p>
          
        </div>
      </div>
    </div>

    ${ks.length || WZ.temp.length ? `<div class="flex items-center justify-between mb-2"><span class="text-[13.5px] font-bold text-slate-800">${gTxt("تحب نبدأ بحجز مين الأول؟", "تحبي نبدأ بحجز مين الأول؟")}</span><span class="text-[11.5px] text-slate-500">${gTxt("اضغط على أي فرد للبدء", "اضغطي على أي فرد للبدء")}</span></div>` : ""}
    ${kids.length ? `<div class="text-[12px] font-bold text-brand-700 mb-1.5">أبنائي</div><div class="grid sm:grid-cols-2 gap-2.5 mb-4">${kids.map(([k, i]) => pickCard(k, i)).join("")}</div>` : ""}
    ${rels.length ? `<div class="text-[12px] font-bold text-sky-700 mb-1.5">أقاربي</div><div class="grid sm:grid-cols-2 gap-2.5 mb-4">${rels.map(([k, i]) => pickCard(k, i)).join("")}</div>` : ""}
    ${WZ.temp.length ? `<div class="text-[12px] font-bold text-slate-600 mb-1.5">صفوف بدون تسجيل</div><div class="flex flex-wrap gap-2 mb-4">${WZ.temp.map((t, j) => { const mIdx = ms.findIndex(x => x._temp && x.grade === t.grade); return `<span class="chip">${esc(gradeTitle(t.grade))}${mIdx >= 0 ? `<button type="button" data-act="wzStartOne" data-id="${mIdx}" class="text-brand-700 font-bold mr-1 underline">احجز</button>` : ""}<button data-act="wzTempDel" data-id="${j}" class="text-rose-500" aria-label="حذف">${ic("x")}</button></span>`; }).join("")}</div>` : ""}
    <div class="grid grid-cols-2 gap-2.5">
      <button class="rounded-2xl p-3.5 border-2 border-dashed border-brand-300 bg-brand-50/40 hover:bg-brand-50 text-brand-800 font-bold text-[13.5px] flex items-center justify-center gap-1.5 transition" data-act="${kids.length ? "kidsAddNew" : "kidsEdit"}">${ic("plus")} ${kids.length ? "إضافة ابن / بنت" : gTxt("أضف أبنائي (الأسهل)", "أضيفي أبنائي (الأسهل)")}</button>
      ${relOn() ? `<button class="rounded-2xl p-3.5 border-2 border-dashed border-sky-300 bg-sky-50/40 hover:bg-sky-50 text-sky-800 font-bold text-[13.5px] flex items-center justify-center gap-1.5 transition" data-act="addRel">${ic("users")} إضافة قريب</button>` : `<span></span>`}
    </div>
    <button class="w-full mt-2.5 text-[13px] font-semibold text-slate-600 hover:text-brand-800 underline underline-offset-4 py-2 transition" data-act="wzSkip">${ks.length ? "أو أحجز لصف آخر بدون تسجيل" : gTxt("أو كمّل بدون تسجيل — اختر الصف مباشرة", "أو كمّلي بدون تسجيل — اختاري الصف مباشرة")}</button>
    <button class="btn btn-primary btn-lg w-full mt-3 shadow-soft" data-act="wzStart" ${ms.length ? "" : "disabled"}>${ic("chevron-left")} ${gTxt("ابدأ الحجز بالترتيب", "ابدأي الحجز بالترتيب")} (${ms.length})</button>`;
}
function wzGradePick() {
  const cat = APP.emp.catalog || {}, stages = uniq((cat.grades || []).map(g => g.stage)), cnt = {}; APP.emp.books.forEach(b => cnt[b.Grade] = (cnt[b.Grade] || 0) + 1);
  return `<h1 class="font-display font-bold text-[20px] text-slate-900">${gTxt("اختر الصف", "اختاري الصف")}</h1><p class="text-[13px] text-slate-500 mt-1 mb-4">${gTxt("بدون تسجيل — علّم كل الصفوف اللي محتاجها، ونحجز لكل صف لوحده كأنه ابن.", "بدون تسجيل — علّمي كل الصفوف اللي محتاجاها، ونحجز لكل صف لوحده كأنه ابن.")}</p>
    ${stages.map(s => `<div class="text-[12.5px] font-bold text-brand-700 mb-2">${esc(s)}</div><div class="grid grid-cols-3 gap-2 mb-4">${(cat.grades || []).filter(g => g.stage === s && cnt[g.label]).map(g => { const on = (Emp.gsel || []).includes(g.label); return `<button class="relative rounded-2xl p-3 font-bold text-[15px] active:scale-95 transition ring-1 ${on ? "bg-brand-700 text-white ring-brand-700" : "bg-white ring-slate-200"}" data-act="gpSel" data-id="${esc(g.label)}" aria-pressed="${on}">${on ? `<span class="absolute top-1 left-1">${ic("check", "!w-3.5 !h-3.5")}</span>` : ""}${esc(gradeShort(g.label))}</button>`; }).join("")}</div>`).join("")}
    <button class="btn btn-primary btn-lg w-full mb-2" data-act="gpStart" ${(Emp.gsel || []).length ? "" : "disabled"}>${(Emp.gsel || []).length ? `ابدأ الحجز لـ ${Emp.gsel.length === 1 ? "صف واحد" : Emp.gsel.length === 2 ? "صفين" : Emp.gsel.length + " صفوف"} — صف صف ←` : gTxt("اختار صف أو أكتر", "اختاري صف أو أكتر")}</button>
    <button class="btn btn-ghost w-full" data-act="wzUnskip">${ic("arrow-right")} رجوع</button>`;
}
function wzMember() {
  const ms = wzMembers(), m = ms[WZ.i]; if (!m) return wzReviewHTML();
  wzFocus(m);
  const mode = WZ.mode[WZ.i];
  const head = `<div class="rounded-3xl p-4 mb-4 text-white flex items-center gap-3 shadow-sm" style="background:linear-gradient(135deg,#6a3aa0,#381c62)">
    <span class="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center text-[28px] shrink-0">${m._temp ? "📚" : kidEmoji(m)}</span>
    <div class="flex-1 min-w-0">
      <div class="text-[11.5px] font-bold text-gold-200 flex items-center gap-1.5"><span>📌 ${gTxt("أنت تحجز الآن لـ", "أنتِ تحجزين الآن لـ")}</span>${ms.length > 1 ? `<span class="px-1.5 py-0.5 rounded-full bg-white/15 text-white text-[10.5px]">${WZ.i + 1} من ${ms.length}</span>` : ""}</div>
      <div class="font-display font-bold text-[19px] leading-tight truncate mt-0.5">${esc(wzName(m))}${m.rel ? ` <span class="text-[13px] text-brand-200">(${esc(m.rel)})</span>` : ""}</div>
      <div class="text-[12.5px] text-brand-100">${m._temp ? "" : esc(gradeTitle(m.grade))}${m.type ? " · مدارس " + esc(m.type) : ""}${m.track ? " · " + esc(m.track) : ""}</div>
    </div>
    <button type="button" data-act="wzToFamily" class="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white shrink-0">تغيير</button>
  </div>`;
  if (!mode) return head + `<h2 class="font-bold text-slate-900 text-[16px] mb-1">${gTxt(`تحب نحجز كتب ${esc(wzName(m))} إزاي؟`, `تحبي نحجز كتب ${esc(wzName(m))} إزاي؟`)}</h2>
    <p class="text-[12.5px] text-slate-500 mb-3">${gTxt("اختر الطريقة الأريح لك، أو أجّله لبعدين لو لسه معرفتش الكتب.", "اختاري الطريقة الأريح لكِ، أو أجّليه لبعدين لو لسه معرفتيش الكتب.")}</p>
    <div class="grid gap-2.5">${[["manual", "🔍", "أختار بنفسي", gTxt("تتصفح كتب الصف وتختار كل كتاب واحد بواحد على مزاجك", "تتصفحي كتب الصف وتختاري كل كتاب واحد بواحد على مزاجك"), "bg-white ring-slate-200"],
      ["popular", "🎒", "شنطة الكتب", gTxt("كل مادة وتحتها كل كتبها — تختار كتاب لكل مادة بنفسك", "كل مادة وتحتها كل كتبها — تختاري كتاب لكل مادة بنفسك"), "bg-gold-50 ring-gold-300"],
      ["series", "📚", "السلسلة (شركة واحدة)", gTxt("لو كتبك كلها من شركة واحدة زي الأضواء أو سلاح التلميذ نجهّزها لك بدون ما تدور", "لو كتبك كلها من شركة واحدة زي الأضواء أو سلاح التلميذ نجهّزها لكِ بدون ما تدوري"), "bg-brand-50 ring-brand-200"]].map(o => `<button class="text-right rounded-2xl p-4 ring-2 ${o[4]} flex items-center gap-3 active:scale-[.98] transition" data-act="wzMode" data-id="${o[0]}">
        <span class="text-[30px]">${o[1]}</span><span class="flex-1"><b class="block text-[15.5px] text-slate-900">${o[2]}</b><span class="block text-[12.5px] text-slate-600 mt-0.5">${o[3]}</span></span>${ic("chevron-left", "text-slate-400")}</button>`).join("")}</div>
    <div class="grid sm:grid-cols-2 gap-2 mt-3">
      <button type="button" class="rounded-2xl p-3 ring-1 ring-amber-200 bg-amber-50/70 hover:bg-amber-50 text-amber-950 font-semibold text-[12.5px] flex items-center justify-center gap-1.5 transition" data-act="wzDefer">⏳ ${gTxt("خليه بعدين (لسه معرفتش الكتب)", "خليه بعدين (لسه معرفتيش الكتب)")}</button>
      <button type="button" class="rounded-2xl p-3 ring-1 ring-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-[12.5px] flex items-center justify-center gap-1.5 transition" data-act="wzNoBooks">🚫 مش محتاج كتب الترم ده</button>
    </div>
    <button class="btn btn-ghost w-full mt-2" data-act="wzToFamily">${ic("arrow-right")} رجوع لاختيار العائلة</button>`;
  if (mode === "series" && !WZ.pub[WZ.i]) {
    const list = gradeList().list, by = {}; list.forEach(b => (by[b.Publisher] = by[b.Publisher] || new Set()).add(b.Subject));
    const pubs = Object.keys(by).sort((a, b) => by[b].size - by[a].size);
    return head + `<h2 class="font-bold text-slate-900 text-[16px] mb-3">${gTxt("اختار السلسلة", "اختاري السلسلة")} لـ ${esc(wzName(m))}</h2>${pubs.length ? `<div class="grid grid-cols-2 gap-2">${pubs.map(p => `<button class="rounded-2xl bg-white ring-1 ring-slate-200 p-3 text-right active:scale-[.98] flex items-center gap-2" data-act="wzPub" data-id="${esc(p)}">
      ${logoFor(APP.emp.pubLogos, p, "") ? `<span class="w-12 h-9 rounded-lg bg-white ring-1 ring-slate-100 flex items-center justify-center p-0.5 shrink-0"><img src="${esc(logoFor(APP.emp.pubLogos, p, ""))}" alt="" class="max-w-full max-h-full object-contain"></span>` : ""}
      <span class="min-w-0"><b class="block text-[14px] text-slate-900 truncate">${esc(p)}</b><span class="text-[11.5px] text-slate-500">${by[p].size} مادة</span></span></button>`).join("")}</div>` : Art.empty("books", "لا توجد كتب مسعّرة لهذا الصف بعد", "")}
      <button class="btn btn-ghost w-full mt-3" data-act="wzModeReset">${ic("arrow-right")} تغيير الطريقة</button>`;
  }
  // الأشهر أو السلسلة: قائمة مقترحة قابلة للتعديل
  if (!BAG._for || BAG._for !== WZ.i + "|" + mode + "|" + (WZ.pub[WZ.i] || "")) {
    BAG.rows = bagBuild(); BAG._for = WZ.i + "|" + mode + "|" + (WZ.pub[WZ.i] || "");
    if (mode === "series") BAG.rows.forEach(r => { const o = r.opts.find(x => x.Publisher === WZ.pub[WZ.i]); if (o) { r.pick = o.Book_ID; r.on = true; } else r.on = r.had; });
  }
  BAG.inline = true;
  return head + (BAG.rows.length ? `<div id="wzBag">${bagHTML()}</div>` : Art.empty("books", "لا توجد كتب مسعّرة لهذا الصف بعد", gTxt("تقدر تكمل لباقي الأفراد", "تقدري تكمّلي لباقي الأفراد")))
    + `<div class="sticky bottom-[calc(4.6rem+env(safe-area-inset-bottom))] md:bottom-4 mt-4 grid grid-cols-[auto_1fr] gap-2 bg-slate-50/90 backdrop-blur py-2">
      <button class="btn btn-outline" data-act="wzModeReset">${ic("arrow-right")} طريقة أخرى</button>
      <button class="btn btn-primary btn-lg" data-act="wzNext">${ic("check")} إضافة للسلة والمتابعة ←</button></div>`;
}
function wzAfterMemberHTML() {
  const ms = wzMembers(), m = ms[WZ.i]; if (!m) return wzReviewHTML();
  const b = kidBen(m), lines = cartLines().filter(l => b ? l.ben === b : (!l.ben && l.grade === m.grade));
  const rem = ms.map((x, idx) => ({ m: x, idx })).filter(x => x.idx !== WZ.i && !wzSt("done", x.idx) && !wzSt("later", x.idx) && !wzSt("noBooks", x.idx));
  return `
    <div class="rounded-3xl p-5 bg-white ring-1 ring-emerald-200 shadow-sm space-y-4 text-center">
      <div class="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-[30px]">✅</div>
      <div>
        <h1 class="font-display font-bold text-[20px] text-slate-900">${lines.length ? `تمت إضافة كتب ${esc(wzName(m))} في السلة!` : `${gTxt("ما اخترتش", "ما اخترتيش")} كتب لـ ${esc(wzName(m))} لسه`}</h1>
        <p class="text-[13px] text-slate-500 mt-1">${lines.length ? `${gTxt("اخترت", "اخترتي")} ${booksWord(lines.reduce((s, l) => s + l.qty, 0))} جاهزة في سلتك.` : "تم حفظ اختياراتك في السلة."}</p>
      </div>
      ${rem.length ? `
        <div class="rounded-2xl bg-brand-50/70 ring-1 ring-brand-100 p-3.5 text-right space-y-2.5">
          <div class="font-bold text-[14px] text-brand-950">${gTxt("تحب تعمل إيه دلوقتي؟", "تحبي تعملي إيه دلوقتي؟")}</div>
          <button type="button" data-act="wzNextMember" data-id="${rem[0].idx}" class="btn btn-primary btn-lg w-full justify-center">📚 نكمل مع ${esc(wzName(rem[0].m))} ←</button>
          ${rem.length > 1 ? `<div class="flex flex-wrap gap-1.5 pt-1"><span class="text-[11.5px] text-slate-500 self-center">${gTxt("أو اختر:", "أو اختاري:")}</span>${rem.slice(1).map(x => `<button type="button" data-act="wzNextMember" data-id="${x.idx}" class="chip hover:bg-brand-100 font-bold text-brand-800">${kidEmoji(x.m)} ${esc(wzName(x.m))}</button>`).join("")}</div>` : ""}
          <button type="button" data-act="wzReview" class="btn btn-outline w-full justify-center">🛒 نشوف السلة ونكمّل الباقي وقت تاني</button>
        </div>` : `
        <div class="space-y-2.5">
          <p class="text-[13px] font-semibold text-emerald-700">${gTxt("كل الأولاد تمام! جاهز نراجع الحجز ونختار طريقة السداد؟ 🎉", "كل الأولاد تمام! جاهزة نراجع الحجز ونختار طريقة السداد؟ 🎉")}</p>
          <button type="button" data-act="wzReview" class="btn btn-primary btn-lg w-full justify-center">👀 مراجعة الحجز وتأكيد السداد ←</button>
        </div>`}
      <button type="button" data-act="wzToFamily" class="text-[12.5px] font-semibold text-brand-700 hover:underline">👨‍👩‍👧‍👦 العودة لقائمة العائلة</button>
    </div>`;
}
function wzReviewHTML() {
  const lines = cartLines(), gs = resGroups(lines), t = Emp.totals();
  return `<h1 class="font-display font-bold text-[22px] text-slate-900">${gTxt("راجع حجزك 👀", "راجعي حجزك 👀")}</h1><p class="text-[13.5px] text-slate-500 mt-1 mb-4">${gTxt("كتب كل فرد لوحده — اضغط «تعديل» لأي حد، أو تقدر تحفظ السلة وتكمّل باقي الأولاد وقت تاني.", "كتب كل فرد لوحده — اضغطي «تعديل» لأي حد، أو تقدري تحفظي السلة وتكمّلي باقي الأولاد وقت تاني.")}</p>
    ${gs.length ? gs.map(g => `<section class="rounded-2xl ring-1 ring-slate-200 bg-white overflow-hidden mb-3">
      <div class="flex items-center gap-2.5 px-3.5 py-2.5 bg-brand-50/60"><span class="text-[24px]">${g.emoji}</span><div class="flex-1 min-w-0"><b class="block text-slate-900 truncate">${esc(g.title)}</b>${g.sub ? `<span class="text-[12px] text-brand-700 font-semibold">${esc(g.sub)}</span>` : ""}</div>
        <div class="text-left"><b class="num text-brand-800">${moneyTxt(g.net)}</b><div class="text-[11px] text-slate-500">${booksWord(g.count)}</div></div></div>
      <ul class="divide-y divide-slate-100 px-3.5">${g.lines.map(l => `<li class="flex items-center gap-2 py-2 text-[13px]"><span class="flex-1 truncate text-slate-700">${esc(l.name)}</span>${l.qty > 1 ? `<span class="num text-slate-400">×${l.qty}</span>` : ""}<span class="num font-semibold text-left whitespace-nowrap">${lineAmt(l)}</span></li>`).join("")}</ul>
      <div class="px-3.5 pb-3"><button class="btn btn-ghost btn-sm" data-act="wzEdit" data-id="${esc(g.lines[0].ben || "")}|${esc(g.lines[0].grade || "")}">${ic("pencil")} تعديل</button></div></section>`).join("")
      : Art.empty("cart", gTxt("لسه ما اخترتش كتب", "لسه ما اخترتيش كتب"), gTxt("ارجع واختار كتب لكل فرد", "ارجعي واختاري كتب لكل فرد"))}
    <div class="rounded-2xl bg-slate-50 p-3.5 text-[13.5px] space-y-1.5"><div class="flex justify-between text-slate-500"><span>${booksWord(t.count)} قبل الخصم</span><span class="line-through num">${moneyTxt(t.cover)}</span></div>
      <div class="flex justify-between text-emerald-600 font-semibold"><span>${gTxt("وفّرت 🎉", "وفّرتي 🎉")}</span><span class="num">${moneyTxt(t.cover - t.net)}</span></div>
      <div class="flex justify-between items-baseline pt-1.5 border-t border-slate-200"><b>الإجمالي</b><span class="text-2xl font-bold text-brand-800 num">${money(t.net)}</span></div></div>
    <button class="btn btn-ghost w-full mt-2" data-act="wzToFamily">${ic("plus")} إضافة أو استكمال فرد آخر</button>
    <button class="btn btn-primary btn-lg w-full mt-2" data-act="wzPay" ${t.count ? "" : "disabled"}>${ic("check")} ${gTxt("تمام راجعت — نختار طريقة السداد", "تمام راجعت — نختار طريقة السداد")} ←</button>`;
}
function wzPayHTML() {
  return `<h1 class="font-display font-bold text-[22px] text-slate-900">السداد والتأكيد 💳</h1><p class="text-[13.5px] text-slate-500 mt-1 mb-4">${gTxt("اختار طريقة السداد، وبعدها راجع وأكّد الحجز.", "اختاري طريقة السداد، وبعدها راجعي وأكّدي الحجز.")}</p>
    <div class="wiz-pay card card-pad"></div><button class="btn btn-ghost w-full mt-2" data-act="wzReview">${ic("arrow-right")} رجوع للمراجعة</button>`;
}
Router.add("/e/wiz", view => {
  if (!APP.emp.activePhase || !Emp.open()) { view.innerHTML = Art.empty("calendar", "الحجز مغلق حالياً", "تابع الإشعارات لمعرفة موعد الحجز القادم"); return; }
  const body = WZ.step === "member" ? wzMember() : WZ.step === "afterMember" ? wzAfterMemberHTML() : WZ.step === "review" ? wzReviewHTML() : WZ.step === "pay" ? wzPayHTML() : wzFamily();
  view.innerHTML = `<div class="max-w-xl mx-auto">${wzSteps()}${body}<div class="h-6"></div></div>`;
  if (WZ.step === "pay") refreshCartViews();
});
const bagRenderInline = () => { const el = $("#wzBag"); if (el) el.innerHTML = bagHTML(); };
on("wizStart", () => { if (!wzLoad()) { wzClear(); if (Emp.activeItems().length) WZ.step = "review"; } Router.go("/e/wiz"); });
on("wzHideGuide", () => { wzMarkGuideOff(); WZ.forceGuide = false; Shell.rerender(); });
on("wzShowGuide", () => { WZ.guideStep = 0; WZ.forceGuide = true; Shell.rerender(); });
on("wzGuideStep", v => { WZ.guideStep = +v || 0; Shell.rerender(); });
on("wzGuidePick", v => { wzMarkGuideOff(); WZ.forceGuide = false; if (v === "kids") { Shell.rerender(); KD._addRel = false; kidsEditor(false); } else if (v === "skip") { Shell.rerender(); gbOpen(); } else { Shell.rerender(); } });
on("wzSel", v => { const ks = myKids(); WZ.sel = WZ.sel || ks.map((_, i) => i); const i = +v; WZ.sel = WZ.sel.includes(i) ? WZ.sel.filter(x => x !== i) : WZ.sel.concat(i).sort((a, b) => a - b); wzSave(); Shell.rerender(); });
on("wzSkip", () => gbOpen());
on("wzUnskip", () => { WZ.skip = false; Shell.rerender(); });

// ================================================================ الحجز بالصف الدراسي — نفس أسلوب «أبنائي»: محادثة خطوة بخطوة
// المرحلة ← الصف ← نوع المدرسة ← الشعبة (لو فيه) ← «خلاص كده ولا هتضيف صف تاني؟» ← ابدأ الحجز (لكل صف: الشنطة/السلسلة/بنفسي)
const GB = { list: [], i: 0, m: null };
const gbBlank = () => ({ _stage: "", grade: "", type: "", track: "", _typeOk: false, _trackOk: false });
function gbHTML() {
  const cat = APP.emp.catalog || {}, stages = uniq((cat.grades || []).map(g => g.stage)), k = GB.list[GB.i] || gbBlank();
  const st = k._stage || ((cat.grades || []).find(g => g.label === k.grade) || {}).stage || "";
  const tracks = k.grade ? gradeTracks(k.grade) : [], typeDone = !!(k.grade && k._typeOk), trackDone = typeDone && (!tracks.length || k._trackOk);
  const types = [["حكومي", "building-2", "عربي"], ["لغات", "graduation-cap", "تجريبي / لغات"], ["أزهر", "book-marked", "معاهد أزهرية"], ["", "layout-grid", "اعرض الكل"]];
  const ready = GB.list.filter(x => x.grade && x._typeOk && (!gradeTracks(x.grade).length || x._trackOk));
  const bubble = t => `<div class="flex items-start gap-2"><span class="w-8 h-8 rounded-full bg-brand-700 text-white flex items-center justify-center shrink-0">${ic("sparkles", "!w-4 !h-4")}</span><div class="rounded-2xl rounded-tr-sm bg-brand-50 ring-1 ring-brand-100 px-3.5 py-2.5 text-[13.5px] text-brand-950 leading-relaxed">${t}</div></div>`;
  const steps = [
    { id: "stage", t: "المرحلة", q: "في أي مرحلة دراسية؟", done: !!st, v: esc(st), body: `<div class="grid grid-cols-2 gap-2">${stages.map(x => `<button class="rounded-2xl px-3 py-3 text-[13.5px] font-bold ring-1 bg-white text-slate-700 ring-slate-200 active:scale-95 transition" data-act="gbStage" data-id="${esc(x)}">${esc(x.replace("المرحلة ", ""))}</button>`).join("")}</div>` },
    { id: "grade", t: "الصف", q: "في سنة كام؟", done: !!k.grade, v: esc(gradeTitle(k.grade || "")), body: `<div class="grid grid-cols-3 gap-2">${(cat.grades || []).filter(g => g.stage === st).map(g => `<button class="h-12 rounded-xl text-[14px] font-bold ring-1 bg-white text-slate-700 ring-slate-200 active:scale-95 transition" data-act="gbGrade" data-id="${esc(g.label)}">${esc(gradeShort(g.label))}</button>`).join("")}</div>` },
    { id: "type", t: "نوع المدرسة", q: "نوع المدرسة إيه؟", done: typeDone, v: esc(k.type || "كل المدارس"), body: `<div class="grid grid-cols-2 gap-2">${types.map(t => `<button class="rounded-2xl p-2.5 text-right ring-1 flex items-center gap-2 bg-white ring-slate-200 active:scale-95 transition" data-act="gbType" data-id="${esc(t[0])}"><span class="w-8 h-8 rounded-lg flex items-center justify-center ${t[0] ? (SCHOOL_TONE[t[0]] || "") : "bg-slate-100 text-slate-500"}">${ic(t[1])}</span><span class="leading-tight"><b class="block text-[13.5px] text-slate-800">${esc(t[0] || "لا أعرف")}</b><span class="block text-[11px] text-slate-500">${esc(t[2])}</span></span></button>`).join("")}</div>` }]
    .concat(tracks.length ? [{ id: "track", t: "الشعبة", q: "الشعبة إيه؟", done: trackDone, v: esc(k.track || "لسه مش محددة"), body: `<div class="grid grid-cols-2 gap-2">${tracks.concat([""]).map(t => `<button class="rounded-2xl px-3 py-2.5 text-[13px] font-bold ring-1 text-right bg-white text-slate-700 ring-slate-200 active:scale-95 transition" data-act="gbTrack" data-id="${esc(t)}">${t ? esc(t) : "لسه مش عارف"}</button>`).join("")}</div>` }] : []);
  const curIx = steps.findIndex(x => !x.done), cur = steps[curIx], done = curIx < 0;
  return `${bubble(GB.list.length > 1 ? `تمام 👌 ${gTxt("كمّل", "كمّلي")} بيانات الصف ده` : `${gTxt("أهلاً بيك", "أهلاً بيكِ")}! هنحجز <b>بالصف الدراسي</b> 📚 — ${gTxt("قولّي", "قوليلي")} الصف ونوع المدرسة، ونجهّز كتبه. ${gTxt("تقدر تضيف", "تقدري تضيفي")} أكتر من صف.`)}
  ${GB.list.length > 1 ? `<div class="flex gap-2 overflow-x-auto mt-3 pb-1" style="scrollbar-width:none">${GB.list.map((x, i) => `<button class="shrink-0 rounded-xl px-3 h-9 text-[12.5px] font-bold ring-1 ${i === GB.i ? "bg-brand-700 text-white ring-brand-700" : x.grade ? "bg-gold-50 ring-gold-200 text-brand-900" : "bg-white ring-slate-200 text-slate-500"}" data-act="gbPick" data-id="${i}">📚 ${x.grade ? esc(gradeShort(x.grade)) : "صف " + (i + 1)}</button>`).join("")}</div>` : ""}
  <div class="rounded-3xl bg-white ring-1 ring-slate-200 shadow-xs p-4 mt-3 space-y-3">
    <div class="flex items-center justify-between"><b class="text-[14.5px] text-slate-900">${GB.list.length > 1 ? "الصف " + (GB.i + 1) : "الصف الدراسي"}</b>${!done ? `<span class="text-[11.5px] font-semibold text-slate-500">خطوة <b class="num text-brand-700">${curIx + 1}</b> من <span class="num">${steps.length}</span></span>` : `<span class="text-[11.5px] font-bold text-emerald-700">${ic("circle-check", "inline -mt-0.5")} جاهز</span>`}</div>
    <div class="flex gap-1">${steps.map((x, i) => `<span class="h-1.5 flex-1 rounded-full ${x.done ? "bg-emerald-500" : i === curIx ? "bg-brand-600" : "bg-slate-200"}"></span>`).join("")}</div>
    ${steps.filter(x => x.done).map(x => `<div class="flex items-center gap-2.5 rounded-2xl bg-slate-50 px-3 py-2"><span class="w-6 h-6 shrink-0 rounded-full bg-emerald-500 text-white flex items-center justify-center">${ic("check", "!w-3.5 !h-3.5")}</span><span class="min-w-0 flex-1 leading-tight"><span class="block text-[10.5px] text-slate-500">${x.t}</span><span class="block text-[13px] font-bold text-slate-800 truncate">${x.v}</span></span><button type="button" class="text-[12px] font-semibold text-brand-700 px-2 py-1 rounded-lg hover:bg-brand-50" data-act="gbGo" data-id="${x.id}">تغيير</button></div>`).join("")}
    ${cur ? `<div class="animate-pop-in rounded-2xl ring-2 ring-brand-100 bg-brand-50/30 p-3.5 space-y-3"><div class="text-[14px] font-bold text-slate-900">${cur.q}</div>${cur.body}</div>` : ""}
  </div>
  ${done ? `<div class="mt-3 space-y-3 animate-pop-in">${bubble(`${esc(gradeTitle(k.grade))}${k.type ? " · مدارس " + esc(k.type) : ""}${k.track ? " · " + esc(k.track) : ""} — ${kidAvail(k) ? `جاهز له <b class="num">${kidAvail(k)}</b> كتاب بخصم العاملين` : "نعرض كتبه أول ما تتسعّر"} ✅<br><b>خلاص كده ولا ${gTxt("هتضيف", "هتضيفي")} صف تاني؟</b>`)}
    <div class="grid grid-cols-2 gap-2"><button class="btn btn-outline justify-center" data-act="gbAdd">${ic("plus")} صف تاني</button><button class="btn btn-primary justify-center" data-act="gbDone">${ic("check")} خلاص — ابدأ</button></div></div>` : ""}
  ${GB.list.length > 1 ? `<button class="btn btn-ghost btn-sm text-rose-600 mt-2" data-act="gbDel">${ic("x")} شيل الصف ده</button>` : ""}`;
}
const gbRender = () => { if (GB.m && GB.m.body) GB.m.body.innerHTML = gbHTML(); };
function gbOpen() {
  if (!Emp.open()) return toast("الحجز مغلق حالياً", "warning");
  GB.list = [gbBlank()]; GB.i = 0;
  GB.m = UI.open(gbHTML(), { title: "📚 الحجز بالصف الدراسي", sub: "خطوة بخطوة — ولكل صف كتبه" });
}
on("gbOpen", () => gbOpen());
on("gbStage", v => { const k = GB.list[GB.i]; k._stage = v; if (k.grade && !(APP.emp.catalog.grades || []).some(g => g.label === k.grade && g.stage === v)) Object.assign(k, { grade: "", _typeOk: false, _trackOk: false, track: "" }); gbRender(); });
on("gbGrade", v => { const k = GB.list[GB.i]; k.grade = v; k._typeOk = false; k._trackOk = false; if (!gradeTracks(v).includes(k.track)) k.track = ""; gbRender(); });
on("gbType", v => { const k = GB.list[GB.i]; k.type = v; k._typeOk = true; gbRender(); if (navigator.vibrate) navigator.vibrate(8); });
on("gbTrack", v => { const k = GB.list[GB.i]; k.track = v; k._trackOk = true; gbRender(); if (navigator.vibrate) navigator.vibrate(8); });
on("gbGo", v => { const k = GB.list[GB.i]; if (v === "stage") Object.assign(k, { _stage: "", grade: "", _typeOk: false, _trackOk: false, track: "" });
  if (v === "grade") Object.assign(k, { _stage: k._stage || ((APP.emp.catalog.grades || []).find(g => g.label === k.grade) || {}).stage || "", grade: "", _typeOk: false, _trackOk: false, track: "" });
  if (v === "type") { k._typeOk = false; k._trackOk = false; } if (v === "track") k._trackOk = false; gbRender(); });
on("gbAdd", () => { GB.list.push(gbBlank()); GB.i = GB.list.length - 1; gbRender(); });
on("gbPick", v => { GB.i = +v; gbRender(); });
on("gbDel", () => { GB.list.splice(GB.i, 1); if (!GB.list.length) GB.list.push(gbBlank()); GB.i = Math.max(0, GB.i - 1); gbRender(); });
on("gbDone", () => {
  const ok = GB.list.filter(x => x.grade && x._typeOk && (!gradeTracks(x.grade).length || x._trackOk)); if (!ok.length) return;
  const go = gradeOrder(); ok.sort((a, b) => (go[a.grade] ?? 99) - (go[b.grade] ?? 99));
  ok.forEach(x => { if (!WZ.temp.some(t => t.grade === x.grade && (t.type || "") === (x.type || "") && (t.track || "") === (x.track || ""))) WZ.temp.push({ name: "", grade: x.grade, type: x.type || "", track: x.track || "" }); });
  WZ.skip = false; WZ.mode = {}; WZ.pub = {}; BAG._for = ""; Emp.bookMode = ""; wzSave();
  if (GB.m) GB.m.close(); GB.m = null;
  const first = ok[0], i = wzMembers().findIndex(m => m._temp && m.grade === first.grade && (m.type || "") === (first.type || ""));
  toast(ok.length > 1 ? `هنحجز لكل صف لوحده — نبدأ بـ ${gradeShort(first.grade)} 📚` : `يلا نحجز كتب ${gradeShort(first.grade)} 📚`, "info");
  setTimeout(() => wzGo("member", i >= 0 ? i : 0), 250);
});
// اختيار أكتر من صف (بدون تسجيل أبناء) ← الحجز لهم صف صف في المعالج كأنهم أولاد
on("gpSel", g => { Emp.gsel = Emp.gsel || []; Emp.gsel = Emp.gsel.includes(g) ? Emp.gsel.filter(x => x !== g) : Emp.gsel.concat(g); if (navigator.vibrate) navigator.vibrate(6); if (Router.current === "/e/books") renderBookGrid(); else Shell.rerender(); });
on("gpClear", () => { Emp.gsel = []; renderBookGrid(); });
on("gpStart", () => {
  const gs = (Emp.gsel || []).slice(); if (!gs.length) return toast(gTxt("اختار صف الأول", "اختاري صف الأول"), "info");
  if (!Emp.open()) return toast("الحجز مغلق حالياً", "warning");
  const go = gradeOrder(); gs.sort((a, b) => (go[a] ?? 99) - (go[b] ?? 99));
  gs.forEach(g => { if (!WZ.temp.some(t => t.grade === g)) WZ.temp.push({ name: "", grade: g, type: "" }); });
  WZ.skip = false; WZ.mode = {}; WZ.pub = {}; BAG._for = ""; Emp.gsel = []; Emp.bookMode = ""; wzSave();
  const ms = wzMembers(), i = ms.findIndex(m => m._temp && m.grade === gs[0]);
  toast(`هنحجز ${gs.length === 1 ? "للصف" : "لكل صف لوحده"} — نبدأ بـ ${gradeShort(gs[0])} 📚`, "info");
  wzGo("member", i >= 0 ? i : 0);
});
on("wzTempAdd", g => { WZ.temp.push({ name: "", grade: g, type: "" }); WZ.skip = false; wzSave(); Shell.rerender(); });
on("wzTempDel", j => { WZ.temp.splice(+j, 1); wzSave(); Shell.rerender(); });
on("wzStart", () => { WZ.mode = {}; WZ.pub = {}; BAG._for = ""; const ms = wzMembers(); const nxt = ms.findIndex((_, idx) => !wzSt("done", idx) && !wzSt("later", idx) && !wzSt("noBooks", idx)); wzGo("member", nxt >= 0 ? nxt : 0); });
on("wzStartOne", idx => { const i = +idx || 0; wzSet("later", i, false); wzSet("noBooks", i, false); delete WZ.mode[i]; delete WZ.pub[i]; BAG._for = ""; wzGo("member", i); });
on("wzToFamily", () => wzGo("family"));
on("wzMode", v => { WZ.mode[WZ.i] = v; wzSave(); if (v === "manual") { wzFocus(wzMembers()[WZ.i]); Emp.wzManual = true; Router.go("/e/books"); scrollTo({ top: 0 }); return; } Shell.rerender(); });
on("wzModeReset", () => { delete WZ.mode[WZ.i]; delete WZ.pub[WZ.i]; BAG._for = ""; wzSave(); Shell.rerender(); });
on("wzPub", p => { WZ.pub[WZ.i] = p; BAG._for = ""; wzSave(); Shell.rerender(); });
const wzAdvance = () => { const ms = wzMembers(); BAG._for = ""; BAG.inline = false; if (WZ.i + 1 < ms.length) wzGo("member", WZ.i + 1); else wzGo("review"); };
const wzNextUnbooked = () => { const ms = wzMembers(); return ms.findIndex((_, idx) => idx !== WZ.i && !wzSt("done", idx) && !wzSt("later", idx) && !wzSt("noBooks", idx)); };
on("wzNext", () => {
  BAG.rows.filter(r => r.on).forEach(r => { r.opts.forEach(o => { const k = ck(o.Book_ID, Emp.ben); if (o.Book_ID !== r.pick && APP.cart[k]) delete APP.cart[k]; }); APP.cart[ck(r.pick, Emp.ben)] = r.qty || 1; });
  BAG.rows.filter(r => !r.on).forEach(r => r.opts.forEach(o => { delete APP.cart[ck(o.Book_ID, Emp.ben)]; }));
  wzSet("done", WZ.i, true); wzSet("later", WZ.i, false); wzSet("noBooks", WZ.i, false);
  Emp.dirty = true; refreshCartViews(); BAG._for = ""; BAG.inline = false; wzGo("afterMember", WZ.i);
});
on("wzNextMember", idx => { const i = +idx; delete WZ.mode[i]; delete WZ.pub[i]; BAG._for = ""; wzGo("member", i); });
on("wzDefer", () => {
  const m = wzMembers()[WZ.i];
  wzSet("later", WZ.i, true); delete WZ.mode[WZ.i]; delete WZ.pub[WZ.i]; BAG._for = "";
  if (m) toast(`تم تأجيل ${wzName(m)} لبعدين — تقدر ترجع له في أي وقت`, "info");
  const nxt = wzNextUnbooked();
  if (nxt >= 0) wzGo("member", nxt); else wzGo("review");
});
on("wzNoBooks", () => {
  wzSet("noBooks", WZ.i, true); delete WZ.mode[WZ.i]; delete WZ.pub[WZ.i]; BAG._for = "";
  const nxt = wzNextUnbooked();
  if (nxt >= 0) wzGo("member", nxt); else wzGo("review");
});
on("wzPrev", () => { BAG._for = ""; wzGo("member", Math.max(0, WZ.i - 1)); });
on("wzBack", () => { Emp.wzManual = false; wzSet("done", WZ.i, true); wzSet("later", WZ.i, false); wzSet("noBooks", WZ.i, false); BAG._for = ""; wzGo("afterMember", WZ.i); });
on("wzReview", () => wzGo("review"));
on("wzBackReview", () => { Emp.wzManual = false; wzGo("review"); });
on("wzPay", () => { Emp.cartStep = "pay"; wzGo("pay"); });
on("wzEdit", v => { const [ben, grade] = String(v).split("|"); const ms = wzMembers(); let i = ms.findIndex(m => (ben ? kidBen(m) === ben : !kidBen(m) && m.grade === grade)); if (i < 0) { WZ.temp.push({ name: "", grade, type: "" }); i = wzMembers().length - 1; }
  WZ.mode[i] = "manual"; WZ.i = i; wzSave(); wzFocus(wzMembers()[i]); Emp.wzManual = "review"; Router.go("/e/books"); });
/** ملخص نصي للحجز للمشاركة على واتساب */
function resShareText() {
  const gs = resGroups(cartLines()), t = Emp.totals(), pc = Emp.planCalc(t.net);
  return `📚 ${Brand.platform || "منصة حجز الكتب المخفضة"}\nحجز: ${APP.user.fullName} (${APP.user.empId})\n\n` + gs.map(g => `${g.emoji} ${g.title}${g.sub ? " — " + g.sub : ""}\n` + g.lines.map(l => `• ${l.name}${l.qty > 1 ? " ×" + l.qty : ""} = ${n(l.price) ? fmt(l.qty * n(l.price)) : "السعر مع الشحنة"}`).join("\n") + `\nالإجمالي: ${fmt(g.net)} ج.م`).join("\n\n")
    + `\n\n💰 الإجمالي: ${fmt(t.net)} ج.م (وفّرت ${fmt(t.cover - t.net)} ج.م)` + (APP.plan.method === "INSTALLMENT" ? `\nمقدم ${fmt(pc.down)} ثم ${pc.cnt} أقساط × ${fmt(pc.per)}` : `\nالسداد: ${Doc.methodAr(APP.plan.method)}`);
}
on("shareWa", () => { window.open("https://wa.me/?text=" + encodeURIComponent(resShareText()), "_blank"); });

// ============================================================ حجوزاتي
Router.add("/e/orders", view => {
  const r = APP.emp, all = Emp.phaseItems(), inv = Emp.invoice(), bm = Emp.bookMap();
  const isCan = i => String(i.Allocation_Status).startsWith("Cancelled"), items = all.filter(i => !isCan(i)), cancelled = all.filter(isCan);
  if (!r.activePhase) { view.innerHTML = Art.empty("books", "لا توجد حجوزات"); return; }
  const paidPct = inv && n(inv.Net_Final_Invoice_Amount) ? n(inv.Total_Paid_Amount) / n(inv.Net_Final_Invoice_Amount) * 100 : 0;
  view.innerHTML = `
  ${UI.pageHead("حجوزاتي", esc(r.activePhase.Phase_Name), (items.length ? `<button class="btn btn-outline btn-sm" data-act="printRes">${ic("download")} طلب الحجز</button>` : "") + (inv ? `<button class="btn btn-outline btn-sm" data-act="printInv">${ic("printer")} الفاتورة</button>` : ""))}
  ${items.length ? `<section class="card card-pad mb-4"><div class="flex items-center gap-2 mb-3"><span class="w-8 h-8 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">${ic("truck", "!w-4 !h-4")}</span><b class="text-[14px] text-slate-900">تتبّع حجز ${esc(r.activePhase.Phase_Name)}</b>${(r.myReservations || []).some(h => h.Phase_ID !== APP.phaseId) ? `<span class="mr-auto text-[11px] text-slate-500">لمرحلة تانية غيّرها من فوق</span>` : ""}</div>${tracker(items)}</section>` : ""}
  <div class="grid gap-4 lg:gap-6 lg:grid-cols-[1fr_360px] items-start">
    <div class="space-y-3">
      ${items.length ? resGroups(items.map(i => ({ item: i, ben: i.Beneficiary || "", grade: (bm[i.Book_ID] || {}).Grade, qty: n(i.Requested_Qty), price: i.Unit_Emp_Price, cover: (bm[i.Book_ID] || {}).Cover_Price }))).map(g => `
      <div class="flex items-center gap-2.5 pt-2 first:pt-0"><span class="text-[24px] leading-none">${g.emoji}</span><div class="flex-1 min-w-0"><b class="block text-slate-900 text-[15.5px] truncate">${esc(g.title)}</b>${g.sub ? `<span class="text-[12px] text-brand-700 font-semibold">${esc(g.sub)}</span>` : ""}</div><div class="text-left"><b class="num text-brand-800">${moneyTxt(g.net)}</b><div class="text-[11px] text-slate-500">${booksWord(g.count)}</div></div></div>
      ${g.lines.map(l => { const i = l.item;
        const req = n(i.Requested_Qty), al = n(i.Allocated_Qty), dl = n(i.Delivered_Qty), rem = Math.max(0, req - dl), b = bm[i.Book_ID] || {}, [c1, c2] = toneOf(b.Subject);
        return `<article class="card p-4">
          <div class="flex items-start gap-3">
            ${b.Cover_URL ? `<button type="button" class="w-16 h-[5.5rem] rounded-lg shrink-0 overflow-hidden ring-1 ring-slate-200 bg-slate-50 shadow-xs active:scale-95 transition" data-act="coverZoom" data-id="${esc(b.Book_ID)}" aria-label="تكبير الغلاف"><img src="${esc(b.Cover_URL)}" alt="غلاف ${esc(b.Book_Name || "")}" loading="lazy" decoding="async" class="w-full h-full object-cover"></button>`
              : pubLogo(b.Publisher, b.Subject) ? `<div class="w-16 h-[5.5rem] rounded-lg shrink-0 ring-1 ring-slate-200 bg-white flex flex-col"><span class="h-1.5 rounded-t-lg" style="background:${c1}"></span><span class="flex-1 flex items-center justify-center p-1.5"><img src="${esc(pubLogo(b.Publisher, b.Subject))}" alt="${esc(b.Publisher || "")}" loading="lazy" class="max-w-full max-h-full object-contain"></span></div>`
              : `<div class="w-16 h-[5.5rem] rounded-lg shrink-0 flex items-center justify-center text-white text-xl" style="background:linear-gradient(140deg,${c1},${c2})">${ic("book-open")}</div>`}
            <div class="flex-1 min-w-0"><div class="flex items-start justify-between gap-2"><h3 class="font-bold text-slate-900 leading-snug">${esc(b.Book_Name || i.Book_ID)}${carriedTag(i)}</h3>${stagePill(itemStage(i))}</div>
              <div class="text-[12px] text-slate-500 mt-0.5">${esc(b.Grade || "")} · ${fmt(i.Unit_Emp_Price)} ج.م للكتاب</div>
              <div class="text-[11.5px] text-slate-400 mt-0.5 flex items-center gap-1">${ic("clock")} أسبقية <span dir="ltr" class="num">${esc(i.Priority_Timestamp)}</span></div></div>
          </div>
          <div class="grid grid-cols-4 gap-2 mt-3.5 text-center">${[["حجزت", req, "text-slate-800"], ["جاهز للتسليم", Math.max(0, al - dl), "text-brand-700"], ["استلمت", dl, "text-emerald-600"], ["متبقٍ", rem, rem ? "text-amber-600" : "text-emerald-600"]].map(x => `<div class="rounded-xl bg-slate-50 py-2"><div class="text-[11px] text-slate-500">${x[0]}</div><div class="font-bold num ${x[2]}">${x[1]}</div></div>`).join("")}</div>
          ${n(i.Returned_Qty) ? `<div class="text-[11.5px] text-slate-500 mt-1.5">رجّعت ${fmt(i.Returned_Qty)}</div>` : ""}
          ${b.Book_Status === "Not_Yet_Printed" && al < req ? `<div class="mt-2.5 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex gap-1.5">${ic("clock", "mt-0.5 shrink-0")}<span>لم يُطبع من الناشر بعد — سيُخصَّص ويُسَلَّم فور وصوله من المكتبة</span></div>` : ""}
          ${i.Unallocated_Reason ? `<div class="mt-2.5 text-[12px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 flex gap-1.5">${ic("info", "mt-0.5")}${esc(i.Unallocated_Reason)}</div>` : ""}
        ${typeof retLine === "function" ? retLine(i) : ""}
        </article>`;
      }).join("")}`).join("") + cancelledBox(cancelled, bm) : cancelled.length ? cancelledBox(cancelled, bm, true) : `<div class="card">${Art.empty("cart", "لسه ما حجزتش كتب", Emp.open() ? "الحجز مفتوح — اختار كتب أولادك في دقيقة 😊" : "", Emp.open() ? `<a href="#/e/books" class="btn btn-primary mt-5">${ic("library")} ابدأ الحجز</a>` : "")}</div>`}
    </div>
    <aside class="space-y-4 lg:sticky lg:top-24">
      ${inv ? `<section class="card overflow-hidden">
        <div class="hero text-white p-5"><div class="text-brand-200 text-sm">صافي فاتورتك</div><div class="text-3xl font-bold num mt-1">${money(inv.Net_Final_Invoice_Amount)}</div>
          <div class="mt-3">${UI.progress(paidPct, "bg-gold-400")}</div><div class="flex justify-between text-[12px] text-brand-200 mt-1.5"><span>مسدد ${moneyTxt(inv.Total_Paid_Amount)}</span><span>${Math.round(paidPct)}%</span></div></div>
        <div class="p-4 grid grid-cols-2 gap-2">${UI.stat("قبل الخصم", `<span class="line-through text-slate-400">${fmt(inv.Total_Cover_Amount)}</span>`)}${UI.stat("وفّرت", `<span class="text-emerald-600">${moneyTxt(inv.Total_Savings)}</span>`)}${UI.stat("المقدم المطلوب", moneyTxt(inv.Down_Payment_Required))}${UI.stat("المتبقي", `<span class="${n(inv.Remaining_Balance) ? "text-rose-600" : "text-emerald-600"}">${moneyTxt(inv.Remaining_Balance)}</span>`)}
          ${n(inv.Credit_Balance) ? `<div class="col-span-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm p-3 font-semibold">لك رصيد مستحق الرد ${moneyTxt(inv.Credit_Balance)}</div>` : ""}</div>
        <div class="px-4 pb-4 flex items-center justify-between text-[12px] text-slate-500"><span>${esc(inv.Emp_Inv_ID)}</span>${pill(inv.Invoice_Status)}</div></section>`
        : `<section class="card card-pad"><div class="flex gap-3"><span class="w-11 h-11 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center text-xl shrink-0">${ic("receipt")}</span><div><div class="font-bold text-slate-900">الفاتورة لسه ما صدرتش</div><p class="text-[13px] text-slate-500 mt-1 leading-relaxed">بتصدر أول ما كتبك تبقى جاهزة للتسليم، والأقساط بتبدأ من يوم الاستلام.</p></div></div></section>`}
    </aside>
  </div>`;
});
/** الطلبات الملغية: مطوية تحت أيقونة «طلباتي الملغية» */
function cancelledBox(list, bm, open) {
  if (!list.length) return "";
  const q = list.reduce((a, i) => a + n(i.Requested_Qty), 0);
  return `<details class="card overflow-hidden mt-2" ${open ? "open" : ""}><summary class="list-none cursor-pointer flex items-center gap-3 p-3.5">
      <span class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">${ic("ban")}</span>
      <span class="flex-1"><b class="block text-[14px] text-slate-800">طلباتي الملغية</b><span class="block text-[11.5px] text-slate-500">${booksWord(q)} — اضغط للعرض</span></span>${ic("chevron-down", "text-slate-400")}</summary>
    <ul class="divide-y divide-slate-100 border-t border-slate-100">${list.map(i => { const b = bm[i.Book_ID] || {};
      return `<li class="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px]"><span class="flex-1 min-w-0"><span class="block font-semibold text-slate-700 line-through decoration-rose-300 truncate">${esc(b.Book_Name || i.Book_ID)}</span><span class="block text-[11px] text-slate-500">${esc(b.Grade || "")}${i.Beneficiary ? " · " + esc(i.Beneficiary) : ""}</span></span><span class="num text-slate-500">×${fmt(i.Requested_Qty)}</span><span class="text-[11px] font-bold text-rose-600 bg-rose-50 rounded-full px-2 py-0.5">ملغي</span></li>`; }).join("")}</ul></details>`;
}
/** بيانات العضو للمستندات */
const docEmp = () => { const u = APP.user; return { name: u.fullName, id: u.empId, dept: u.department, mobile: u.mobile }; };
on("printInv", () => {
  const inv = Emp.invoice(), bm = Emp.bookMap(), r = APP.emp; if (!inv) return;
  const h = r.myReservations.find(x => x.Res_ID === inv.Res_ID) || {};
  Doc.show("فاتورة " + inv.Emp_Inv_ID, Doc.invoice({ no: inv.Emp_Inv_ID, date: inv.Issue_Date, phase: r.activePhase.Phase_Name, status: inv.Invoice_Status, method: inv.Payment_Plan_Type, emp: docEmp(),
    lines: Emp.phaseItems().map(i => ({ code: i.Book_ID, name: (bm[i.Book_ID] || {}).Book_Name || i.Book_ID, grade: (bm[i.Book_ID] || {}).Grade, ben: i.Beneficiary, req: n(i.Requested_Qty), choice: i.Waitlist_Choice, alloc: n(i.Allocated_Qty), deliv: n(i.Delivered_Qty), ret: n(i.Returned_Qty), price: i.Unit_Emp_Price, cover: i.Unit_Cover_Price })),
    adj: n(h.Invoice_Adjustment), adjReason: h.Adjustment_Reason, paid: inv.Total_Paid_Amount, remaining: inv.Remaining_Balance, credit: inv.Credit_Balance, down: inv.Down_Payment_Required,
    schedule: Emp.installments().map(x => ({ label: x.Admin_Custom_Notes || "قسط " + x.Installment_No, due: x.Due_Date, amount: x.Scheduled_Amount, paid: x.Paid_Amount, status: x.Status })) }), { file: inv.Emp_Inv_ID, ref: inv.Emp_Inv_ID });
});
/** طلب الحجز كمستند (صورة أو PDF) — من السلة الحالية */
on("printRes", () => {
  const r = APP.emp, bm = Emp.bookMap(), h = r.myReservations.find(x => x.Phase_ID === APP.phaseId) || {};
  const lines = cartLines();
  if (!lines.length) return toast("السلة فاضية", "info");
  // تقسيم الطلب حسب الابن وصفه
  resGroups(lines).forEach((g, gi) => g.lines.forEach(l => { l.grp = g.emoji + " " + g.title + (g.sub ? " — " + g.sub : ""); l._g = gi; }));
  lines.sort((a, b) => a._g - b._g);
  const pc = Emp.planCalc(Emp.totals().net);
  Doc.show("طلب حجز", Doc.reservation({ no: h.Res_ID || "مسودة", date: h.Created_At || new Date().toISOString(), phase: r.activePhase.Phase_Name, status: Emp.dirty || !h.Res_ID ? "غير محفوظ" : "مؤكد", emp: docEmp(), lines,
    plan: { method: APP.plan.method, down: pc.down, count: pc.cnt, per: pc.per, last: pc.last } }), { file: "طلب-حجز-" + (h.Res_ID || APP.user.empId), ref: Emp.dirty ? "" : h.Res_ID });
});
on("printRcptE", no => {
  const p = APP.emp.myPayments.find(x => x.Receipt_No === no); if (!p) return; const inv = APP.emp.myInvoices.find(i => i.Emp_Inv_ID === p.Emp_Inv_ID) || {};
  Doc.show("إيصال " + no, Doc.receipt({ no, date: p.Payment_Date, emp: docEmp(), amount: p.Amount, method: p.Payment_Method, ref: p.Transaction_Ref, inv: p.Emp_Inv_ID, net: inv.Net_Final_Invoice_Amount, remaining: inv.Remaining_Balance, collector: p.Collected_By }), { file: no, ref: no });
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
    }).join("")}</ol>` : Art.empty("wallet", "لا يوجد جدول أقساط بعد", "يُنشأ الجدول تلقائياً بعد صدور الفاتورة."))}
    ${UI.section(`${ic("receipt", "text-brand-600")} إيصالات السداد`, "", pays.length ? `<ul class="space-y-2.5">${pays.map(p => `<li class="flex items-center gap-3 rounded-2xl ring-1 ring-slate-100 p-3 ${isTrue(p.Is_Voided) ? "opacity-50" : ""}">
        <span class="w-11 h-11 rounded-xl ${n(p.Amount) < 0 ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600"} flex items-center justify-center text-lg">${ic(p.Payment_Method === "CASH" ? "banknote" : p.Payment_Method === "PAYROLL" ? "building-2" : "smartphone")}</span>
        <div class="flex-1 min-w-0"><div class="font-semibold text-slate-800 text-[14px]">${n(p.Amount) < 0 ? "رد رصيد" : "سداد"} · ${esc(ar(p.Payment_Method))}</div><div class="text-[11.5px] text-slate-400 num">${esc(p.Receipt_No)} · ${esc(dt(p.Payment_Date))}${isTrue(p.Is_Voided) ? " · ملغى" : ""}</div></div>
        <div class="font-bold num ${n(p.Amount) < 0 ? "text-sky-600" : "text-slate-900"}">${fmt(Math.abs(n(p.Amount)))}</div><button class="icon-btn w-9 h-9" data-act="printRcptE" data-id="${esc(p.Receipt_No)}" aria-label="الإيصال">${ic("download")}</button></li>`).join("")}</ul>` : Art.empty("wallet", "لا توجد مدفوعات بعد", "إيصالاتك هتظهر هنا بعد أول سداد."))}
  </div>`;
});

// ============================================================ حسابي
Router.add("/e/me", view => {
  const r = APP.emp, u = APP.user;
  view.innerHTML = `
  <div class="max-w-2xl mx-auto space-y-4">
    <section class="hero rounded-4xl text-white p-6 flex items-center gap-4 shadow-lift">${UI.avatar(u.fullName, "w-16 h-16 text-xl")}
      <div class="min-w-0"><h1 class="font-bold leading-snug break-words" style="font-size:clamp(16px,4.6vw,22px)">${esc(u.fullName)}</h1><div class="text-brand-200 text-sm mt-0.5">رقم وظيفي ${esc(u.empId)}</div></div></section>
    <section class="card divide-y divide-slate-100">
      ${[["building-2", "الإدارة", u.department || "—"], ["calendar-check", "التقسيط", r.employee.installmentAllowed ? "مسموح" : "غير مسموح"], ["scale", "الحد الائتماني", moneyTxt(r.employee.creditLimit)], ["badge-percent", "خصم العاملين", fmt(r.settings.UNIFIED_EMP_DISCOUNT_PCT) + "%"], ["smartphone", "حساب التحويل", r.settings.CASH_ACCOUNT_HOLDER || "—"]]
        .map(x => `<div class="flex items-center gap-3 px-4 py-3.5"><span class="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center">${ic(x[0])}</span><span class="flex-1 text-slate-600 text-[14px]">${x[1]}</span><span class="font-semibold text-slate-900 text-[14px]">${esc(x[2])}</span></div>`).join("")}
    </section>
    <section class="card divide-y divide-slate-100">
      <button data-act="kidsEdit" class="w-full flex items-center gap-3 px-4 py-3.5 text-right"><span class="w-10 h-10 rounded-xl bg-gold-50 flex items-center justify-center text-xl">👦</span><span class="flex-1"><b class="block text-[14.5px] text-slate-800">أبنائي</b><span class="block text-[12px] text-slate-500">${myKids().length ? myKids().map((k, i) => esc(kidName(k, i)) + " (" + esc(gradeShort(k.grade)) + ")").join("، ") : "أضف أبناءك لحجز أسرع"}</span></span>${ic("chevron-left", "text-slate-300")}</button>
      <button data-act="faq" class="w-full flex items-center gap-3 px-4 py-3.5 text-right"><span class="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">${ic("info")}</span><span class="flex-1 font-semibold">أسئلة شائعة</span>${ic("chevron-left", "text-slate-300")}</button>
      <button data-act="contact" class="w-full flex items-center gap-3 px-4 py-3.5 text-right"><span class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">${ic("headset")}</span><span class="flex-1"><b class="block text-[14.5px] text-slate-800">تواصل مع المسؤول</b><span class="block text-[12px] text-slate-500">واتساب · اتصال · بريد</span></span>${ic("chevron-left", "text-slate-300")}</button>
      <button data-act="pickPhase" class="w-full flex items-center gap-3 px-4 py-3.5 text-right"><span class="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">${ic("calendar-range")}</span><span class="flex-1 font-semibold">تغيير المرحلة</span>${ic("chevron-left", "text-slate-400")}</button>
      <button data-act="installApp" class="w-full flex items-center gap-3 px-4 py-3.5 text-right"><span class="w-10 h-10 rounded-xl bg-gold-50 text-gold-600 flex items-center justify-center">${ic("smartphone")}</span><span class="flex-1 font-semibold">تثبيت كتطبيق على الموبايل</span>${ic("chevron-left", "text-slate-400")}</button>
      <button data-act="logout" class="w-full flex items-center gap-3 px-4 py-3.5 text-right text-rose-600"><span class="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">${ic("log-out")}</span><span class="flex-1 font-semibold">تسجيل الخروج</span></button>
    </section>
  </div>`;
});
