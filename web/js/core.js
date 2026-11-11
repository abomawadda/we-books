/* ============================================================================
 * النواة: الحالة، الاتصال بالخادم، أدوات العرض، المكونات المشتركة، النوافذ
 * ========================================================================== */
"use strict";
const API_URL = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || "";
const APP = { token: null, user: null, phaseId: null, emp: null, adm: null, cart: {}, plan: null, settlement: null, title: "مبادرة الكتب الخارجية" };

// ---------------------------------------------------------------- أدوات
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const esc = s => String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n = v => { const x = Number(v); return isNaN(x) ? 0 : x; };
const r2 = v => Math.round(n(v) * 100) / 100;
const ceil = v => { const x = Number(v); return isNaN(x) || x <= 0 ? 0 : Math.ceil(Math.round(x * 10000) / 10000); };
const fmt = v => r2(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
const money = v => `${fmt(v)} <span class="text-[.78em] font-medium opacity-60">ج.م</span>`;
const moneyTxt = v => fmt(v) + " ج.م";
const day = v => String(v || "").slice(0, 10);
const dt = v => String(v || "").slice(0, 16).replace("T", " ");
const sum = (a, f) => a.reduce((s, x) => s + n(typeof f === "function" ? f(x) : x[f]), 0);
const uniq = a => [...new Set(a)];
const by = (a, k) => { const m = {}; a.forEach(x => m[x[k]] = x); return m; };
const isTrue = v => v === true || String(v).toLowerCase() === "true";
const store = {
  get(k) { try { return JSON.parse(sessionStorage.getItem("wb_" + k)); } catch (e) { return null; } },
  set(k, v) { try { v === null ? sessionStorage.removeItem("wb_" + k) : sessionStorage.setItem("wb_" + k, JSON.stringify(v)); } catch (e) { /* التخزين غير متاح */ } }
};

function ic(name, cls) {
  const p = (window.ICONS || {})[name] || "";
  return `<svg class="ico ${cls || ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

// ---------------------------------------------------------------- القواميس
const AR = {
  Draft: "مسودة", Open: "الحجز مفتوح", Scheduled: "لم يبدأ بعد", Closed: "الحجز مغلق", Ordered: "أُرسل للمكتبة", Receiving: "استلام وجرد", Delivering: "تسليم وتحصيل", Completed: "مكتملة",
  Pending: "قيد المراجعة", Fully_Allocated: "مخصص بالكامل", Partially_Allocated: "مخصص جزئياً", Waitlisted: "في قائمة الانتظار", Cancelled_By_Employee: "ألغاه الموظف", Carried_Forward: "رُحِّل لمرحلة تالية",
  Unpaid: "غير مسدد", Partially_Paid: "مسدد جزئياً", Paid_In_Full: "مسدد بالكامل", Overdue: "متأخر", Refund_Due: "مستحق رد", Zero_Allocation: "لا تخصيص",
  Paid: "مسدد", Partial: "مسدد جزئياً", INSTALLMENT: "تقسيط", CASH: "نقدي", WALLET: "محفظة إلكترونية", INSTAPAY: "إنستاباي", PAYROLL: "خصم من المرتب", FULL: "دفعة واحدة",
  Available: "متاح", Not_Yet_Printed: "لم يُطبع بعد", Suspended: "موقوف مؤقتاً", Discontinued: "ملغى",
  EXACT: "مطابق", SHORTAGE: "نقص", SURPLUS: "زيادة", NOT_PRINTED: "لم يُطبع", NOT_RECEIVED: "لم يصل", UNORDERED_ITEM: "غير مطلوب",
  Fulfilled: "مكتمل", Covered_From_Stock: "مغطى من المخزون", Cancelled: "ملغى",
  Admin: "مدير المنظومة", Coordinator: "مسؤول المبادرة", Finance: "أمين الصندوق", Warehouse: "أمين المخزن", Employee: "موظف"
};
const ar = k => AR[k] || k || "—";
const TONE = {
  Open: "green", Scheduled: "blue", Closed: "amber", Ordered: "brand", Receiving: "brand", Delivering: "brand", Completed: "gray", Draft: "gray",
  Fully_Allocated: "green", Partially_Allocated: "amber", Waitlisted: "gray", Pending: "blue", Cancelled_By_Employee: "red", Carried_Forward: "gray",
  Paid_In_Full: "green", Paid: "green", Partially_Paid: "amber", Partial: "amber", Unpaid: "gray", Overdue: "red", Refund_Due: "blue", Zero_Allocation: "gray",
  Available: "green", Not_Yet_Printed: "amber", Suspended: "gray", Discontinued: "red",
  EXACT: "green", SHORTAGE: "red", SURPLUS: "amber", NOT_PRINTED: "amber", NOT_RECEIVED: "red", Fulfilled: "green", Covered_From_Stock: "blue", Cancelled: "gray"
};
const pill = (code, label, tone) => `<span class="pill pill-${tone || TONE[code] || "gray"}">${esc(label || ar(code))}</span>`;
const PHASE_STATUS_LABEL = { Open: "الحجز مفتوح", Scheduled: "لم يبدأ", Closed: "الحجز مغلق" };

// ---------------------------------------------------------------- مؤشرات التحميل والتنبيهات
let busyCount = 0;
function busy(on, blocking) {
  busyCount = Math.max(0, busyCount + (on ? 1 : -1));
  $("#topProgress").classList.toggle("hidden", busyCount === 0);
  if (blocking !== undefined) $("#blocker").classList.toggle("hidden", !on);
}
function toast(msg, type) {
  const tone = { success: ["bg-slate-900 text-white", "circle-check", "text-emerald-400"], danger: ["bg-rose-600 text-white", "circle-alert", "text-white"], warning: ["bg-amber-50 text-amber-900 ring-1 ring-amber-200", "triangle-alert", "text-amber-500"], info: ["bg-white text-slate-800 ring-1 ring-slate-200", "info", "text-brand-600"] }[type || "success"];
  const d = document.createElement("div");
  d.className = `pointer-events-auto flex items-start gap-3 rounded-2xl px-4 py-3 shadow-lift text-[14px] font-medium animate-pop-in ${tone[0]}`;
  d.setAttribute("role", type === "danger" ? "alert" : "status");
  d.innerHTML = `${ic(tone[1], "mt-0.5 " + tone[2])}<div class="flex-1 leading-relaxed">${esc(msg)}</div><button class="opacity-60 hover:opacity-100" aria-label="إغلاق">${ic("x")}</button>`;
  d.querySelector("button").onclick = () => d.remove();
  $("#toasts").appendChild(d);
  setTimeout(() => d.remove(), type === "danger" ? 9000 : 4500);
}

// ---------------------------------------------------------------- الاتصال بالخادم
// ---- خادم Firebase (Cloud Functions: api) — يُفعَّل بوجود FIREBASE في config.js ----
const FB_CONFIG = (window.APP_CONFIG && window.APP_CONFIG.FIREBASE) || null;
const FB_SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
let _fb = null;
function fbInit() {
  if (_fb) return _fb;
  _fb = Promise.all(["firebase-app", "firebase-auth", "firebase-functions"].map(m => import(FB_SDK + m + ".js"))).then(async ([A, Au, F]) => {
    const app = A.initializeApp(FB_CONFIG);
    const auth = Au.getAuth(app); // الجلسة تبقى على الجهاز (IndexedDB)
    await auth.authStateReady();
    const fn = F.httpsCallable(F.getFunctions(app, FB_CONFIG.region || "europe-west1"), "api", { timeout: 60000 });
    return { auth, Au, fn };
  });
  _fb.catch(() => { _fb = null; });
  return _fb;
}
async function fbCall(action, payload) {
  try {
    const fb = await fbInit();
    if (action === "LOGOUT") { await fb.Au.signOut(fb.auth); return { success: true }; }
    if (!/^LOGIN_|^GET_PUBLIC/.test(action) && !fb.auth.currentUser) return { success: false, message: "انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى." };
    const r = (await fb.fn({ action, payload: payload || {} })).data;
    if (r && r.success && r.firebaseToken) {
      await fb.Au.signInWithCustomToken(fb.auth, r.firebaseToken);
      delete r.firebaseToken; r.sessionToken = "FIREBASE";
    }
    return r;
  } catch (err) {
    return { success: false, message: err && err.code === "functions/deadline-exceeded" ? "انتهت مهلة الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى." : "تعذر الاتصال بالخادم. تحقق من الإنترنت." };
  }
}

function call(action, payload, opts) {
  opts = opts || {};
  busy(true, opts.block ? true : undefined);
  const done = r => {
    busy(false, opts.block ? false : undefined);
    if (r && !r.success && /الجلسة/.test(r.message || "") && APP.token) { logout(true); }
    return r;
  };
  if (FB_CONFIG) return fbCall(action, payload).then(done);
  if (!API_URL) return Promise.resolve(done({ success: false, message: "لم يُضبط رابط الخادم في config.js" }));
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => ctrl && ctrl.abort(), 60000);
  return fetch(API_URL, {
    method: "POST", redirect: "follow", signal: ctrl ? ctrl.signal : undefined,
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, payload: payload || {}, token: APP.token })
  }).then(r => r.text()).then(t => {
    clearTimeout(timer);
    try { return done(JSON.parse(t)); } catch (e) { return done({ success: false, message: "رد غير متوقع من الخادم. حاول مرة أخرى." }); }
  }).catch(err => {
    clearTimeout(timer);
    return done({ success: false, message: err && err.name === "AbortError" ? "انتهت مهلة الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى." : "تعذر الاتصال بالخادم. تحقق من الإنترنت." });
  });
}
/** تنفيذ عملية تغيّر البيانات: تأكيد اختياري ← تنفيذ ← تنبيه ← إعادة تحميل */
async function act(action, payload, confirmOpts) {
  if (confirmOpts && !(await UI.confirm(typeof confirmOpts === "string" ? { message: confirmOpts } : confirmOpts))) return null;
  const r = await call(action, payload, { block: true });
  toast(r.message || (r.success ? "تم بنجاح" : "حدث خطأ"), r.success ? "success" : "danger");
  (r.warnings || []).forEach(w => toast(w, "warning"));
  if (r.success) await reloadData();
  return r;
}
async function reloadData() {
  if (!APP.user) return;
  if (APP.user.userType === "ADMIN") await Admin.load(); else await Emp.load();
}

// ---------------------------------------------------------------- مكونات العرض
const UI = {
  empty(icon, title, sub, action) {
    return `<div class="flex flex-col items-center justify-center text-center py-10 px-6">
      <div class="w-16 h-16 rounded-3xl bg-brand-50 text-brand-500 flex items-center justify-center mb-4 text-[28px]">${ic(icon)}</div>
      <div class="font-bold text-slate-800">${esc(title)}</div>${sub ? `<div class="text-sm text-slate-500 mt-1 max-w-xs leading-relaxed">${esc(sub)}</div>` : ""}${action || ""}</div>`;
  },
  skeleton(rows) {
    return `<div class="space-y-3">${Array.from({ length: rows || 4 }, (_, i) => `<div class="skeleton ${i ? "h-16" : "h-28"}"></div>`).join("")}</div>`;
  },
  pageHead(title, sub, actions) {
    return `<div class="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div><h1 class="text-[22px] sm:text-2xl font-bold text-slate-900 tracking-tight">${title}</h1>${sub ? `<p class="text-sm text-slate-500 mt-1">${sub}</p>` : ""}</div>
      ${actions ? `<div class="flex flex-wrap gap-2">${actions}</div>` : ""}</div>`;
  },
  section(title, sub, body, actions, cls) {
    return `<section class="card ${cls || ""}"><div class="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
      <div><h2 class="card-title">${title}</h2>${sub ? `<p class="card-sub">${sub}</p>` : ""}</div>${actions ? `<div class="flex flex-wrap gap-2">${actions}</div>` : ""}</div>
      <div class="px-4 sm:px-5 pb-4 sm:pb-5">${body}</div></section>`;
  },
  kpi(label, value, opts) {
    opts = opts || {};
    const tones = { brand: "bg-brand-50 text-brand-600", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", red: "bg-rose-50 text-rose-600", blue: "bg-sky-50 text-sky-600", gray: "bg-slate-100 text-slate-500" };
    return `<div class="kpi">
      <div class="flex items-start justify-between gap-2"><div class="text-[12.5px] font-semibold text-slate-500 leading-snug">${esc(label)}</div>
      <div class="w-9 h-9 rounded-xl flex items-center justify-center text-lg ${tones[opts.tone || "brand"]}">${ic(opts.icon || "chart-column")}</div></div>
      <div class="mt-2 text-[22px] font-bold text-slate-900 num leading-tight">${value}</div>
      ${opts.foot ? `<div class="text-xs text-slate-500 mt-1">${opts.foot}</div>` : ""}
      ${opts.pct !== undefined ? `<div class="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full ${opts.tone === "red" ? "bg-rose-500" : opts.tone === "amber" ? "bg-amber-500" : "bg-brand-600"}" style="width:${Math.max(0, Math.min(100, opts.pct))}%"></div></div>` : ""}
    </div>`;
  },
  stat(label, value, cls) {
    return `<div class="rounded-xl bg-slate-50 px-3 py-2.5 ${cls || ""}"><div class="text-[11.5px] font-semibold text-slate-500">${esc(label)}</div><div class="font-bold text-slate-900 num mt-0.5">${value}</div></div>`;
  },
  /** جدول متجاوب: جدول على الشاشات المتوسطة فأكبر، وبطاقات على الموبايل */
  table(cols, rows, opts) {
    opts = opts || {};
    if (!rows.length) return opts.emptyHtml || UI.empty(opts.emptyIcon || "file-text", opts.empty || "لا توجد بيانات", opts.emptySub);
    const cell = (c, r) => { const v = typeof c.v === "function" ? c.v(r) : esc(r[c.v]); return v === undefined || v === null || v === "" ? `<span class="text-slate-300">—</span>` : v; };
    const head = `<thead><tr>${cols.map(c => `<th class="${c.cls || ""}">${c.t}</th>`).join("")}</tr></thead>`;
    const body = `<tbody>${rows.map(r => `<tr>${cols.map(c => `<td class="${c.cls || ""}">${cell(c, r)}</td>`).join("")}</tr>`).join("")}</tbody>`;
    const tableHtml = `<div class="${opts.cardsOnMobile === false ? "" : "hidden lg:block"} overflow-auto rounded-xl ring-1 ring-slate-200/70 ${opts.maxH ? "" : ""}" ${opts.maxH ? `style="max-height:${opts.maxH}px"` : ""}><table class="tbl" ${opts.id ? `id="${opts.id}"` : ""}>${head}${body}</table></div>`;
    if (opts.cardsOnMobile === false) return tableHtml;
    const card = opts.card || (r => {
      const [first, ...rest] = cols.filter(c => !c.noCard);
      const act = cols.find(c => c.actions);
      return `<div class="card p-3.5"><div class="font-bold text-slate-900">${cell(first, r)}</div>
        <dl class="grid grid-cols-2 gap-x-3 gap-y-2 mt-2.5">${rest.filter(c => !c.actions).map(c => `<div><dt class="text-[11px] font-semibold text-slate-400">${c.t}</dt><dd class="text-[13.5px] text-slate-800 num">${cell(c, r)}</dd></div>`).join("")}</dl>
        ${act ? `<div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">${cell(act, r)}</div>` : ""}</div>`;
    });
    return tableHtml + `<div class="lg:hidden grid gap-2.5 sm:grid-cols-2">${rows.slice(0, opts.mobileLimit || 300).map(card).join("")}</div>`;
  },
  progress(pct, tone) {
    return `<div class="h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full ${tone || "bg-brand-600"} transition-all" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>`;
  },
  donut(pct, size, label, color) {
    const s = size || 120, r = s / 2 - 9, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct || 0));
    return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" class="-rotate-90"><circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="none" stroke="currentColor" stroke-width="10" class="text-white/15"/>
      <circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="none" stroke="${color || "#f9b224"}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}" style="transition:stroke-dashoffset .8s"/></svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center"><div class="text-2xl font-bold num">${Math.round(p)}%</div>${label ? `<div class="text-[11px] opacity-80">${label}</div>` : ""}</div>`;
  },
  /** أعمدة أفقية بسيطة: [{label, value, tone}] */
  bars(items, fmtFn) {
    const mx = Math.max(1, ...items.map(i => n(i.value)));
    return `<div class="space-y-3">${items.map(i => `<div><div class="flex justify-between text-[13px] mb-1"><span class="font-semibold text-slate-700 truncate">${esc(i.label)}</span><span class="num text-slate-500">${fmtFn ? fmtFn(i.value) : fmt(i.value)}</span></div>
      <div class="h-2.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full ${i.tone || "bg-brand-600"}" style="width:${n(i.value) / mx * 100}%"></div></div></div>`).join("")}</div>`;
  },
  /** مخطط حلقي متعدد الأجزاء: [{label, value, color}] */
  ring(parts, center) {
    const total = sum(parts, "value"), s = 150, r = 58, c = 2 * Math.PI * r;
    let off = 0;
    const segs = total ? parts.filter(p => n(p.value) > 0).map(p => { const len = n(p.value) / total * c; const el = `<circle cx="75" cy="75" r="${r}" fill="none" stroke="${p.color}" stroke-width="16" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}"/>`; off += len; return el; }).join("") : "";
    return `<div class="flex flex-col sm:flex-row items-center gap-5"><div class="relative shrink-0"><svg width="${s}" height="${s}" viewBox="0 0 150 150" class="-rotate-90"><circle cx="75" cy="75" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="16"/>${segs}</svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center text-center">${center || ""}</div></div>
      <ul class="space-y-2 w-full">${parts.map(p => `<li class="flex items-center justify-between gap-3 text-[13px]"><span class="flex items-center gap-2 text-slate-600"><span class="w-2.5 h-2.5 rounded-full" style="background:${p.color}"></span>${esc(p.label)}</span><span class="font-bold num text-slate-900">${fmt(p.value)}</span></li>`).join("")}</ul></div>`;
  },
  avatar(name, cls) {
    const parts = String(name || "؟").trim().split(/\s+/);
    const t = (parts[0] || "").charAt(0) + (parts[1] ? parts[1].charAt(0) : "");
    return `<div class="shrink-0 rounded-2xl bg-gradient-to-br from-gold-300 to-gold-500 text-brand-950 font-bold flex items-center justify-center ${cls || "w-11 h-11 text-base"}">${esc(t)}</div>`;
  },

  // ---------------------------------------------------------------- النوافذ (Bottom sheet على الموبايل / Modal على الشاشات الأكبر)
  _stack: [],
  _ignorePop: 0,
  _pendingPush: 0,
  open(html, opts) {
    opts = opts || {};
    const root = document.createElement("div");
    root.className = "fixed inset-0 z-50 flex items-end sm:items-center justify-center";
    root.innerHTML = `<div data-bd class="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px] animate-fade-in"></div>
      <div role="dialog" aria-modal="true" class="relative w-full ${opts.wide ? "sm:max-w-3xl" : "sm:max-w-lg"} max-h-[92vh] flex flex-col bg-white rounded-t-4xl sm:rounded-3xl shadow-lift animate-sheet-up sm:animate-pop-in safe-b">
        <div class="sm:hidden flex justify-center pt-2.5"><div class="w-10 h-1.5 rounded-full bg-slate-200"></div></div>
        ${opts.title ? `<div class="flex items-center justify-between gap-3 px-5 pt-3 sm:pt-5 pb-3 border-b border-slate-100"><div><h3 class="text-[17px] font-bold text-slate-900">${opts.title}</h3>${opts.sub ? `<p class="text-xs text-slate-500 mt-0.5">${opts.sub}</p>` : ""}</div><button data-close class="icon-btn -ml-2" aria-label="إغلاق">${ic("x")}</button></div>` : ""}
        <div data-body class="overflow-y-auto px-5 py-4 flex-1">${html}</div>
        ${opts.footer ? `<div data-foot class="px-5 py-3.5 border-t border-slate-100 bg-white rounded-b-3xl">${opts.footer}</div>` : ""}
      </div>`;
    document.body.appendChild(root);
    document.body.classList.add("overflow-hidden");
    const entry = { root, onClose: opts.onClose };
    UI._stack.push(entry);
    const close = () => UI.close(entry);
    root.querySelector("[data-bd]").onclick = () => { if (!opts.static) close(); };
    $$("[data-close]", root).forEach(b => b.onclick = close);
    if (UI._ignorePop > 0) UI._pendingPush++;   // رجوع سابق لم يكتمل بعد: نؤجل إضافة السجل حتى يكتمل
    else { try { history.pushState({ sheet: UI._stack.length }, ""); } catch (e) { /* */ } }
    const f = root.querySelector("input:not([type=hidden]):not([readonly]),select,textarea");
    if (f && window.matchMedia("(min-width:640px)").matches) setTimeout(() => f.focus(), 50);
    return { root, close, body: root.querySelector("[data-body]") };
  },
  close(entry, fromPop) {
    const i = UI._stack.indexOf(entry); if (i === -1) return;
    UI._stack.splice(i, 1);
    entry.root.remove();
    if (!UI._stack.length) document.body.classList.remove("overflow-hidden");
    if (entry.onClose) entry.onClose();
    if (!fromPop) { UI._ignorePop++; try { history.back(); } catch (e) { UI._ignorePop--; } }
  },
  confirm(o) {
    o = o || {};
    return new Promise(res => {
      let done = false;
      const tone = o.tone || "primary";
      const m = UI.open(`<div class="flex gap-4 items-start"><div class="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-xl ${tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-brand-50 text-brand-600"}">${ic(o.icon || (tone === "danger" ? "triangle-alert" : "circle-alert"))}</div>
        <div><div class="font-bold text-slate-900 text-[16px]">${esc(o.title || "تأكيد الإجراء")}</div><div class="text-sm text-slate-600 mt-1 leading-relaxed">${esc(o.message || "")}</div></div></div>`,
        { footer: `<div class="flex gap-2"><button data-ok class="btn btn-${tone} flex-1">${esc(o.ok || "تأكيد")}</button><button data-close class="btn btn-outline flex-1">إلغاء</button></div>`, onClose: () => { if (!done) res(false); } });
      m.root.querySelector("[data-ok]").onclick = () => { done = true; res(true); m.close(); };
    });
  },
  /** نموذج إدخال: fields = [{name,label,type,value,options:[[v,l]],hint,required,min,max,placeholder,cols}] */
  form(o) {
    return new Promise(res => {
      let done = false;
      const f = o.fields.map(fd => {
        const id = "f_" + fd.name, req = fd.required ? "required" : "";
        let input;
        if (fd.type === "select") input = `<select id="${id}" name="${fd.name}" class="input" ${req}>${fd.options.map(op => `<option value="${esc(op[0])}" ${String(op[0]) === String(fd.value) ? "selected" : ""}>${esc(op[1])}</option>`).join("")}</select>`;
        else if (fd.type === "textarea") input = `<textarea id="${id}" name="${fd.name}" rows="${fd.rows || 3}" class="input" placeholder="${esc(fd.placeholder || "")}" ${req}>${esc(fd.value || "")}</textarea>`;
        else if (fd.type === "seg") input = `<div class="seg" style="grid-template-columns:repeat(${fd.options.length},1fr)" data-seg="${fd.name}">${fd.options.map(op => `<button type="button" data-v="${esc(op[0])}" aria-pressed="${String(op[0]) === String(fd.value)}">${esc(op[1])}</button>`).join("")}</div><input type="hidden" name="${fd.name}" value="${esc(fd.value || "")}">`;
        else if (fd.type === "check") return `<label class="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3 ${fd.cols === 2 ? "col-span-2" : "col-span-2"}"><input type="checkbox" name="${fd.name}" class="w-5 h-5 accent-brand-700" ${fd.value ? "checked" : ""}><span class="text-sm font-semibold text-slate-700">${esc(fd.label)}</span></label>`;
        else if (fd.type === "html") return `<div class="col-span-2">${fd.html}</div>`;
        else input = `<input id="${id}" name="${fd.name}" type="${fd.type || "text"}" class="input" value="${esc(fd.value === undefined ? "" : fd.value)}" placeholder="${esc(fd.placeholder || "")}" ${fd.min !== undefined ? `min="${fd.min}"` : ""} ${fd.max !== undefined ? `max="${fd.max}"` : ""} ${fd.type === "number" ? `inputmode="decimal" step="any"` : ""} ${req}>`;
        return `<div class="${fd.cols === 1 ? "col-span-2 sm:col-span-1" : "col-span-2"}"><label class="label" for="${id}">${esc(fd.label)}</label>${input}${fd.hint ? `<p class="hint">${esc(fd.hint)}</p>` : ""}</div>`;
      }).join("");
      const m = UI.open(`${o.intro ? `<div class="rounded-2xl bg-brand-50/70 text-brand-900 text-sm px-4 py-3 mb-4 leading-relaxed">${o.intro}</div>` : ""}<form class="grid grid-cols-2 gap-4" novalidate>${f}<button type="submit" class="hidden"></button></form>`,
        { title: o.title, sub: o.sub, wide: o.wide, footer: `<div class="flex gap-2"><button data-ok class="btn btn-${o.tone || "primary"} flex-1">${o.icon ? ic(o.icon) : ""}${esc(o.ok || "حفظ")}</button><button data-close class="btn btn-outline">إلغاء</button></div>`, onClose: () => { if (!done) res(null); } });
      const form = m.root.querySelector("form");
      $$("[data-seg]", form).forEach(seg => seg.addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return;
        $$("button", seg).forEach(x => x.setAttribute("aria-pressed", x === b)); form.elements[seg.dataset.seg].value = b.dataset.v;
        if (o.onChange) o.onChange(collect(), form);
      }));
      const collect = () => { const v = {}; o.fields.forEach(fd => { const el = form.elements[fd.name]; if (el) v[fd.name] = fd.type === "check" ? el.checked : el.value; }); return v; };
      if (o.onChange) { form.addEventListener("input", () => o.onChange(collect(), form)); o.onChange(collect(), form); }
      const submit = () => {
        const v = collect();
        const miss = o.fields.find(fd => fd.required && String(v[fd.name] || "").trim() === "");
        if (miss) { toast("أكمل الحقل: " + miss.label, "warning"); const el = form.elements[miss.name]; if (el && el.focus) el.focus(); return; }
        done = true; res(v); m.close();
      };
      form.onsubmit = e => { e.preventDefault(); submit(); };
      m.root.querySelector("[data-ok]").onclick = submit;
    });
  }
};
document.addEventListener("keydown", e => { if (e.key === "Escape" && UI._stack.length) UI.close(UI._stack[UI._stack.length - 1]); });
/** إغلاق النافذة الحالية ثم الانتقال لصفحة */
function closeAndGo(path) { const top = UI._stack[UI._stack.length - 1]; if (top) { UI._afterPop = path; UI.close(top); } else Router.go(path); }
window.addEventListener("popstate", () => { if (UI._ignorePop > 0) { UI._ignorePop--; if (!UI._ignorePop) { while (UI._pendingPush > 0) { UI._pendingPush--; try { history.pushState({ sheet: 1 }, ""); } catch (e) { /* */ } } } if (UI._afterPop && !UI._stack.length) { const p = UI._afterPop; UI._afterPop = null; Router.go(p); } return; } const top = UI._stack[UI._stack.length - 1]; if (top) UI.close(top, true); else Router.render(); });

// ---------------------------------------------------------------- الطباعة والتصدير
function openPrint(title, html) {
  const w = window.open("", "_blank");
  if (!w) return toast("اسمح بالنوافذ المنبثقة لهذا الموقع لطباعة المستند", "warning");
  const d = w.document;
  d.title = title; d.documentElement.setAttribute("dir", "rtl"); d.documentElement.setAttribute("lang", "ar");
  const base = location.href.replace(/[#?].*$/, "").replace(/[^/]*$/, "");
  const css = d.createElement("link"); css.rel = "stylesheet"; css.href = base + "app.css"; d.head.appendChild(css);
  const st = d.createElement("style");
  st.textContent = "body{background:#fff;padding:28px;font-size:13px}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #e2e8f0;padding:7px 9px;text-align:right}th{background:#f6f2fb;color:#3a2059}h1{font-size:20px;font-weight:700}@page{margin:14mm}";
  d.head.appendChild(st);
  d.body.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #552c83;padding-bottom:12px;margin-bottom:18px">
    <div><div style="font-weight:700;font-size:17px;color:#3a2059">${esc(APP.title)}</div><div style="color:#64748b;font-size:12px">${esc(title)}</div></div>
    <div style="text-align:left;color:#64748b;font-size:11px">${new Date().toLocaleString("ar-EG")}</div></div>` + html;
  setTimeout(() => { w.focus(); w.print(); }, 700);
}
function exportCSV(name, headers, rows) {
  if (!rows.length) return toast("لا توجد بيانات للتصدير", "warning");
  const clean = v => `"${String(v === undefined || v === null ? "" : v).replace(/<[^>]*>/g, "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
  let csv = "﻿" + headers.map(clean).join(",") + "\r\n";
  rows.forEach(r => csv += r.map(clean).join(",") + "\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = name + ".csv"; a.click();
}

// ---------------------------------------------------------------- الموجِّه (Hash router)
const Router = {
  routes: {},
  current: null,
  add(path, fn) { this.routes[path] = fn; },
  go(path) { if (location.hash !== "#" + path) location.hash = path; else this.render(); },
  path() { return (location.hash || "").replace(/^#/, "") || ""; },
  render() {
    if (UI._stack.length) return;
    const p = this.path();
    if (!APP.user) { Shell.renderLogin(); return; }
    const scope = APP.user.userType === "ADMIN" ? "/a/" : "/e/";
    const key = p.startsWith(scope) ? p.split("?")[0] : scope + (scope === "/a/" ? "dash" : "home");
    const fn = this.routes[key] || this.routes[scope + (scope === "/a/" ? "dash" : "home")];
    this.current = key;
    if (!p.startsWith(scope)) { history.replaceState(null, "", "#" + key); }
    Shell.mount(key, fn);
  }
};
window.addEventListener("hashchange", () => Router.render());
