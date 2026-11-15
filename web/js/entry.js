/* ============================================================================
 * بوابة الدخول والتسجيل الجديد: تصميم منظم وغير متكدس لاختيار الفئة والدخول أو التسجيل
 * ========================================================================== */
"use strict";

/** شركات التعهيد (نفس القائمة في logic.js ← OUTSOURCE_COMPANIES) */
const OUTSOURCE_COMPANIES = ["Tedata", "IBS", "Proserve", "عقود يومية"];

const ENTRY = {
  emp:       { emoji: "👔", title: "المصرية للاتصالات", sub: "نقابة عامة - نقابة مستقلة", id: "الرقم الوظيفي" },
  retiree:   { emoji: "🧓", title: "معاش",              sub: "عضو سابق",                 id: "رقم العضوية أو الوظيفي", reg: true, org: "آخر جهة عمل / سنترال", orgReq: true, orgPh: "مثال: سنترال المنصورة" },
  outsource: { emoji: "🏢", title: "شركات التعهيد",     sub: "العاملون بالتعهيد",         id: "رقم العضوية",            reg: true, org: "الشركة",               orgReq: true },
  guest:     { emoji: "🤝", title: "زائر",              sub: "غير الأعضاء",              id: "رقم العضوية",            reg: true, org: "جهة العمل (اختياري)",  orgReq: false, orgPh: "اختياري" }
};

const _renderLogin = Shell.renderLogin;
Shell.renderLogin = function () {
  const t = Shell.loginTab || "pick";
  if (t === "adm") return _renderLogin.call(Shell);
  Shell.loginTab = "emp"; _renderLogin.call(Shell); Shell.loginTab = t;
  const f = $("#fEmp"); if (!f) return;

  const adm = $('[data-act="loginTab"][data-id="adm"]');
  if (adm) {
    adm.className = "inline-flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/15 px-4 py-1.5 text-[12px] text-brand-100 hover:bg-white/20 transition";
    adm.innerHTML = ic("user-cog") + " دخول الإدارة";
  }

  if (t === "pick") {
    f.classList.add("hidden");
    $$("[data-act='helpForm'],[data-act='faq']").forEach(x => x.classList.add("hidden"));

    const emp = ENTRY.emp;
    const others = ["retiree", "outsource", "guest"];

    f.insertAdjacentHTML("beforebegin", `
      <div id="lgPick" class="space-y-5">
        <div class="text-center lg:text-right">
          <h2 class="text-xl lg:text-2xl font-bold text-white">تسجيل الدخول</h2>
          <p class="text-[13px] text-brand-200 mt-1">اختر فئتك للمتابعة أو إنشاء حساب جديد</p>
        </div>

        <button type="button" data-act="entryPick" data-id="emp" class="w-full text-right rounded-2xl p-4 sm:p-5 bg-white/[0.16] hover:bg-white/[0.22] ring-1 ring-gold-300/50 shadow-sm transition active:scale-[.99] flex items-center gap-3.5">
          <span class="w-12 h-12 shrink-0 rounded-2xl bg-gold-400/20 flex items-center justify-center text-[26px] leading-none">${emp.emoji}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-[16px] text-white">${emp.title}</span>
              <span class="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-gold-400/20 text-gold-300">الأساسي</span>
            </div>
            <span class="block text-[12.5px] text-brand-100/90 mt-0.5">${emp.sub}</span>
          </div>
          <span class="text-gold-300 shrink-0">${ic("arrow-right", "rotate-180")}</span>
        </button>

        <div class="space-y-2.5">
          <div class="flex items-center gap-2 text-[11.5px] text-brand-200/80">
            <span class="h-px flex-1 bg-white/15"></span>
            <span>فئات أخرى · دخول أو تسجيل جديد</span>
            <span class="h-px flex-1 bg-white/15"></span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            ${others.map(k => {
              const c = ENTRY[k];
              return `<button type="button" data-act="entryPick" data-id="${k}" class="text-right rounded-2xl p-3.5 bg-white/[0.09] hover:bg-white/[0.16] ring-1 ring-white/15 transition active:scale-[.98] flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2">
                <span class="w-10 h-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center text-[22px] leading-none">${c.emoji}</span>
                <div class="min-w-0 flex-1">
                  <span class="block font-bold text-[14px] text-white leading-snug">${c.title}</span>
                  <span class="block text-[11.5px] text-brand-200/85 mt-0.5">${c.sub}</span>
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
    <div class="space-y-3 mb-4">
      <div class="flex items-center justify-between gap-2 rounded-2xl bg-white/[0.12] ring-1 ring-white/15 px-3.5 py-2.5">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="w-9 h-9 shrink-0 rounded-xl bg-white/10 flex items-center justify-center text-[20px] leading-none">${c.emoji}</span>
          <div class="min-w-0">
            <div class="font-bold text-white text-[14.5px] leading-tight truncate">${c.title}</div>
            <div class="text-[11px] text-brand-200 truncate">${c.sub}</div>
          </div>
        </div>
        <button type="button" data-act="entryPick" data-id="pick" class="inline-flex items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 px-2.5 py-1.5 text-[12px] text-gold-300 font-semibold shrink-0 transition">${ic("arrow-right", "!w-3.5 !h-3.5")} تغيير الفئة</button>
      </div>
      ${c.reg ? `
        <div class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/10 ring-1 ring-white/15 text-[12.5px] font-bold">
          <button type="button" data-act="entryMode" data-id="login" class="py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${mode === "login" ? "bg-white text-brand-950 shadow-sm" : "text-brand-100 hover:bg-white/10"}">${ic("log-out", "!w-3.5 !h-3.5 rotate-180")} دخول</button>
          <button type="button" data-act="entryMode" data-id="register" class="py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${mode === "register" ? "bg-gold-400 text-brand-950 shadow-sm" : "text-brand-100 hover:bg-white/10"}">${ic("user-plus", "!w-3.5 !h-3.5")} تسجيل جديد</button>
        </div>` : ""}
    </div>`;

  if (mode === "register") {
    f.classList.add("hidden");
    $$("[data-act='helpForm'],[data-act='faq']").forEach(x => x.classList.add("hidden"));
    const orgField = t === "outsource"
      ? `<div><label class="label" for="regOrg">الشركة</label><div class="input-icon">${ic("building-2")}<select id="regOrg" class="input" required><option value="">— اختر الشركة —</option>${OUTSOURCE_COMPANIES.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("")}</select></div></div>`
      : `<div><label class="label" for="regOrg">${esc(c.org)}</label><div class="input-icon">${ic("building-2")}<input id="regOrg" class="input" placeholder="${esc(c.orgPh || "")}" ${c.orgReq ? "required" : ""}></div></div>`;

    f.insertAdjacentHTML("beforebegin", headerHtml + `
      <form id="fReg" class="space-y-3.5" autocomplete="on">
        <div>
          <label class="label" for="regName">الاسم ثلاثي على الأقل</label>
          <div class="input-icon">${ic("user")}<input id="regName" class="input" placeholder="مثال: أحمد محمد علي" autocomplete="name" required></div>
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="label !mb-0" for="regNat">الرقم القومي (14 رقم)</label>
            <span id="regNatCnt" class="text-[11px] text-brand-200 num">0 / 14</span>
          </div>
          <div class="input-icon">${ic("lock")}<input id="regNat" class="input tracking-[.08em]" type="tel" inputmode="numeric" maxlength="14" dir="ltr" style="text-align:right" placeholder="29901011234567" required></div>
          <p class="text-[11px] text-brand-200/80 mt-1">يُحفظ آخر 4 أرقام فقط للتحقق عند تسجيل الدخول</p>
        </div>
        <div>
          <label class="label" for="regMob">رقم الموبايل</label>
          <div class="input-icon">${ic("smartphone")}<input id="regMob" class="input" type="tel" inputmode="tel" maxlength="11" dir="ltr" style="text-align:right" placeholder="01xxxxxxxxx" required></div>
        </div>
        ${orgField}
        <button class="btn btn-gold btn-lg w-full !text-brand-950 font-bold shadow-lift">إنشاء الحساب والدخول ${ic("arrow-right", "rotate-180")}</button>
      </form>`);

    const regForm = $("#fReg");
    if (regForm) regForm.onsubmit = e => { e.preventDefault(); submitInlineRegister(t); };
    return;
  }

  f.insertAdjacentHTML("beforebegin", headerHtml);
  setTimeout(() => {
    try {
      const rem = JSON.parse(localStorage.getItem("wb_remember") || "null");
      if (rem && rem.empId) {
        const empInp = $("#lgEmp"), mobInp = $("#lgMob"), remBox = $("#lgRemember");
        if (empInp && !empInp.value) empInp.value = rem.empId;
        if (mobInp && !mobInp.value) mobInp.value = rem.mobile || "";
        if (remBox) remBox.checked = true;
      }
    } catch (_) {}
  }, 20);
};

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
  if (!r.success) return toast(r.message, r.exists ? "warning" : "danger");

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
