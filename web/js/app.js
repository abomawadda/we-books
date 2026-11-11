/* ============================================================================
 * الهيكل العام: شاشة الدخول، الإطار (قائمة جانبية / شريط سفلي)، الجلسة، الإقلاع
 * ========================================================================== */
"use strict";

// صلاحيات العمليات (نسخة للعرض فقط؛ الخادم هو الحَكَم)
const ACL = {
  SAVE_SETTING: [], SAVE_SUPPLIER: ["Coordinator"], SAVE_BOOK: ["Coordinator"], BULK_IMPORT_BOOKS: ["Coordinator"], BULK_IMPORT_EMPLOYEES: ["Coordinator"],
  SAVE_PHASE: ["Coordinator"], SET_PHASE_STATUS: ["Coordinator"], GENERATE_PO_SNAPSHOT: ["Coordinator"], CANCEL_PO_BACKORDER: ["Coordinator"],
  SUBMIT_SUPPLIER_INVOICE: ["Coordinator", "Warehouse"], RUN_ALLOCATION_ENGINE: ["Coordinator", "Warehouse"], MANUAL_ALLOCATION_OVERRIDE: ["Coordinator"], CARRY_WAITLIST_TO_PHASE: ["Coordinator"],
  EXECUTE_BOOK_DELIVERY: ["Warehouse", "Coordinator"], CANCEL_UNDELIVERED_QTY: ["Warehouse", "Coordinator"], RECORD_BOOK_RETURN: ["Warehouse", "Coordinator"], RECORD_STOCK_ADJUSTMENT: ["Warehouse"],
  RECORD_EMPLOYEE_PAYMENT: ["Finance"], VOID_EMPLOYEE_PAYMENT: [], REFUND_EMPLOYEE_CREDIT: ["Finance"], CUSTOMIZE_EMP_INSTALLMENTS: ["Finance"],
  RECORD_SUPPLIER_PAYMENT: ["Finance"], RECORD_INITIATIVE_EXPENSE: ["Finance"], CLOSE_CASH_DAY: ["Finance"], SUBMIT_OR_UPDATE_RESERVATION: ["Coordinator"]
};
const can = action => !!APP.user && (APP.user.role === "Admin" || (ACL[action] || []).indexOf(APP.user.role) !== -1);

// تفويض الأحداث: <button data-act="name" data-id="..."> بدل onclick داخل النصوص
const ACTIONS = {};
const on = (name, fn) => { ACTIONS[name] = fn; };
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset.id, el, e); }
});
document.addEventListener("change", e => {
  const el = e.target.closest("[data-change]");
  if (el && ACTIONS[el.dataset.change]) ACTIONS[el.dataset.change](el.value, el, e);
});
document.addEventListener("input", e => {
  const el = e.target.closest("[data-input]");
  if (el && ACTIONS[el.dataset.input]) ACTIONS[el.dataset.input](el.value, el, e);
});

const EMP_NAV = [
  ["home", "house", "الرئيسية"], ["books", "library", "الكتب"], ["orders", "package-check", "حجوزاتي"], ["pay", "wallet", "مدفوعاتي"], ["me", "user", "حسابي"]
];
const ADMIN_NAV = [
  { g: "", items: [["dash", "layout-dashboard", "لوحة القيادة"]] },
  { g: "الإعداد", items: [["books", "library-big", "الكتب والأسعار"], ["phases", "calendar-range", "المراحل"], ["suppliers", "store", "المكتبات المتعاقدة"], ["employees", "users", "الموظفون"], ["settings", "sliders-horizontal", "الإعدادات"]] },
  { g: "دورة التوريد", items: [["po", "clipboard-list", "الحصر وطلب التوريد"], ["receive", "truck", "فاتورة المكتبة والجرد"], ["alloc", "list-ordered", "التوزيع بالأسبقية"]] },
  { g: "التسليم والتحصيل", items: [["delivery", "package-check", "التسليم والمرتجعات"], ["collect", "hand-coins", "التحصيل والفواتير"], ["cash", "banknote", "الإيصالات والخزينة"]] },
  { g: "الحسابات", items: [["supplier", "landmark", "حساب المكتبة"], ["expenses", "coins", "المصروفات والمخزن"]] },
  { g: "", items: [["reports", "chart-column", "التقارير والتصفية"]] }
];
const ADMIN_BOTTOM = [["dash", "layout-dashboard", "الرئيسية"], ["delivery", "package-check", "التسليم"], ["collect", "hand-coins", "التحصيل"], ["reports", "chart-column", "التقارير"]];
const navLabel = key => { for (const g of ADMIN_NAV) for (const i of g.items) if ("/a/" + i[0] === key) return i[2]; const e = EMP_NAV.find(x => "/e/" + x[0] === key); return e ? e[2] : ""; };

const Shell = {
  type: null,

  renderLogin() {
    Shell.type = null;
    document.title = APP.title;
    const tab = store.get("loginTab") || "emp";
    $("#app").innerHTML = `
    <div class="min-h-[100dvh] mesh text-white lg:grid lg:grid-cols-[1.1fr_1fr]">
      <aside class="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <div class="absolute -left-24 -bottom-24 w-[28rem] h-[28rem] rounded-full border border-white/10"></div>
        <div class="absolute -left-10 -bottom-10 w-[20rem] h-[20rem] rounded-full border border-white/10"></div>
        <div class="flex items-center gap-3"><div class="w-12 h-12 rounded-2xl bg-gold-400 text-brand-950 flex items-center justify-center text-2xl shadow-lg">${ic("book-marked")}</div>
          <div><div class="font-bold text-lg">${esc(APP.title)}</div><div class="text-sm text-brand-200">منظومة مؤسسية متكاملة</div></div></div>
        <div class="max-w-md">
          <h2 class="text-4xl font-bold leading-[1.35]">كتب أبنائك الخارجية<br><span class="text-gold-300">بخصم حقيقي وتقسيط مريح</span></h2>
          <p class="text-brand-100/80 mt-4 leading-relaxed">احجز من الكتالوج، وتابع التوزيع بأسبقية الحجز، واستلم وسدد على أقساط شهرية بشفافية كاملة.</p>
          <ul class="mt-8 space-y-3 text-[15px]">
            ${[["badge-percent", "خصم موحد للعاملين على سعر الغلاف"], ["list-ordered", "توزيع عادل بأسبقية كل نسخة"], ["calendar-check", "مقدم عند الاستلام وأقساط شهرية"], ["shield-check", "إيصالات ومستندات موثقة لكل حركة"]].map(x => `<li class="flex items-center gap-3"><span class="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-gold-300">${ic(x[0])}</span>${x[1]}</li>`).join("")}
          </ul>
        </div>
        <div class="text-xs text-brand-200/70">© ${new Date().getFullYear()} · نقابة العاملين</div>
      </aside>

      <main class="flex flex-col min-h-[100dvh] lg:min-h-0 lg:justify-center lg:p-10">
        <div class="lg:hidden px-6 pt-[max(2.5rem,env(safe-area-inset-top))] pb-8">
          <div class="w-14 h-14 rounded-2xl bg-gold-400 text-brand-950 flex items-center justify-center text-[28px] shadow-lg">${ic("book-marked")}</div>
          <h1 class="mt-5 text-[26px] font-bold leading-snug">${esc(APP.title)}</h1>
          <p class="text-brand-100/80 text-sm mt-1.5">احجز · استلم · قسّط — بخصم العاملين</p>
        </div>
        <div class="flex-1 lg:flex-none bg-white text-slate-800 rounded-t-4xl lg:rounded-4xl px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:p-9 shadow-lift lg:max-w-md lg:w-full lg:mx-auto animate-sheet-up">
          <div class="seg grid-cols-2 mb-6" role="tablist">
            <button data-act="loginTab" data-id="emp" aria-pressed="${tab === "emp"}">${ic("user", "ml-1")} موظف</button>
            <button data-act="loginTab" data-id="adm" aria-pressed="${tab === "adm"}">${ic("shield-check", "ml-1")} الإدارة</button>
          </div>
          <form id="fEmp" class="${tab === "emp" ? "" : "hidden"} space-y-4" autocomplete="on">
            <div><h2 class="text-xl font-bold text-slate-900">أهلاً بك</h2><p class="text-sm text-slate-500 mt-1">ادخل ببياناتك المسجلة في النقابة</p></div>
            <div><label class="label" for="lgEmp">الرقم الوظيفي</label><div class="input-icon">${ic("badge-check")}<input id="lgEmp" class="input" inputmode="numeric" autocomplete="username" required></div></div>
            <div><label class="label" for="lgNat">آخر 4 أرقام من الرقم القومي</label><div class="input-icon">${ic("lock")}<input id="lgNat" class="input tracking-[.4em]" type="password" maxlength="4" inputmode="numeric" required></div></div>
            <div><label class="label" for="lgMob">رقم الموبايل المسجل</label><div class="input-icon">${ic("smartphone")}<input id="lgMob" class="input" type="tel" inputmode="tel" dir="ltr" style="text-align:right" placeholder="01xxxxxxxxx" required></div></div>
            <button class="btn btn-primary btn-lg w-full">دخول ${ic("arrow-right", "rotate-180")}</button>
          </form>
          <form id="fAdm" class="${tab === "adm" ? "" : "hidden"} space-y-4" autocomplete="on">
            <div><h2 class="text-xl font-bold text-slate-900">لوحة الإدارة</h2><p class="text-sm text-slate-500 mt-1">المدير · مسؤول المبادرة · أمين الصندوق · أمين المخزن</p></div>
            <div><label class="label" for="lgUser">اسم المستخدم</label><div class="input-icon">${ic("user-cog")}<input id="lgUser" class="input" autocomplete="username" dir="ltr" style="text-align:right" required></div></div>
            <div><label class="label" for="lgPass">كلمة المرور</label><div class="input-icon">${ic("key-round")}<input id="lgPass" class="input" type="password" autocomplete="current-password" required>
              <button type="button" data-act="togglePass" class="absolute left-2 top-1/2 -translate-y-1/2 icon-btn w-8 h-8 text-slate-400" aria-label="إظهار كلمة المرور">${ic("eye")}</button></div></div>
            <button class="btn btn-dark btn-lg w-full">دخول لوحة الإدارة ${ic("arrow-right", "rotate-180")}</button>
          </form>
          <p class="text-center text-xs text-slate-400 mt-6 flex items-center justify-center gap-1.5">${ic("shield-check")} اتصال آمن · لا تشارك بيانات دخولك</p>
        </div>
      </main>
    </div>`;
    $("#fEmp").onsubmit = e => { e.preventDefault(); Shell.loginEmployee(); };
    $("#fAdm").onsubmit = e => { e.preventDefault(); Shell.loginAdmin(); };
  },

  async loginEmployee() {
    const r = await call("LOGIN_EMPLOYEE", { empId: $("#lgEmp").value.trim(), natIdLast4: $("#lgNat").value.trim(), mobile: $("#lgMob").value.trim() }, { block: true });
    if (!r.success) return toast(r.message, "danger");
    Shell.enter(r);
  },
  async loginAdmin() {
    const r = await call("LOGIN_ADMIN", { username: $("#lgUser").value.trim(), password: $("#lgPass").value }, { block: true });
    if (!r.success) return toast(r.message, "danger");
    Shell.enter(r);
    if (r.user.mustChangePassword) setTimeout(() => Shell.changePassword(true), 400);
  },
  enter(res) {
    APP.token = res.sessionToken; APP.user = res.user; APP.emp = null; APP.adm = null; APP.settlement = null;
    store.set("session", { token: APP.token, user: APP.user });
    const scope = res.user.userType === "ADMIN" ? "/a/dash" : "/e/home";
    if (location.hash !== "#" + scope) location.hash = scope; else Router.render();
    reloadData();
  },

  /** بناء الإطار مرة واحدة ثم تبديل المحتوى */
  build() {
    const admin = APP.user.userType === "ADMIN";
    Shell.type = admin ? "ADMIN" : "EMP";
    const u = APP.user;
    const side = admin
      ? ADMIN_NAV.map(g => `${g.g ? `<div class="hidden lg:block px-3 pt-5 pb-1.5 text-[11px] font-semibold text-brand-300/70">${g.g}</div><div class="lg:hidden h-px bg-white/10 my-2 mx-2"></div>` : ""}${g.items.map(i => Shell.sideItem("/a/" + i[0], i[1], i[2])).join("")}`).join("")
      : EMP_NAV.map(i => Shell.sideItem("/e/" + i[0], i[1], i[2])).join("");
    const bottom = admin
      ? ADMIN_BOTTOM.map(i => Shell.bottomItem("/a/" + i[0], i[1], i[2])).join("") + `<button class="bnav-item" data-act="moreMenu"><span class="bnav-ic">${ic("layout-grid", "text-[20px]")}</span>المزيد</button>`
      : EMP_NAV.map(i => Shell.bottomItem("/e/" + i[0], i[1], i[2])).join("");
    $("#app").innerHTML = `
    <div class="min-h-[100dvh] md:flex">
      <aside class="no-print hidden md:flex flex-col shrink-0 sticky top-0 h-[100dvh] w-[84px] lg:w-[264px] hero text-white">
        <div class="flex items-center gap-3 px-4 lg:px-5 h-[72px] shrink-0">
          <div class="w-11 h-11 rounded-2xl bg-gold-400 text-brand-950 flex items-center justify-center text-[22px] mx-auto lg:mx-0 shrink-0">${ic("book-marked")}</div>
          <div class="hidden lg:block min-w-0"><div class="font-bold text-[15px] truncate">${esc(APP.title)}</div><div class="text-[11px] text-brand-200">${admin ? "لوحة الإدارة" : "بوابة الموظف"}</div></div>
        </div>
        <nav class="flex-1 overflow-y-auto px-2.5 lg:px-3 pb-4 space-y-1" aria-label="القائمة الرئيسية">${side}</nav>
        <div class="p-3 border-t border-white/10">
          <button data-act="userMenu" class="w-full flex items-center gap-3 rounded-xl p-2 hover:bg-white/10 transition">
            ${UI.avatar(u.fullName, "w-10 h-10 text-sm mx-auto lg:mx-0")}
            <div class="hidden lg:block text-right min-w-0 flex-1"><div class="text-sm font-semibold truncate">${esc(u.fullName)}</div><div class="text-[11px] text-brand-200 truncate">${esc(ar(u.role))}</div></div>
            <span class="hidden lg:block text-brand-200">${ic("chevron-down")}</span>
          </button>
        </div>
      </aside>

      <div class="flex-1 min-w-0 flex flex-col">
        <header class="no-print sticky top-0 z-30 bg-slate-50/85 backdrop-blur-xl border-b border-slate-200/60">
          <div class="flex items-center gap-2 sm:gap-3 h-16 px-4 sm:px-6 lg:px-8 max-w-[1400px] w-full mx-auto">
            <div class="md:hidden w-10 h-10 rounded-xl hero text-gold-300 flex items-center justify-center text-xl shrink-0">${ic("book-marked")}</div>
            <div class="min-w-0 flex-1"><div id="hdTitle" class="font-bold text-slate-900 text-[16px] sm:text-lg truncate"></div><div id="hdSub" class="text-[11.5px] text-slate-500 truncate"></div></div>
            <div id="phaseBox" class="shrink-0"></div>
            <button data-act="refresh" class="icon-btn" aria-label="تحديث البيانات" title="تحديث">${ic("refresh-cw")}</button>
            <button data-act="userMenu" class="md:hidden" aria-label="الحساب">${UI.avatar(u.fullName, "w-10 h-10 text-sm")}</button>
          </div>
        </header>
        <main id="view" class="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-nav md:pb-10"></main>
      </div>

      <nav class="no-print md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/70 safe-b" aria-label="التنقل">
        <div class="flex h-16">${bottom}</div>
      </nav>
    </div>`;
  },
  sideItem(path, icon, label) {
    return `<a href="#${path}" data-path="${path}" class="nav-item flex-col lg:flex-row gap-1 lg:gap-3 h-auto lg:h-11 py-2.5 lg:py-0 text-center lg:text-right" title="${esc(label)}">
      <span class="text-[20px] lg:text-[18px]">${ic(icon)}</span><span class="text-[10px] leading-tight lg:text-[14px] lg:leading-normal">${esc(label)}</span></a>`;
  },
  bottomItem(path, icon, label) {
    return `<a href="#${path}" data-path="${path}" class="bnav-item"><span class="bnav-ic">${ic(icon, "text-[20px]")}</span>${esc(label)}</a>`;
  },

  mount(key, fn) {
    const want = APP.user.userType === "ADMIN" ? "ADMIN" : "EMP";
    if (Shell.type !== want || !$("#view")) Shell.build();
    $$("[data-path]").forEach(a => a.setAttribute("aria-current", a.dataset.path === key ? "page" : "false"));
    const more = $('[data-act="moreMenu"]');
    if (more) more.setAttribute("aria-current", ADMIN_BOTTOM.some(i => "/a/" + i[0] === key) ? "false" : "page");
    $("#hdTitle").textContent = navLabel(key);
    document.title = navLabel(key) + " · " + APP.title;
    Shell.renderPhaseBox();
    const view = $("#view");
    const ready = APP.user.userType === "ADMIN" ? APP.adm : APP.emp;
    if (!ready) { view.innerHTML = UI.skeleton(5); return; }
    try { fn(view); } catch (err) { console.error(err); view.innerHTML = UI.empty("circle-alert", "تعذر عرض الصفحة", String(err && err.message || err)); }
    if (Shell._lastKey !== key) { window.scrollTo(0, 0); Shell._lastKey = key; }
  },
  rerender() { if (APP.user) Shell.mount(Router.current, Router.routes[Router.current]); },

  renderPhaseBox() {
    const box = $("#phaseBox"); if (!box) return;
    const d = APP.user.userType === "ADMIN" ? APP.adm : APP.emp;
    if (!d || !d.phases || !d.phases.length) { box.innerHTML = ""; $("#hdSub").textContent = ""; return; }
    const ph = d.phases.find(p => p.Phase_ID === APP.phaseId) || {};
    const st = ph.Effective_Status || ph.Phase_Status;
    $("#hdSub").innerHTML = "";
    box.innerHTML = `<button data-act="pickPhase" class="flex items-center gap-2 h-10 pl-2.5 pr-3 rounded-xl bg-white ring-1 ring-slate-200 hover:ring-brand-300 transition max-w-[46vw] sm:max-w-xs">
      <span class="w-2 h-2 rounded-full shrink-0 ${st === "Open" ? "bg-emerald-500 animate-pulse" : st === "Completed" ? "bg-slate-300" : "bg-amber-500"}"></span>
      <span class="text-[13px] font-semibold text-slate-700 truncate">${esc(ph.Phase_Name || "اختر المرحلة")}</span>${ic("chevron-down", "text-slate-400")}</button>`;
  },

  async changePassword(force) {
    const v = await UI.form({
      title: "تغيير كلمة المرور", intro: force ? "هذا أول دخول بكلمة مرور مؤقتة. اختر كلمة مرور جديدة خاصة بك لحماية حسابك." : "",
      fields: [{ name: "old", label: "كلمة المرور الحالية", type: "password", required: true }, { name: "nw", label: "كلمة المرور الجديدة", type: "password", required: true, hint: "8 أحرف على الأقل" }, { name: "nw2", label: "تأكيد كلمة المرور الجديدة", type: "password", required: true }],
      ok: "حفظ كلمة المرور", icon: "key-round"
    });
    if (!v) return;
    if (v.nw !== v.nw2) { toast("التأكيد غير مطابق لكلمة المرور الجديدة", "danger"); return Shell.changePassword(force); }
    const r = await call("CHANGE_PASSWORD", { oldPassword: v.old, newPassword: v.nw }, { block: true });
    toast(r.message, r.success ? "success" : "danger");
    if (!r.success) Shell.changePassword(force);
  }
};

async function logout(silent) {
  if (APP.token && !silent) call("LOGOUT");
  APP.token = null; APP.user = null; APP.emp = null; APP.adm = null; APP.cart = {}; APP.phaseId = null;
  store.set("session", null);
  while (UI._stack.length) UI.close(UI._stack[UI._stack.length - 1], true);
  Shell.type = null;
  if (silent) toast("انتهت الجلسة، سجّل الدخول مرة أخرى.", "warning");
  history.replaceState(null, "", location.pathname + location.search);
  Shell.renderLogin();
}

// ---------------------------------------------------------------- أحداث عامة
on("loginTab", t => { store.set("loginTab", t); Shell.renderLogin(); });
on("togglePass", (_, el) => { const i = $("#lgPass"); i.type = i.type === "password" ? "text" : "password"; el.innerHTML = ic(i.type === "password" ? "eye" : "eye-off"); });
on("refresh", async (_, el) => { el.classList.add("animate-spin"); APP.settlement = null; await reloadData(); el.classList.remove("animate-spin"); });
on("pickPhase", () => {
  const d = APP.user.userType === "ADMIN" ? APP.adm : APP.emp; if (!d) return;
  const m = UI.open(`<div class="space-y-2">${d.phases.slice().reverse().map(p => {
    const st = p.Effective_Status || p.Phase_Status, cur = p.Phase_ID === APP.phaseId;
    return `<button data-act="setPhase" data-id="${esc(p.Phase_ID)}" class="w-full flex items-center gap-3 rounded-2xl p-3.5 text-right ring-1 transition ${cur ? "ring-brand-400 bg-brand-50" : "ring-slate-200 hover:bg-slate-50"}">
      <span class="w-10 h-10 rounded-xl flex items-center justify-center ${cur ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-500"}">${ic("calendar-range")}</span>
      <span class="flex-1 min-w-0"><span class="block font-bold text-slate-900 truncate">${esc(p.Phase_Name)}</span><span class="block text-xs text-slate-500 num">${esc(day(p.Start_DateTime))} ← ${esc(day(p.End_DateTime))}</span></span>${pill(st)}</button>`;
  }).join("")}</div>`, { title: "اختر المرحلة", sub: "تُعرض البيانات والعمليات للمرحلة المختارة" });
  Shell._phaseSheet = m;
});
on("setPhase", async id => {
  if (Shell._phaseSheet) { Shell._phaseSheet.close(); Shell._phaseSheet = null; }
  APP.phaseId = id; APP.settlement = null;
  if (typeof Emp !== "undefined") Emp.dirty = false;
  if (APP.user.userType === "ADMIN") Shell.rerender(); else await Emp.load();
});
on("userMenu", () => {
  const u = APP.user, admin = u.userType === "ADMIN";
  const m = UI.open(`<div class="flex items-center gap-4 mb-5">${UI.avatar(u.fullName, "w-14 h-14 text-lg")}<div><div class="font-bold text-slate-900 text-[17px]">${esc(u.fullName)}</div><div class="text-sm text-slate-500">${esc(ar(u.role))}${u.empId ? " · " + esc(u.empId) : ""}</div></div></div>
    <div class="space-y-2">
      ${admin ? `<button data-act="changePw" class="w-full flex items-center gap-3 rounded-2xl p-3.5 ring-1 ring-slate-200 hover:bg-slate-50 text-right"><span class="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">${ic("key-round")}</span><span class="flex-1 font-semibold">تغيير كلمة المرور</span>${ic("chevron-left", "text-slate-400")}</button>` : ""}
      <button data-act="installApp" class="w-full flex items-center gap-3 rounded-2xl p-3.5 ring-1 ring-slate-200 hover:bg-slate-50 text-right"><span class="w-10 h-10 rounded-xl bg-gold-50 text-gold-600 flex items-center justify-center">${ic("smartphone")}</span><span class="flex-1"><span class="block font-semibold">تثبيت كتطبيق</span><span class="block text-xs text-slate-500">أيقونة على الشاشة الرئيسية للموبايل</span></span>${ic("chevron-left", "text-slate-400")}</button>
      <button data-act="logout" class="w-full flex items-center gap-3 rounded-2xl p-3.5 ring-1 ring-rose-100 text-rose-600 hover:bg-rose-50 text-right"><span class="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">${ic("log-out")}</span><span class="flex-1 font-semibold">تسجيل الخروج</span></button>
    </div>`, { title: "الحساب" });
  Shell._userSheet = m;
});
on("changePw", () => { if (Shell._userSheet) Shell._userSheet.close(); Shell.changePassword(false); });
on("logout", () => { if (Shell._userSheet) Shell._userSheet.close(); logout(false); });
on("moreMenu", () => {
  const m = UI.open(ADMIN_NAV.map(g => `${g.g ? `<div class="text-xs font-semibold text-slate-400 mt-4 mb-2">${g.g}</div>` : ""}<div class="grid grid-cols-3 gap-2">${g.items.map(i => `<a href="#/a/${i[0]}" data-act="goMore" data-id="/a/${i[0]}" class="flex flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center ring-1 ${Router.current === "/a/" + i[0] ? "ring-brand-300 bg-brand-50 text-brand-800" : "ring-slate-200 text-slate-700"}"><span class="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center text-xl">${ic(i[1])}</span><span class="text-[12px] font-semibold leading-tight">${i[2]}</span></a>`).join("")}</div>`).join(""), { title: "كل الأقسام" });
  Shell._moreSheet = m;
});
on("goMore", id => closeAndGo(id));
on("goClose", id => closeAndGo(id));

// ---------------------------------------------------------------- PWA
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredInstall = e; });
on("installApp", async () => {
  if (Shell._userSheet) Shell._userSheet.close();
  if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  UI.open(`<div class="space-y-3 text-sm leading-relaxed text-slate-700">${ios
    ? `<p class="flex gap-3"><span class="w-7 h-7 rounded-full bg-brand-700 text-white flex items-center justify-center shrink-0 font-bold">1</span>افتح الموقع في Safari ثم اضغط زر المشاركة ${ic("upload")}.</p><p class="flex gap-3"><span class="w-7 h-7 rounded-full bg-brand-700 text-white flex items-center justify-center shrink-0 font-bold">2</span>اختر «إضافة إلى الشاشة الرئيسية».</p>`
    : `<p class="flex gap-3"><span class="w-7 h-7 rounded-full bg-brand-700 text-white flex items-center justify-center shrink-0 font-bold">1</span>افتح قائمة المتصفح (⋮) في Chrome.</p><p class="flex gap-3"><span class="w-7 h-7 rounded-full bg-brand-700 text-white flex items-center justify-center shrink-0 font-bold">2</span>اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</p>`}</div>`, { title: "تثبيت كتطبيق" });
});
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { /* اختياري */ }));
}

// ---------------------------------------------------------------- الإقلاع
window.addEventListener("DOMContentLoaded", async () => {
  const s = store.get("session");
  if (s && s.token) { APP.token = s.token; APP.user = s.user; Router.render(); reloadData(); }
  else Shell.renderLogin();
  const r = await call("GET_PUBLIC_INIT_DATA");
  if (r.success && r.settings && r.settings.INITIATIVE_TITLE) {
    APP.title = r.settings.INITIATIVE_TITLE;
    if (!APP.user) Shell.renderLogin();
  }
});
