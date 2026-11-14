/* ============================================================================
 * بوابة الدخول: تصميم مبسّط واحترافي لاختيار الفئة والدخول أو التسجيل
 * ========================================================================== */
"use strict";

/** شركات التعهيد (نفس القائمة في logic.js ← OUTSOURCE_COMPANIES) */
const OUTSOURCE_COMPANIES = ["Tedata", "IBS", "Proserve", "عقود يومية"];

const ENTRY = {
  emp:       { emoji: "👔", title: "موظف",          sub: "عضو النقابة",        id: "الرقم الوظيفي" },
  retiree:   { emoji: "🧓", title: "معاش / استقالة", sub: "عضو سابق",          id: "رقم العضوية أو الوظيفي", reg: true },
  outsource: { emoji: "🏢", title: "شركات التعهيد",  sub: "العاملون بالتعهيد",  id: "رقم العضوية", reg: true, org: "اسم الشركة" },
  guest:     { emoji: "🤝", title: "زائر",           sub: "غير الأعضاء",       id: "رقم العضوية", reg: true, org: "جهة العمل (اختياري)" }
};

const _renderLogin = Shell.renderLogin;
Shell.renderLogin = function () {
  const t = Shell.loginTab || "pick";
  if (t === "adm") return _renderLogin.call(Shell);
  Shell.loginTab = "emp"; _renderLogin.call(Shell); Shell.loginTab = t;
  const f = $("#fEmp"); if (!f) return;

  if (t === "pick") {
    f.classList.add("hidden");
    $$("[data-act='helpForm'],[data-act='faq']").forEach(x => x.classList.add("hidden"));
    const adm = $('[data-act="loginTab"][data-id="adm"]');
    if (adm) {
      adm.className = "inline-flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/15 px-4 py-1.5 text-[12px] text-brand-100 hover:bg-white/20 transition";
      adm.innerHTML = ic("user-cog") + " دخول الإدارة";
    }

    f.insertAdjacentHTML("beforebegin", `
      <div id="lgPick" class="space-y-4">
        <div class="text-center lg:text-right">
          <h2 class="text-xl lg:text-2xl font-bold text-white">تسجيل الدخول</h2>
          <p class="text-[13px] text-brand-200 mt-0.5">اختر فئتك للمتابعة</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${Object.keys(ENTRY).map(k => {
            const c = ENTRY[k];
            const isEmp = k === "emp";
            return `<button type="button" data-act="entryPick" data-id="${k}" class="text-right rounded-2xl p-4 transition active:scale-[.98] ${isEmp
              ? "bg-white/[0.18] hover:bg-white/[0.24] ring-1 ring-gold-300/45 shadow-sm"
              : "bg-white/[0.11] hover:bg-white/[0.18] ring-1 ring-white/15"}">
              <div class="flex items-center justify-between">
                <span class="text-[28px] leading-none">${c.emoji}</span>
                ${isEmp ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold-400/20 text-gold-300">الأساسي</span>` : ""}
              </div>
              <span class="block font-bold text-[15px] text-white mt-3">${c.title}</span>
              <span class="block text-[11.5px] text-brand-200 mt-0.5">${c.sub}</span>
            </button>`;
          }).join("")}
        </div>
      </div>`);
    return;
  }

  const c = ENTRY[t] || ENTRY.emp;
  const lbl = f.querySelector('label[for="lgEmp"]'); if (lbl) lbl.textContent = c.id;

  f.insertAdjacentHTML("afterbegin", `
    <div class="flex items-center justify-between gap-2 rounded-2xl bg-white/[0.13] ring-1 ring-white/15 px-3.5 py-2.5">
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="text-[22px] leading-none shrink-0">${c.emoji}</span>
        <span class="font-bold text-white text-[14.5px] truncate">${c.title}</span>
      </div>
      <button type="button" data-act="entryPick" data-id="pick" class="text-[12px] text-gold-300 hover:underline font-semibold shrink-0">تغيير الفئة</button>
    </div>
    ${c.reg ? `
      <div class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/10 ring-1 ring-white/15 text-xs font-bold text-center">
        <span class="py-2 rounded-lg bg-white/20 text-white">دخول</span>
        <button type="button" data-act="entryReg" data-id="${t}" class="py-2 rounded-lg text-brand-200 hover:text-white hover:bg-white/10 transition flex items-center justify-center gap-1">${ic("user-plus", "!w-3.5 !h-3.5")} تسجيل جديد</button>
      </div>` : ""}`);

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

on("entryPick", k => { Shell.loginTab = k; Shell.renderLogin(); });

on("entryReg", async k => {
  const c = ENTRY[k];
  const v = await UI.form({ title: "تسجيل جديد — " + c.title, intro: "أدخل بياناتك لإنشاء رقم عضوية والدخول مباشرة.",
    fields: [{ name: "name", label: "الاسم ثلاثي", required: true }, { name: "nationalId", label: "الرقم القومي (14 رقم)", type: "tel", required: true }, { name: "mobile", label: "رقم الموبايل", type: "tel", required: true },
      ...(k === "outsource" ? [{ name: "org", label: "الشركة", type: "select", required: true, value: "", options: [["", "— اختر الشركة —"], ...OUTSOURCE_COMPANIES.map(x => [x, x])] }]
        : c.org ? [{ name: "org", label: c.org, required: k !== "guest" }] : [{ name: "org", label: "آخر جهة عمل", required: true }])],
    ok: "تسجيل ودخول", icon: "check" });
  if (!v) return;
  if (k === "outsource" && !v.org) return toast("اختر الشركة من القائمة", "warning");
  const r = await call("REGISTER_MEMBER", Object.assign({ category: k }, v), { block: true });
  if (!r.success) return toast(r.message, r.exists ? "warning" : "danger");
  await Shell.enter(r);
  setTimeout(() => UI.open(`<div class="text-center"><div class="text-[44px]">🎉</div><div class="font-bold text-lg mt-1">تم التسجيل بنجاح</div>
    <p class="text-[13.5px] text-slate-600 mt-2">رقم عضويتك للدخول لاحقاً:</p>
    <div class="mt-3 rounded-2xl bg-brand-50 ring-1 ring-brand-200 py-4"><b class="text-[32px] tracking-[.25em] num text-brand-800">${esc(r.newMemberId)}</b></div>
    <button class="btn btn-primary w-full mt-4" data-close>متابعة</button></div>`, { title: "أهلاً بك" }), 450);
});

if (typeof document !== "undefined") {
  document.addEventListener("input", e => {
    if (e.target && e.target.id === "lgNat") {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
      if (e.target.value.length === 4) {
        const mob = document.getElementById("lgMob");
        if (mob) mob.focus();
      }
    } else if (e.target && e.target.id === "lgMob") {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11);
    }
  });
}
