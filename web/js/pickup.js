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
  return { ready, down, inv, ph, remaining: inv ? n(inv.Remaining_Balance) : 0 };
}
function pickupCard() {
  const p = pickupInfo(); if (!p.ready) return "";
  const b = Brand.get();
  return `<section class="card overflow-hidden mb-4 ring-2 ring-emerald-200">
    <div class="p-4 sm:p-5 flex items-center gap-4">
      <button class="w-24 h-24 shrink-0 rounded-2xl bg-white ring-1 ring-slate-200 p-1.5 flex items-center justify-center" data-act="myQr" aria-label="كبّر رمز الاستلام"><span id="qrMini" class="block w-full h-full">${UI.skeleton(1)}</span></button>
      <div class="flex-1 min-w-0"><div class="text-[12px] font-bold text-emerald-700">📦 كتبك جاهزة — ${booksWord(p.ready)}</div>
        <div class="font-display font-bold text-[17px] text-slate-900 leading-snug mt-0.5">${p.down ? `هات معاك <span class="num text-rose-600">${fmt(p.down)}</span> ج.م (المقدم)` : "مفيش مقدم مطلوب — تعالى استلم على طول"}</div>
        <div class="text-[12.5px] text-slate-500 mt-1">${p.ph.Delivery_Start_Date ? `التسليم من ${esc(day(p.ph.Delivery_Start_Date))}` : ""}${b.address ? ` · ${esc(b.address)}` : ""}</div></div>
    </div>
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
  const txt = `السلام عليكم يا ${v.who} 👋\nأنا ${e.Full_Name || ""} — فوّضتك تستلم كتب أولادي من مبادرة الكتب بالنقابة.\nالرقم الوظيفي: ${APP.user.empId}\nعدد الكتب: ${p.ready}${p.down ? `\nالمطلوب دفعه: ${p.down} ج.م` : ""}\nقول رقمي الوظيفي واسمك على الشباك.`;
  window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank");
});
if (Router.routes["/e/orders"]) {
  const base = Router.routes["/e/orders"];
  Router.add("/e/orders", view => { base(view); const c = pickupCard(); if (!c) return; const h = view.firstElementChild; if (h) h.insertAdjacentHTML("afterend", c); else view.insertAdjacentHTML("afterbegin", c); fillMiniQr(); });
}

// ---------------------------------------------------------------- في شاشة يوم التسليم
let ddTimer = null;
function ddLive() {
  const { e } = maps(), docs = A().deliveryReturns.filter(x => x.Doc_Type === "EMP_DELIVERY" && x.Phase_ID === APP.phaseId);
  const seen = new Set(), last = [];
  for (let i = docs.length - 1; i >= 0 && last.length < 6; i--) { const x = docs[i]; if (seen.has(x.Printed_Receipt_No)) continue; seen.add(x.Printed_Receipt_No); last.push(x); }
  const items = phaseItems().filter(i => n(i.Allocated_Qty) > 0), ids = [...new Set(items.map(i => i.Emp_ID))];
  let ready = 0, needDown = 0; ids.forEach(id => { const s = ddState(id); if (s.rem > 0) { if (s.ok) ready++; else needDown++; } });
  return `<div class="max-w-2xl mx-auto mt-4 grid gap-3">
    <div class="grid grid-cols-2 gap-3">${UI.stat("جاهزون للتسليم الآن", `<span class="text-emerald-600">${fmt(ready)}</span>`)}${UI.stat("ينتظرون سداد المقدم", `<span class="text-amber-600">${fmt(needDown)}</span>`)}</div>
    ${UI.section(`${ic("activity", "text-brand-600")} آخر من استلم`, `يتحدث تلقائياً كل دقيقة · ${esc(new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }))}`,
      last.length ? `<ul class="divide-y divide-slate-100">${last.map(x => `<li class="flex items-center gap-3 py-2">${UI.avatar(empName(e, x.Party_ID), "w-8 h-8 text-xs")}<div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px] truncate">${esc(empName(e, x.Party_ID))}</div><div class="text-[11.5px] text-slate-400 num">${esc(x.Printed_Receipt_No)} · ${esc(dt(x.Trans_Date))}${x.Received_By ? " · " + esc(x.Received_By) : ""}</div></div></li>`).join("")}</ul>` : UI.empty("package-check", "لم يُسلَّم أحد بعد"))}</div>`;
}
if (Router.routes["/a/dday"]) {
  const base = Router.routes["/a/dday"];
  Router.add("/a/dday", view => {
    base(view); if (!APP.phaseId) return;
    const head = view.querySelector("h1"); if (head && head.parentElement && head.parentElement.parentElement) head.parentElement.parentElement.insertAdjacentHTML("beforeend", `<button class="btn btn-primary btn-sm" data-act="ddScan">${ic("scan-line")} امسح رمز الموظف</button>`);
    view.insertAdjacentHTML("beforeend", `<div id="ddLive">${ddLive()}</div>`);
    clearInterval(ddTimer);
    ddTimer = setInterval(async () => {
      if (Router.current !== "/a/dday") return clearInterval(ddTimer);
      if (document.hidden || Q.ddId || (Q.ddq || "").trim() || document.querySelector("[role=dialog]")) return;
      await Admin.load();
    }, 60000);
  });
}
on("ddScan", async () => {
  if (!("BarcodeDetector" in window) || !navigator.mediaDevices) return toast("المتصفح ده مش بيدعم المسح — اكتب رقم الموظف (أو استخدم Chrome على الموبايل)", "warning");
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); } catch (_) { return toast("لازم تسمح باستخدام الكاميرا", "danger"); }
  const m = UI.open(`<video id="scanV" playsinline muted class="w-full rounded-2xl bg-black aspect-square object-cover"></video><p class="text-center text-sm text-slate-500 mt-3">وجّه الكاميرا على رمز الموظف</p>`, { title: "مسح رمز الاستلام" });
  const v = m.root.querySelector("#scanV"); v.srcObject = stream; await v.play().catch(() => {});
  const det = new BarcodeDetector({ formats: ["qr_code"] }); let live = true;
  const stop = () => { live = false; stream.getTracks().forEach(t => t.stop()); };
  const obs = new MutationObserver(() => { if (!document.body.contains(v)) { stop(); obs.disconnect(); } }); obs.observe(document.body, { childList: true, subtree: true });
  while (live) {
    try { const r = await det.detect(v); const raw = r[0] && r[0].rawValue;
      if (raw && raw.startsWith(QR_PREFIX)) { const id = raw.slice(QR_PREFIX.length).trim(); stop(); if (navigator.vibrate) navigator.vibrate(60); m.close(); Q.ddId = id; Q.ddq = id; Shell.rerender(); return; } } catch (_) {}
    await new Promise(r => setTimeout(r, 250));
  }
});
