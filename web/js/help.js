/* ============================================================================
 * مساعدة الموظف: «مش قادر أدخل؟» و«نسيت بياناتي» والأسئلة الشائعة
 * لا يُكتب شيء على الخادم: طلب المساعدة يذهب للمسؤول على واتساب مباشرة
 * ========================================================================== */
"use strict";
const FAQ = [
  ["إزاي أدخل؟", "اختار فئتك الأول (موظف / معاش / تعهيد / زائر). الموظف بيدخل بالرقم الوظيفي + آخر 4 أرقام من الرقم القومي + الموبايل المسجّل في النقابة، والباقي بيسجّل مرة واحدة وياخد رقم عضوية. لو أي بيان اتغيّر (موبايل جديد مثلاً) كلّم المسؤول يحدّثه في منظومة النقابة."],
  ["كتبت بياناتي صح ومش راضي يدخلني", "غالباً بياناتك في منظومة النقابة ناقصة (موبايل أو رقم قومي) أو مسجّلة بشكل مختلف. اضغط «نسيت بياناتي / مش قادر أدخل» وابعت طلب للمسؤول وهيظبطها لك."],
  ["أقدر أعدّل حجزي؟", "أيوه، تزوّد وتقلّل وتغيّر طول ما الحجز مفتوح. بعد قفل الحجز التعديل بيبقى عن طريق المسؤول بس، والتقليل ممكن يترفض لو الكتب اتطلبت من المكتبة خلاص."],
  ["لو ألغيت بعد قفل الحجز؟", "الكتب بتتطلب من المكتبة بعدد الحجوزات، فالإلغاء بعد القفل مش مضمون. كلّم المسؤول الأول قبل ما تقرر."],
  ["الكتاب مكتوب عليه «السعر جاي مع الشحنة»؟", "يعني ناشره لسه ما أعلنش السعر. احجزه عادي، وسعره بيتثبّت لما فاتورة المكتبة توصل — وبخصم العاملين برضه. هتشوف السعر النهائي في حجوزاتي قبل الاستلام."],
  ["إمتى أستلم الكتب؟", "لما الكتب توصل وتتوزع هيظهر لك في الرئيسية «كتبك جاهزة» ومعاه موعدك ومكان الاستلام ورمز الاستلام (QR)."],
  ["الكتاب ما وصلش أو ناقص؟", "التوزيع بالأسبقية: اللي حجز الأول بياخد الأول. لو نسختك ما وصلتش هتفضل في قائمة الانتظار لحد التوريد التاني، ومش هتدفع تمنها إلا لما تستلمها."],
  ["هدفع إمتى وإزاي؟", "بتدفع المقدم يوم الاستلام (كاش أو إنستاباي أو محفظة)، والباقي أقساط على الشهور حسب اللي اخترته في الحجز. تابع كل ده من «مدفوعاتي»."],
  ["أقدر أحجز لأولاد أخويا أو قرايبي؟", "أيوه، من «العائلة» تضيف قريب وتحجز له — بتتحسب عليك انت."],
  ["لو دفعت زيادة أو رجّعت كتاب؟", "الفلوس الزيادة بتتحسب رصيد ليك ويرجّعها لك المسؤول أو تتخصم من أقساطك. المرتجع مقبول خلال أيام قليلة من الاستلام لو الكتاب سليم."],
  ["حد تاني ممكن يستلم بدالي؟", "أيوه — من بطاقة «كتبك جاهزة» اضغط «حد هيستلم بدالي» وابعت له الرسالة على واتساب، وهيتسجّل اسمه كمستلم."]
];
function faqHTML() {
  return '<div class="space-y-2">' + FAQ.map(q => '<details class="rounded-2xl ring-1 ring-slate-200 bg-white group"><summary class="cursor-pointer list-none flex items-center gap-3 px-4 py-3.5 font-semibold text-[14.5px] text-slate-800"><span class="w-7 h-7 rounded-full bg-brand-50 text-brand-700 text-[13px] flex items-center justify-center shrink-0">؟</span><span class="flex-1">' + esc(q[0]) + '</span>' + ic("chevron-down", "text-slate-400 transition group-open:rotate-180") + '</summary><div class="px-4 pb-4 -mt-1 text-[13.5px] text-slate-600 leading-relaxed">' + esc(q[1]) + '</div></details>').join("") + '</div>'
    + '<button class="btn btn-outline w-full mt-4" data-act="helpForm">' + ic("headset") + ' سؤالك مش هنا؟ ابعت للمسؤول</button>';
}
on("faq", () => UI.open(faqHTML(), { title: "أسئلة شائعة" }));
const adminWa = () => Brand.get().whatsapp || Brand.get().phone;
/** «نسيت بياناتي / مش قادر أدخل»: نموذج قصير يُرسل للمسؤول على واتساب */
on("helpForm", async () => {
  const v = await UI.form({ title: "نسيت بياناتي / مش قادر أدخل", intro: "اكتب اللي تعرفه وهنبعته للمسؤول على واتساب، وهيرد عليك ويظبط بياناتك.",
    fields: [{ name: "name", label: "اسمك بالكامل", required: true }, { name: "work", label: "جهة العمل", required: true }, { name: "mobile", label: "موبايلك الحالي", type: "tel", required: true },
      { name: "empId", label: "رقمك الوظيفي (لو فاكره)" }, { name: "issue", label: "المشكلة", type: "select", value: "login", options: [["login", "بكتب بياناتي ومش بيدخل"], ["forgotId", "نسيت رقمي الوظيفي"], ["mobile", "غيّرت رقم الموبايل"], ["other", "حاجة تانية"]] }],
    ok: "ابعت على واتساب", icon: "send" });
  if (!v) return;
  const iss = { login: "بكتب بياناتي ومش بيدخلني", forgotId: "نسيت رقمي الوظيفي", mobile: "غيّرت رقم الموبايل وعايز أحدّثه", other: "محتاج مساعدة في الدخول" }[v.issue];
  const txt = "طلب مساعدة — منصة حجز الكتب\nالاسم: " + v.name + "\nجهة العمل: " + v.work + "\nالموبايل: " + v.mobile + (v.empId ? "\nالرقم الوظيفي: " + v.empId : "") + "\nالمشكلة: " + iss;
  window.open(Brand.waLink(adminWa(), txt), "_blank");
});
/** بعد فشل الدخول: رسالة واضحة بدل سطر خطأ عابر */
function loginTrouble(msg) {
  const m = UI.open('<div class="text-center"><div class="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl">' + ic("circle-alert") + '</div>'
    + '<div class="font-bold text-lg mt-3">' + esc(msg || "البيانات غير مطابقة") + '</div>'
    + '<p class="text-[13.5px] text-slate-600 mt-2 leading-relaxed">اتأكد من الرقم الوظيفي وآخر 4 أرقام من الرقم القومي والموبايل المسجّل في النقابة.<br>لو متأكد إنها صح، ممكن تكون بياناتك في منظومة النقابة <b>غير مكتملة</b> — المسؤول يقدر يظبطها لك.</p></div>'
    + '<div class="grid gap-2 mt-5"><button class="btn btn-primary !h-12" data-close>' + ic("refresh-cw") + ' أحاول تاني</button>'
    + '<button class="btn btn-success !h-12" data-go="helpForm">' + ic("message-circle") + ' كلّم المسؤول على واتساب</button>'
    + '<button class="btn btn-ghost" data-go="faq">' + ic("info") + ' أسئلة شائعة</button></div>', { title: "مش قادر تدخل؟" });
  $$("[data-go]", m.root).forEach(b => b.addEventListener("click", () => { m.close(); setTimeout(() => ACTIONS[b.dataset.go](), 380); }));
}
Shell.loginEmployee = async function () {
  const id = $("#lgEmp").value.trim(), nat = $("#lgNat").value.trim(), mob = $("#lgMob").value.trim();
  if (!id || !nat || !mob) return toast("اكتب الرقم الوظيفي وآخر 4 أرقام من القومي والموبايل", "warning");
  const r = await call("LOGIN_EMPLOYEE", { empId: id, natIdLast4: nat, mobile: mob }, { block: true });
  if (!r.success) { if (/إيقاف|المحاولات/.test(r.message || "")) return toast(r.message, "danger"); return loginTrouble(r.message); }
  Shell.enter(r);
};
