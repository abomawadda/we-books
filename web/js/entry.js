/* ============================================================================
 * بوابة الدخول والتسجيل الجديد: تصميم منظم وغير متكدس لاختيار الفئة والدخول أو التسجيل
 * ========================================================================== */
"use strict";

/** شركات التعهيد (نفس القائمة في logic.js ← OUTSOURCE_COMPANIES) */
const OUTSOURCE_COMPANIES = ["Tedata", "IBS", "Proserve", "عقود يومية"];

const ENTRY = {
  emp:       { emoji: "👔", title: "المصرية للاتصالات", sub: "نقابة عامة - نقابة مستقلة", id: "الرقم الوظيفي" },
  retiree:   { emoji: "🧓", title: "معاش / استقالة",     sub: "المحالون للمعاش والاستقالة", id: "رقم العضوية أو الوظيفي", reg: true, org: "آخر جهة عمل / سنترال", orgReq: true, orgPh: "مثال: سنترال المنصورة" },
  outsource: { emoji: "🏢", title: "شركات التعهيد",     sub: "العاملون بالتعهيد",         id: "رقم العضوية",            reg: true, org: "الشركة",               orgReq: true },
  guest:     { emoji: "🤝", title: "زائر",              sub: "غير الأعضاء",              id: "رقم العضوية",            reg: true, org: "جهة العمل (اختياري)",  orgReq: false, orgPh: "اختياري" }
};

const _renderLogin = Shell.renderLogin;
Shell.renderLogin = function () {
  const t = Shell.loginTab || "pick";
  if (t === "adm") return _renderLogin.call(Shell);
  Shell.loginTab = "emp"; _renderLogin.call(Shell); Shell.loginTab = t;
  const f = $("#fEmp"); if (!f) return;
  // الهيدر: «النقابة العامة بالدقهلية» بين الشعارين، وتحتهما عنوان المبادرة كبير + اسم المصمم
  { const head = $("#lgMobHead"); if (head) {
      const mid = head.querySelector(".min-w-0.text-center"); if (mid) mid.innerHTML = `<div class="font-display font-bold text-[14.5px] sm:text-[16px] leading-snug text-white">${esc(Brand.get().org || "النقابة العامة بالدقهلية")}</div>`;
      head.insertAdjacentHTML("beforeend", `<div class="text-center max-w-md mx-auto mt-4 mb-1 px-2">
        <h1 class="font-display font-bold text-[25px] sm:text-[28px] leading-[1.3] text-white">${esc(Brand.get().initiative || "مبادرة الكتب الخارجية المخفضة")}</h1>
        <div class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-[12px] text-gold-300 font-semibold">${ic("sparkles", "!w-3.5 !h-3.5")} تصميم أ. محمود العراقي</div></div>`); const cr = $("#lgCredit"); if (cr) cr.remove(); } }

  const adm = $('[data-act="loginTab"][data-id="adm"]');
  if (adm) {
    adm.className = "inline-flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/15 px-3.5 py-1 text-[11.5px] text-brand-100 hover:bg-white/20 transition";
    adm.innerHTML = ic("user-cog") + " دخول الإدارة";
  }

  if (t === "pick") {
    f.classList.add("hidden");
    $$("[data-act='helpForm'],[data-act='faq']").forEach(x => x.classList.add("hidden"));

    const emp = ENTRY.emp;
    const others = ["retiree", "outsource", "guest"];

    f.insertAdjacentHTML("beforebegin", `
      <div id="lgPick" class="space-y-4">
        <div class="text-center lg:text-right">
          <p class="text-[13.5px] text-gold-300 font-semibold">كتب ولادك أقرب… وقسطها أخف</p>
          <div class="flex flex-wrap justify-center lg:justify-start gap-1.5 mt-3">${[["badge-percent", "خصم للأعضاء"], ["calendar-check", "تقسيط مريح"], ["package-check", "استلام قريب منك"]].map(x => `<span class="inline-flex items-center gap-1 rounded-full bg-white/10 ring-1 ring-white/15 px-2.5 h-7 text-[11.5px] text-brand-100">${ic(x[0], "!w-3.5 !h-3.5 text-gold-300")} ${x[1]}</span>`).join("")}</div>
        </div>
        <div class="flex items-center gap-2 text-[11.5px] text-brand-200/90"><span class="h-px flex-1 bg-white/15"></span><span>${ic("log-out", "inline !w-3.5 !h-3.5 rotate-180")} اختار فئتك عشان تدخل</span><span class="h-px flex-1 bg-white/15"></span></div>

        <button type="button" data-act="entryPick" data-id="emp" class="w-full text-right rounded-2xl p-4 bg-white/[0.16] hover:bg-white/[0.22] ring-1 ring-gold-300/50 shadow-sm transition active:scale-[.99] flex items-center gap-3.5">
          <span class="w-11 h-11 shrink-0 rounded-2xl bg-gold-400/20 flex items-center justify-center text-[24px] leading-none">${emp.emoji}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-[15.5px] text-white">${emp.title}</span>
              <span class="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-gold-400/20 text-gold-300">الأساسي</span>
            </div>
            <span class="block text-[12px] text-brand-100/90 mt-0.5">${emp.sub}</span>
          </div>
          <span class="text-gold-300 shrink-0">${ic("arrow-right", "rotate-180")}</span>
        </button>

        <div class="space-y-2">
          <div class="flex items-center gap-2 text-[11px] text-brand-200/80">
            <span class="h-px flex-1 bg-white/15"></span>
            <span>فئات أخرى · دخول أو تسجيل جديد</span>
            <span class="h-px flex-1 bg-white/15"></span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            ${others.map(k => {
              const c = ENTRY[k];
              return `<button type="button" data-act="entryPick" data-id="${k}" class="text-right rounded-2xl p-3 bg-white/[0.09] hover:bg-white/[0.16] ring-1 ring-white/15 transition active:scale-[.98] flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1.5">
                <span class="w-9 h-9 shrink-0 rounded-xl bg-white/10 flex items-center justify-center text-[20px] leading-none">${c.emoji}</span>
                <div class="min-w-0 flex-1">
                  <span class="block font-bold text-[13.5px] text-white leading-snug">${c.title}</span>
                  <span class="block text-[11px] text-brand-200/85 mt-0.5">${c.sub}</span>
                </div>
              </button>`;
            }).join("")}
          </div>
        </div>
      </div>`);
    return;
  }

  const c = ENTRY[t] || ENTRY.emp;
  const mode = c.reg && Shell.regMode === "register" ? "register" : "login";
  const lbl = f.querySelector('label[for="lgEmp"]'); if (lbl) lbl.textContent = c.id;

  const headerHtml = `
    <div class="space-y-2.5 mb-3">
      <div class="flex items-center justify-between gap-2 rounded-2xl bg-white/[0.12] ring-1 ring-white/15 px-3 py-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="w-8 h-8 shrink-0 rounded-xl bg-white/10 flex items-center justify-center text-[18px] leading-none">${c.emoji}</span>
          <div class="min-w-0">
            <div class="font-bold text-white text-[14px] leading-tight truncate">${c.title}</div>
            <div class="text-[11px] text-brand-200 truncate">${c.sub}</div>
          </div>
        </div>
        <button type="button" data-act="entryPick" data-id="pick" class="inline-flex items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 px-2.5 py-1 text-[11.5px] text-gold-300 font-semibold shrink-0 transition">${ic("arrow-right", "!w-3.5 !h-3.5")} تغيير الفئة</button>
      </div>
      ${c.reg ? `
        <div class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/10 ring-1 ring-white/15 text-[12px] font-bold">
          <button type="button" data-act="entryMode" data-id="login" class="py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${mode === "login" ? "bg-white text-brand-950 shadow-sm" : "text-brand-100 hover:bg-white/10"}">${ic("log-out", "!w-3.5 !h-3.5 rotate-180")} دخول</button>
          <button type="button" data-act="entryReg" data-id="${t}" class="py-1.5 rounded-lg transition flex items-center justify-center gap-1.5 ${mode === "register" ? "bg-gold-400 text-brand-950 shadow-sm" : "text-brand-100 hover:bg-white/10"}">${ic("user-plus", "!w-3.5 !h-3.5")} تسجيل جديد</button>
        </div>` : ""}
    </div>`;

  if (mode === "register") {
    f.classList.add("hidden");
    $$("[data-act='helpForm'],[data-act='faq'],#lgShield,#lgCredit").forEach(x => x.classList.add("hidden"));
    const orgField = t === "outsource"
      ? `<div><label class="label !mb-1" for="regOrg">الشركة</label><div class="input-icon">${ic("building-2")}<select id="regOrg" class="input !h-10" required><option value="">— اختر الشركة —</option>${OUTSOURCE_COMPANIES.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("")}</select></div></div>`
      : `<div><label class="label !mb-1" for="regOrg">${esc(c.org)}</label><div class="input-icon">${ic("building-2")}<input id="regOrg" class="input !h-10" placeholder="${esc(c.orgPh || "")}" ${c.orgReq ? "required" : ""}></div></div>`;

    f.insertAdjacentHTML("beforebegin", headerHtml + `
      <div class="rounded-2xl bg-gold-400/10 ring-1 ring-gold-300/30 px-3 py-2.5 mb-3 text-[12px] text-brand-100 leading-relaxed flex gap-2">${ic("sparkles", "shrink-0 mt-0.5 text-gold-300")}<span>التسجيل <b class="text-white">مرة واحدة بس</b> — هيظهر لك <b class="text-white">رقم عضوية</b> تدخل بيه بعد كده مع آخر 4 أرقام من القومي والموبايل.</span></div>
      <form id="fReg" class="space-y-2.5" autocomplete="on">
        <div>
          <label class="label !mb-1" for="regName">الاسم ثلاثي على الأقل</label>
          <div class="input-icon">${ic("user")}<input id="regName" class="input !h-10" placeholder="مثال: أحمد محمد علي" autocomplete="name" required></div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="label !mb-0" for="regNat">الرقم القومي (14 رقم)</label>
              <span id="regNatCnt" class="text-[11px] text-brand-200 num">0 / 14</span>
            </div>
            <div class="input-icon">${ic("lock")}<input id="regNat" class="input !h-10 tracking-[.04em]" type="tel" inputmode="numeric" maxlength="14" dir="ltr" style="text-align:right" placeholder="29901011234567" required></div>
          </div>
          <div>
            <label class="label !mb-1" for="regMob">رقم الموبايل</label>
            <div class="input-icon">${ic("smartphone")}<input id="regMob" class="input !h-10" type="tel" inputmode="tel" maxlength="11" dir="ltr" style="text-align:right" placeholder="01xxxxxxxxx" required></div>
          </div>
        </div>
        ${orgField}
        <p class="text-[11px] text-brand-200/80 text-center">يُحفظ آخر 4 أرقام من القومي فقط للتحقق عند الدخول</p>
        <div id="regChecks" class="grid grid-cols-2 gap-1.5 text-[11px]"></div>
        <button id="regGo" class="btn btn-gold w-full !h-11 !text-brand-950 font-bold shadow-lift disabled:opacity-50">إنشاء الحساب والدخول ${ic("arrow-right", "rotate-180")}</button>
      </form>`);

    const regForm = $("#fReg");
    if (regForm) { regForm.onsubmit = e => { e.preventDefault(); submitInlineRegister(t); }; regForm.addEventListener("input", () => regCheck(t)); regForm.addEventListener("change", () => regCheck(t)); regCheck(t); }
    return;
  }

  f.insertAdjacentHTML("beforebegin", headerHtml);
  { const e1 = $("#lgEmp"), e2 = $("#lgNat"), e3 = $("#lgMob");
    if (e1) { e1.placeholder = t === "emp" ? "مثال: 512345" : t === "retiree" ? "الرقم الوظيفي أو رقم العضوية" : "رقم العضوية (7 أرقام)"; e1.setAttribute("inputmode", "numeric"); }
    if (e2) e2.placeholder = "••••";
    const hint = (el, txt) => { const box = el && el.closest("div.input-icon"); if (box && !box.nextElementSibling?.classList?.contains("lg-hint")) box.insertAdjacentHTML("afterend", `<p class="lg-hint text-[11px] text-brand-200/80 mt-1">${txt}</p>`); };
    hint(e2, "آخر 4 أرقام من يمين الرقم القومي");
    hint(e3, t === "emp" ? "الموبايل المسجّل في بيانات النقابة" : t === "retiree" ? "الموبايل المسجّل في النقابة أو عند التسجيل" : "الموبايل اللي سجّلت بيه"); }
  setTimeout(() => {
    try {
      const rem = JSON.parse(localStorage.getItem("wb_remember") || "null");
      if (rem && rem.empId && (rem.category || "emp") === t) {
        const empInp = $("#lgEmp"), mobInp = $("#lgMob"), remBox = $("#lgRemember");
        if (empInp && !empInp.value) empInp.value = rem.empId;
        if (mobInp && !mobInp.value) mobInp.value = rem.mobile || "";
        if (remBox) remBox.checked = true;
      }
    } catch (_) {}
  }, 20);
};

/** تحقق لحظي من بيانات التسجيل: علامة ✓ لكل خانة صحيحة، والزر يتفعّل لما الكل يكمل */
function regCheck(k) {
  const d = v => String(v || "").replace(/[٠-٩]/g, x => String("٠١٢٣٤٥٦٧٨٩".indexOf(x))).replace(/\D/g, ""), val = id => ($("#" + id) || {}).value || "";
  const c = ENTRY[k] || {}, nat = d(val("regNat")), mob = d(val("regMob"));
  const rows = [["الاسم ثلاثي", val("regName").trim().split(/\s+/).filter(Boolean).length >= 3], ["الرقم القومي", nat.length === 14 && /^[23]/.test(nat)], ["الموبايل", /^01[0125]\d{8}$/.test(mob)]]
    .concat(c.orgReq ? [[k === "outsource" ? "الشركة" : "جهة العمل", !!val("regOrg").trim()]] : []);
  const box = $("#regChecks"); if (box) box.innerHTML = rows.map(r => `<span class="flex items-center gap-1 rounded-lg px-2 py-1 ${r[1] ? "bg-emerald-400/15 text-emerald-200" : "bg-white/5 text-brand-200/70"}">${ic(r[1] ? "circle-check" : "circle-alert", "!w-3.5 !h-3.5")} ${r[0]}</span>`).join("");
  const go = $("#regGo"); if (go) go.disabled = !rows.every(r => r[1]);
}
async function submitInlineRegister(k) {
  const normDigits = v => String(v || "").replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "");
  const name = ($("#regName") ? $("#regName").value : "").trim().replace(/\s+/g, " ");
  const nationalId = normDigits($("#regNat") ? $("#regNat").value : "");
  const mobile = normDigits($("#regMob") ? $("#regMob").value : "");
  const org = ($("#regOrg") ? $("#regOrg").value : "").trim();
  const c = ENTRY[k] || {};

  if (name.split(" ").length < 3) return toast("اكتب الاسم ثلاثياً على الأقل", "warning");
  if (nationalId.length !== 14 || !/^[23]/.test(nationalId)) return toast("أدخل الرقم القومي صحيحاً (14 رقم يبدأ بـ 2 أو 3)", "warning");
  if (!/^01[0125]\d{8}$/.test(mobile)) return toast("أدخل رقم موبايل مصري صحيح (11 رقم يبدأ بـ 01)", "warning");
  if (c.orgReq && !org) return toast(k === "outsource" ? "اختر الشركة من القائمة" : "اكتب " + (c.org || "جهة العمل"), "warning");

  const r = await call("REGISTER_MEMBER", { category: k, name, nationalId, mobile, org }, { block: true });
  if (!r.success) {
    if (r.exists && r.portalCategory) {
      Shell.loginTab = r.portalCategory; Shell.regMode = "login"; Shell.renderLogin();
      setTimeout(() => {
        const e1 = $("#lgEmp"), e2 = $("#lgNat"), e3 = $("#lgMob");
        if (e1 && r.empId) e1.value = r.empId;
        if (e2) e2.value = nationalId.slice(-4);
        if (e3) e3.value = mobile;
      }, 30);
      return toast(r.message + " (تم تحويلك تلقائياً للدخول — اضغط دخول الآن)", "warning", 7000);
    }
    return toast(r.message, r.exists ? "warning" : "danger");
  }

  Shell.regMode = "login";
  await Shell.enter(r);
  setTimeout(() => {
    const m = UI.open(`<div class="text-center">
      <div class="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl">${ic("circle-check")}</div>
      <div class="font-bold text-lg text-slate-900 mt-3">تم إنشاء حسابك بنجاح</div>
      <p class="text-[13.5px] text-slate-600 mt-1.5">احتفظ برقم عضويتك للدخول به لاحقاً:</p>
      <div class="mt-3 rounded-2xl bg-brand-50 ring-1 ring-brand-200 py-4 px-3 flex flex-col items-center gap-2">
        <b class="text-[30px] tracking-[.22em] num text-brand-800">${esc(r.newMemberId)}</b>
        <button type="button" id="copyMemIdBtn" class="btn btn-soft btn-xs">${ic("clipboard-check")} نسخ رقم العضوية</button>
      </div>
      <button class="btn btn-primary w-full mt-4" data-close>متابعة للحجز</button>
    </div>`, { title: "أهلاً بك" });
    const cp = $("#copyMemIdBtn", m && m.root);
    if (cp) cp.onclick = () => {
      try { navigator.clipboard.writeText(String(r.newMemberId || "")); toast("تم نسخ رقم العضوية", "success"); } catch (_) {}
    };
  }, 450);
}

on("entryPick", k => { Shell.loginTab = k; Shell.regMode = "login"; Shell.renderLogin(); });
on("entryMode", m => { Shell.regMode = m; Shell.renderLogin(); });
on("entryReg", () => { Shell.regMode = "register"; Shell.renderLogin(); });

if (typeof document !== "undefined") {
  document.addEventListener("input", e => {
    const t = e.target; if (!t) return;
    if (t.id === "lgNat") {
      t.value = t.value.replace(/\D/g, "").slice(0, 4);
      if (t.value.length === 4) { const mob = document.getElementById("lgMob"); if (mob) mob.focus(); }
    } else if (t.id === "lgMob" || t.id === "regMob") {
      t.value = t.value.replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "").slice(0, 11);
    } else if (t.id === "regNat") {
      t.value = t.value.replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/\D/g, "").slice(0, 14);
      const cnt = document.getElementById("regNatCnt");
      if (cnt) {
        cnt.textContent = t.value.length + " / 14";
        cnt.className = "text-[11px] num " + (t.value.length === 14 ? "text-emerald-300 font-bold" : "text-brand-200");
      }
    }
  });
}
