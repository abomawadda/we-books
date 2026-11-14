/* ============================================================================
 * يوم الاستلام: رمز QR للموظف (يُمسح في شاشة يوم التسليم) + مسح بالكاميرا + تحديث حي
 * ========================================================================== */
"use strict";
const QR_PREFIX = "WB:";
let qrLibP = null;
/** مكتبة QR (qrcode-generator, MIT) تُحمَّل عند الحاجة فقط */
const qrLib = () => qrLibP || (qrLibP = new Promise((ok, no) => { if (window.qrcode) return ok(window.qrcode); const s = document.createElement("script"); s.src = "js/vendor/qrcode.js"; s.onload = () => ok(window.qrcode); s.onerror = () => { qrLibP = null; no(); }; document.head.appendChild(s); }));
async function qrSvg(text, cell) { const q = (await qrLib())(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: cell || 6, margin: 2, scalable: true }); }

// ---------------------------------------------------------------- عند الموظف
function pickupInfo() {
  const items = Emp.phaseItems(), inv = Emp.invoice(), ph = (APP.emp || {}).activePhase || {};
  const ready = items.reduce((s, i) => s + Math.max(0, n(i.Allocated_Qty) - n(i.Delivered_Qty)), 0);
  const down = inv ? Math.max(0, n(inv.Down_Payment_Required) - n(inv.Total_Paid_Amount)) : 0;
  const sc = parseSched(((APP.emp || {}).settings || {}).PICKUP_SCHEDULE), slot = slotFor(sc, ((APP.emp || {}).employee || {}).dept);
  return { ready, down, inv, ph, sc, slot, remaining: inv ? n(inv.Remaining_Balance) : 0 };
}
function pickupCard() {
  const p = pickupInfo(); if (!p.ready) return "";
    return `<section class="card overflow-hidden mb-4 ring-2 ring-emerald-200">
    <div class="p-4 sm:p-5 flex items-center gap-4">
      <button class="w-24 h-24 shrink-0 rounded-2xl bg-white ring-1 ring-slate-200 p-1.5 flex items-center justify-center" data-act="myQr" aria-label="كبّر رمز الاستلام"><span id="qrMini" class="block w-full h-full">${UI.skeleton(1)}</span></button>
      <div class="flex-1 min-w-0"><div class="text-[12px] font-bold text-emerald-700">📦 كتبك جاهزة — ${booksWord(p.ready)}</div>
        <div class="font-display font-bold text-[17px] text-slate-900 leading-snug mt-0.5">${p.down ? `هات معاك <span class="num text-rose-600">${fmt(p.down)}</span> ج.م (المقدم)` : "مفيش مقدم مطلوب — تعالى استلم على طول"}</div>
        <div class="text-[12.5px] text-slate-500 mt-1">${p.slot ? "" : p.ph.Delivery_Start_Date ? `التسليم من ${esc(day(p.ph.Delivery_Start_Date))}` : ""}</div></div>
    </div>
    ${p.slot || (p.sc && p.sc.place) ? `<div class="mx-4 mb-3 rounded-2xl bg-brand-50 text-brand-900 p-3 text-[13.5px] leading-relaxed">${p.slot ? `🗓️ <b>موعدك:</b> ${esc(slotTxt(p.slot))}<br>` : ""}${p.sc.place ? `📍 <b>المكان:</b> ${esc(p.sc.place)}<br>` : ""}${p.sc.note ? `💡 ${esc(p.sc.note)}` : ""}</div>` : ""}
    <div class="px-4 pb-4 grid grid-cols-2 gap-2"><button class="btn btn-success !h-11" data-act="myQr">${ic("scan-line")} رمز الاستلام</button><button class="btn btn-outline !h-11" data-act="qrDelegate">${ic("send")} حد هيستلم بدالي</button></div>
  </section>`;
}
async function fillMiniQr() { const el = $("#qrMini"); if (!el || !APP.user) return; try { el.innerHTML = await qrSvg(QR_PREFIX + APP.user.empId, 4); } catch (_) { el.innerHTML = ic("scan-line"); } }
on("myQr", async () => {
  const p = pickupInfo(), id = APP.user.empId;
  const m = UI.open(`<div class="text-center"><div id="qrBig" class="mx-auto w-64 h-64 max-w-full bg-white rounded-2xl p-2 ring-1 ring-slate-200">${UI.skeleton(1)}</div>
    <div class="mt-3 font-bold text-lg">${esc(APP.user.fullName || "")}</div><div class="num text-slate-500">${esc(id)}</div>
    <div class="grid grid-cols-2 gap-2 mt-4 text-right">${UI.stat("كتب جاهزة", fmt(p.ready))}${UI.stat("المطلوب الآن", p.down ? `<span class="text-rose-600">${fmt(p.down)} ج.م</span>` : "لا شيء")}</div>
    <p class="text-[12.5px] text-slate-500 mt-3 leading-relaxed">اعرض الرمز ده على الشباك يوم التسليم — بيفتح حجزك فوراً من غير ما تملي أي بيانات. ارفع إضاءة الشاشة لو المسح اتأخر.</p></div>`, { title: "رمز الاستلام" });
  try { const el = m.root.querySelector("#qrBig"); el.innerHTML = await qrSvg(QR_PREFIX + id, 8); } catch (_) { toast("تعذر إنشاء الرمز — قول رقمك الوظيفي على الشباك", "warning"); }
});
/** تفويض: رسالة جاهزة تُرسل لمن يستلم بدلاً من الموظف (التحقق النهائي باسم المستلم على الشباك) */
on("qrDelegate", async () => {
  const v = await UI.form({ title: "حد هيستلم بدالك؟", intro: "اكتب اسم اللي هيستلم وهنجهّز لك رسالة تبعتها له على واتساب فيها رقمك ورمز الاستلام. على الشباك هيتسجّل اسمه كمستلم.",
    fields: [{ name: "who", label: "اسم المستلم", required: true, placeholder: "مثال: أحمد محمد (أخويا)" }], ok: "جهّز الرسالة", icon: "send" });
  if (!v) return;
  const p = pickupInfo(), e = { Full_Name: APP.user.fullName };
  const txt = `السلام عليكم يا ${v.who} 👋\nأنا ${e.Full_Name || ""} — فوّضتك تستلم كتب أولادي من مبادرة الكتب بالنقابة.\nالرقم الوظيفي: ${APP.user.empId}\nعدد الكتب: ${p.ready}${p.slot ? `\nالموعد: ${slotTxt(p.slot)}` : ""}${p.sc && p.sc.place ? `\nالمكان: ${p.sc.place}` : ""}${p.down ? `\nالمطلوب دفعه: ${p.down} ج.م` : ""}\nقول رقمي الوظيفي واسمك على الشباك.`;
  window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank");
});
if (Router.routes["/e/orders"]) {
  const base = Router.routes["/e/orders"];
  Router.add("/e/orders", view => { base(view); const c = pickupCard(); if (!c) return; const h = view.firstElementChild; if (h) h.insertAdjacentHTML("afterend", c); else view.insertAdjacentHTML("afterbegin", c); fillMiniQr(); });
}

// ---------------------------------------------------------------- مواعيد الاستلام (حسب جهة العمل)
/** الصيغة المحفوظة في إعداد PICKUP_SCHEDULE: { place, note, slots:[{date, from, to}], depts:{ "جهة": رقم الموعد } } */
const parseSched = v => { try { const o = JSON.parse(v || ""); return o && Array.isArray(o.slots) ? Object.assign({ place: "", note: "", depts: {} }, o) : null; } catch (_) { return null; } };
const slotTxt = s => { const d = s.date ? new Date(s.date + "T12:00:00") : null; return `${d && !isNaN(d) ? d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" }) : ""}${s.from ? ` من ${s.from}` : ""}${s.to ? ` لـ ${s.to}` : ""}`; };
/** موعد الموظف: موعد جهة عمله، وإلا الموعد المفتوح للجميع (بلا جهات) */
function slotFor(sc, dept) {
  if (!sc || !sc.slots.length) return null;
  const k = sc.depts[dept || "غير محدد"];
  if (k !== undefined && sc.slots[k]) return sc.slots[k];
  const used = new Set(Object.values(sc.depts).map(Number));
  const free = sc.slots.findIndex((_, i) => !used.has(i));
  return free >= 0 ? sc.slots[free] : null;
}
