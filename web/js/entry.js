/* ============================================================================
 * بوابة الدخول: اختيار الفئة أولاً (موظف / معاش / شركات التعهيد / زائر) ثم الإدارة
 * الموظف من MyNekaba برقمه الوظيفي؛ الباقون يسجّلون أنفسهم مرة واحدة ويأخذون رقم عضوية من 7 أرقام
 * ========================================================================== */
"use strict";

/** شركات التعهيد (نفس القائمة في logic.js ← OUTSOURCE_COMPANIES) */
const OUTSOURCE_COMPANIES = ["Tedata", "IBS", "Proserve", "عقود يومية"];

const ENTRY = {
  emp: { icon: "badge-check", emoji: "👔", title: "موظف بالشركة", badge: "عضو النقابة", sub: "بياناتك مسجلة في MyNekaba — ادخل برقمك الوظيفي فوراً", id: "الرقم الوظيفي" },
  retiree: { icon: "user", emoji: "🧓", title: "معاش / استقالة", sub: "عضو سابق — ادخل برقمك أو سجّل لأول مرة", id: "رقم العضوية أو الرقم الوظيفي", reg: true,
    note: "لو بياناتك كاملة في النقابة ادخل برقمك الوظيفي على طول. لو مش راضي يدخل، سجّل نفسك مرة واحدة وهتاخد رقم عضوية." },
  outsource: { icon: "building-2", emoji: "🏢", title: "شركات التعهيد", sub: "العاملون بالتعهيد مع الشركة", id: "رقم العضوية", reg: true, org: "اسم الشركة",
    note: "بيانات الشركات هتتضاف قريباً. لحد ما تتضاف سجّل نفسك مرة واحدة وهتاخد رقم عضوية تدخل بيه." },
  guest: { icon: "sparkles", emoji: "🤝", title: "زائر", sub: "مش عضو؟ سجّل واحجز زيّك زي أي عضو", id: "رقم العضوية", reg: true, org: "جهة العمل / مين رشّحك (اختياري)",
    note: "سجّل مرة واحدة بالاسم والقومي والموبايل، وهتاخد رقم عضوية وتحجز فوراً (الدفع كاش — التقسيط بموافقة الإدارة)." }
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
      adm.className = "inline-flex items-center gap-2 rounded-full bg-white/[0.14] ring-1 ring-white/20 px-4 py-2 text-[12.5px] text-brand-100 hover:bg-white/[0.22] transition shadow-sm";
      adm.innerHTML = ic("user-cog") + " دخول الإدارة";
    }

    const cEmp = ENTRY.emp;
    f.insertAdjacentHTML("beforebegin", `<div id="lgPick" class="space-y-3.5 animate-in fade-in duration-200">
      <div class="hidden lg:block">
        <h2 class="text-2xl font-bold text-white">أهلاً بك 👋</h2>
        <p class="text-sm text-brand-200 mt-1">اختر فئتك للبدء وتسجيل الدخول للمبادرة</p>
      </div>
      <p class="lg:hidden text-center text-sm text-brand-100 -mt-1 mb-1 font-semibold">اختر فئتك للبدء وتسجيل الدخول</p>

      <div class="rounded-2xl bg-gradient-to-l from-white/[0.18] to-white/[0.10] ring-1 ring-white/20 p-3.5 text-right space-y-1 shadow-sm backdrop-blur-md">
        <div class="flex items-center justify-between gap-2 text-gold-300 font-bold text-xs">
          <span class="flex items-center gap-1.5">${ic("sparkles", "!w-4 !h-4 text-gold-300")} حجز الكتب الخارجية بالتقسيط للعاملين</span>
          <span class="px-2 py-0.5 rounded-full text-[10.5px] bg-white/15 ring-1 ring-white/25 text-white num">مبادرة 2026/2027</span>
        </div>
        <p class="text-[12px] text-brand-100/90 leading-relaxed">خصم نقابي موحد على سعر الغلاف · تقسيط ميسر بلا فوائد · توزيع عادل بأسبقية الحجز</p>
      </div>

      <button type="button" data-act="entryPick" data-id="emp" class="w-full text-right rounded-2xl bg-gradient-to-l from-white/[0.24] to-white/[0.14] hover:from-white/[0.30] hover:to-white/[0.18] ring-1 ring-gold-300/40 hover:ring-gold-300 p-4 transition-all duration-200 active:scale-[.98] shadow-lift relative overflow-hidden group">
        <div class="absolute -left-6 -bottom-6 w-24 h-24 rounded-full bg-gold-400/15 blur-xl pointer-events-none"></div>
        <div class="flex items-center gap-3.5 relative z-10">
          <span class="text-[34px] leading-none shrink-0 p-2.5 rounded-2xl bg-white/15 ring-1 ring-white/25 group-hover:scale-105 transition">👔</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-bold text-[16.5px] text-white">${cEmp.title}</span>
              <span class="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-gold-400/25 text-gold-300 ring-1 ring-gold-400/40">${cEmp.badge}</span>
            </div>
            <span class="block text-[12px] text-brand-100 mt-1 leading-snug">${cEmp.sub}</span>
          </div>
          <span class="text-gold-300 shrink-0 text-xl font-bold transition group-hover:-translate-x-1">${ic("arrow-right", "rotate-180 text-gold-300")}</span>
        </div>
      </button>

      <div class="pt-1">
        <div class="text-[11.5px] font-bold text-brand-200 mb-2 flex items-center gap-2">
          <span>فئات أخرى مرحب بها في المبادرة:</span>
          <span class="h-px flex-1 bg-white/15"></span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          ${["retiree", "outsource", "guest"].map(k => {
            const c = ENTRY[k];
            return `<button type="button" data-act="entryPick" data-id="${k}" class="text-right rounded-2xl bg-white/[0.13] hover:bg-white/[0.20] ring-1 ring-white/15 hover:ring-white/30 p-3.5 transition-all duration-150 active:scale-[.98] flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2 group">
              <span class="text-[26px] leading-none shrink-0 p-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 group-hover:scale-105 transition">${c.emoji}</span>
              <div class="flex-1 min-w-0">
                <span class="block font-bold text-[13.5px] text-white">${c.title}</span>
                <span class="block text-[11px] text-brand-200 mt-0.5 leading-snug line-clamp-2">${c.sub}</span>
              </div>
            </button>`;
          }).join("")}
        </div>
      </div>
    </div>`);
    return;
  }

  const c = ENTRY[t] || ENTRY.emp;
  const lbl = f.querySelector('label[for="lgEmp"]'); if (lbl) lbl.textContent = c.id;

  f.insertAdjacentHTML("afterbegin", `
    <div class="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.16] ring-1 ring-white/20 p-3.5 backdrop-blur-md">
      <div class="flex items-center gap-3 min-w-0">
        <span class="text-[28px] p-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 shrink-0">${c.emoji}</span>
        <div class="min-w-0">
          <b class="block text-white text-[15px]">${c.title}</b>
          <span class="text-[12px] text-brand-200 truncate block">${c.sub}</span>
        </div>
      </div>
      <button type="button" data-act="entryPick" data-id="pick" class="btn btn-outline btn-xs !text-white !bg-white/15 hover:!bg-white/25 !ring-white/30 shrink-0 flex items-center gap-1">${ic("arrow-right")} تغيير الفئة</button>
    </div>
    ${c.note ? `<div class="rounded-xl bg-gold-400/15 ring-1 ring-gold-400/30 p-2.5 text-[12px] text-gold-200 leading-relaxed flex items-start gap-2">${ic("info", "!w-4 !h-4 text-gold-300 shrink-0 mt-0.5")}<span>${c.note}</span></div>` : ""}
    ${c.reg ? `
      <div class="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/10 ring-1 ring-white/20 text-xs font-semibold text-center">
        <button type="button" class="py-2 rounded-lg bg-white/25 text-white font-bold shadow-sm pointer-events-none">تسجيل الدخول</button>
        <button type="button" data-act="entryReg" data-id="${t}" class="py-2 rounded-lg text-brand-200 hover:text-white hover:bg-white/15 transition flex items-center justify-center gap-1.5">${ic("plus", "!w-3.5 !h-3.5")} تسجيل جديد</button>
      </div>` : ""}`);

  if (c.reg) {
    f.insertAdjacentHTML("beforeend", `<button type="button" data-act="entryReg" data-id="${t}" class="btn w-full !h-12 bg-white/[0.14] text-white ring-1 ring-white/25 hover:bg-white/[0.22] font-bold">${ic("plus")} أول مرة؟ سجّل نفسك الآن</button>`);
  }

  // ملء البيانات المحفوظة إن وُجدت
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
  const v = await UI.form({ title: "تسجيل جديد — " + c.title, intro: "بياناتك بتتحفظ عند المبادرة بس (من القومي بنحفظ آخر 4 أرقام للدخول). بعد التسجيل هتاخد <b>رقم عضوية</b> وتحجز على طول.",
    fields: [{ name: "name", label: "الاسم ثلاثي", required: true }, { name: "nationalId", label: "الرقم القومي (14 رقم)", type: "tel", required: true }, { name: "mobile", label: "رقم الموبايل", type: "tel", required: true },
      ...(k === "outsource" ? [{ name: "org", label: "الشركة", type: "select", required: true, value: "", options: [["", "— اختر الشركة —"], ...OUTSOURCE_COMPANIES.map(x => [x, x])] }]
        : c.org ? [{ name: "org", label: c.org, required: k !== "guest" }] : [{ name: "org", label: "آخر جهة عمل", required: true }])],
    ok: "سجّلني", icon: "check" });
  if (!v) return;
  if (k === "outsource" && !v.org) return toast("اختر الشركة من القائمة", "warning");
  const r = await call("REGISTER_MEMBER", Object.assign({ category: k }, v), { block: true });
  if (!r.success) return toast(r.message, r.exists ? "warning" : "danger");
  await Shell.enter(r);
  setTimeout(() => UI.open(`<div class="text-center"><div class="text-[44px]">🎉</div><div class="font-bold text-lg mt-1">أهلاً بيك في المبادرة!</div>
    <p class="text-[13.5px] text-slate-600 mt-2">رقم عضويتك — احفظه عشان تدخل بيه بعد كده:</p>
    <div class="mt-3 rounded-2xl bg-brand-50 ring-1 ring-brand-200 py-4"><b class="text-[32px] tracking-[.25em] num text-brand-800">${esc(r.newMemberId)}</b></div>
    <p class="text-[12px] text-slate-500 mt-3">الدخول بعد كده: رقم العضوية + آخر 4 أرقام من القومي + الموبايل.</p>
    <button class="btn btn-primary w-full mt-4" data-close>يلا نحجز 📚</button></div>`, { title: "تم التسجيل" }), 450);
});

// مستمع التحقق والتنقل التلقائي في حقول الدخول
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
