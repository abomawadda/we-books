/* ============================================================================
 * بوابة الدخول: اختيار الفئة أولاً (موظف / معاش / شركات التعهيد / زائر) ثم الإدارة
 * الموظف من MyNekaba برقمه الوظيفي؛ الباقون يسجّلون أنفسهم مرة واحدة ويأخذون رقم عضوية من 7 أرقام
 * ========================================================================== */
"use strict";
/** شركات التعهيد (نفس القائمة في logic.js ← OUTSOURCE_COMPANIES) */
const OUTSOURCE_COMPANIES = ["Tedata", "IBS", "Proserve", "عقود يومية"];
const ENTRY = {
  emp: { icon: "badge-check", emoji: "👔", title: "موظف", sub: "عضو النقابة — بياناتك موجودة في MyNekaba", id: "الرقم الوظيفي" },
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
    if (adm) { adm.className = "inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-4 py-2 text-[12.5px] text-brand-100 hover:bg-white/15"; adm.innerHTML = ic("user-cog") + " الإدارة"; }
    f.insertAdjacentHTML("beforebegin", `<div id="lgPick" class="space-y-3">
      <div class="hidden lg:block mb-2"><h2 class="text-2xl font-bold text-white">أهلاً بيك 👋</h2><p class="text-sm text-brand-200 mt-1">إنت مين؟ اختار عشان نوصّلك لصفحتك</p></div>
      <p class="lg:hidden text-center text-sm text-brand-100 -mt-1 mb-1">إنت مين؟ اختار عشان نوصّلك لصفحتك</p>
      <div class="grid grid-cols-2 gap-3">${Object.keys(ENTRY).map(k => { const c = ENTRY[k]; return `<button type="button" data-act="entryPick" data-id="${k}" class="text-right rounded-2xl bg-white/10 hover:bg-white/15 ring-1 ring-white/15 p-4 transition active:scale-[.98]">
        <span class="text-[28px] leading-none">${c.emoji}</span><span class="block font-bold text-[16px] mt-2">${c.title}</span><span class="block text-[11.5px] text-brand-200 mt-0.5 leading-snug">${c.sub}</span></button>`; }).join("")}</div></div>`);
    return;
  }
  const c = ENTRY[t] || ENTRY.emp;
  const lbl = f.querySelector('label[for="lgEmp"]'); if (lbl) lbl.textContent = c.id;
  f.insertAdjacentHTML("afterbegin", `<div class="flex items-center gap-3 rounded-2xl bg-white/10 ring-1 ring-white/15 p-3"><span class="text-[26px]">${c.emoji}</span><div class="flex-1 min-w-0"><b class="block">${c.title}</b><span class="text-[12px] text-brand-200">${c.sub}</span></div><button type="button" data-act="entryPick" data-id="pick" class="text-[12px] text-gold-300 font-semibold shrink-0">تغيير</button></div>
    ${c.note ? `<p class="text-[12.5px] text-brand-100 leading-relaxed">${c.note}</p>` : ""}`);
  if (c.reg) f.insertAdjacentHTML("beforeend", `<button type="button" data-act="entryReg" data-id="${t}" class="btn w-full !h-12 bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20">${ic("plus")} أول مرة؟ سجّل نفسك</button>`);
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
