/* ============================================================================
 * يوم التسليم ومواعيد الاستلام — جزء الإدارة (يُحمَّل مع حزمة الإدارة فقط)
 * ========================================================================== */
"use strict";
// ---------------------------------------------------------------- في شاشة يوم التسليم
let ddTimer = null;
function ddLive() {
  const { e } = maps(), docs = A().deliveryReturns.filter(x => x.Doc_Type === "EMP_DELIVERY" && x.Phase_ID === APP.phaseId);
  const seen = new Set(), last = [];
  for (let i = docs.length - 1; i >= 0 && last.length < 6; i--) { const x = docs[i]; if (seen.has(x.Printed_Receipt_No)) continue; seen.add(x.Printed_Receipt_No); last.push(x); }
  const items = phaseItems().filter(i => n(i.Allocated_Qty) > 0), ids = [...new Set(items.map(i => i.Emp_ID))];
  const sc = parseSched((A().settingsMap || {}).PICKUP_SCHEDULE) || { slots: [], depts: {}, bookings: {}, packed: {} };
  let ready = 0, needDown = 0, packedCnt = 0;
  const queue = [];
  ids.forEach(id => {
    const s = ddState(id);
    if (s.rem > 0) {
      if (s.ok) ready++; else needDown++;
      const isPacked = !!(sc.packed && sc.packed[id]);
      if (isPacked) packedCnt++;
      const bIdx = sc.bookings && sc.bookings[id] !== undefined ? Number(sc.bookings[id]) : -1;
      const emp = e[id] || {};
      const sl = bIdx >= 0 && sc.slots[bIdx] ? sc.slots[bIdx] : slotFor(sc, emp.Department, id);
      const slKey = bIdx >= 0 ? bIdx : (sl ? sc.slots.indexOf(sl) : 999);
      queue.push({ id, s, emp, isPacked, bIdx, sl, slKey });
    }
  });
  queue.sort((a, b) => (a.isPacked ? 1 : 0) - (b.isPacked ? 1 : 0) || a.slKey - b.slKey || (a.s.ok ? 0 : 1) - (b.s.ok ? 0 : 1));
  const canPack = can("TOGGLE_PARCEL_PACKED");
  const queueHTML = queue.length ? `<ul class="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">${queue.slice(0, 40).map(q => `<li class="flex items-center gap-2.5 py-2.5">
    <button type="button" class="flex-1 min-w-0 flex items-center gap-2.5 text-right" data-act="ddPick" data-id="${esc(q.id)}">
      ${UI.avatar(empName(e, q.id), "w-9 h-9 text-xs shrink-0")}
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-[13.5px] text-slate-900 truncate">${esc(empName(e, q.id))} ${q.isPacked ? `<span class="pill pill-green !text-[10px]">مجهّز ✓</span>` : ""}</div>
        <div class="text-[11.5px] text-slate-500 num truncate">${esc(q.id)} · ${fmt(q.s.rem)} نسخة${q.sl ? ` · 🗓️ ${esc(slotTxt(q.sl))}` : ""}${q.bIdx >= 0 ? " (حجز موعده)" : ""}</div>
      </div>
    </button>
    <div class="flex items-center gap-1 shrink-0">
      ${q.s.ok ? pill("", "جاهز", "green") : pill("", "صافي " + fmt(q.s.dueDown), "red")}
      ${canPack ? `<button type="button" class="btn ${q.isPacked ? "btn-success" : "btn-outline"} btn-xs" data-act="packToggle" data-id="${esc(q.id)}" title="${q.isPacked ? "إلغاء التجهيز" : "تجهيز الطرد مسبقاً"}">${ic(q.isPacked ? "check-check" : "package")} ${q.isPacked ? "جاهز" : "جهّز"}</button>` : ""}
    </div>
  </li>`).join("")}</ul>` : UI.empty("package-check", "لا توجد طرود منتظرة للتسليم");

  return `<div class="max-w-2xl mx-auto mt-4 grid gap-3">
    <div class="grid grid-cols-3 gap-2 sm:gap-3">${UI.stat("جاهزون للتسليم", `<span class="text-emerald-600">${fmt(ready)}</span>`)}${UI.stat("طرود مجهّزة", `<span class="text-brand-700">${fmt(packedCnt)}</span>`)}${UI.stat("بانتظار السداد", `<span class="text-amber-600">${fmt(needDown)}</span>`)}</div>
    ${UI.section(`${ic("package-check", "text-brand-600")} طابور التجهيز المسبق (Pre-Packing Queue)`, `${fmt(queue.length)} موظف منتظر · مرتّب حسب موعد الحضور`, queueHTML)}
    ${UI.section(`${ic("activity", "text-brand-600")} آخر من استلم`, `يتحدث تلقائياً كل دقيقة · ${esc(new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }))}`,
      last.length ? `<ul class="divide-y divide-slate-100">${last.map(x => `<li class="flex items-center gap-3 py-2">${UI.avatar(empName(e, x.Party_ID), "w-8 h-8 text-xs")}<div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px] truncate">${esc(empName(e, x.Party_ID))}</div><div class="text-[11.5px] text-slate-400 num">${esc(x.Printed_Receipt_No)} · ${esc(dt(x.Trans_Date))}${x.Received_By ? " · " + esc(x.Received_By) : ""}</div></div></li>`).join("")}</ul>` : UI.empty("package-check", "لم يُسلَّم أحد بعد"))}</div>`;
}
on("packToggle", async empId => {
  const r = await call("TOGGLE_PARCEL_PACKED", { empId }, { block: true });
  toast(r.message, r.success ? "success" : "danger");
  if (r.success) await Admin.load();
});
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

const SL = { sc: null };
function slDepts() {
  const { e } = maps(), cnt = {};
  [...new Set(phaseItems().map(i => i.Emp_ID))].forEach(id => { const k = (e[id] || {}).Department || "غير محدد"; cnt[k] = (cnt[k] || 0) + 1; });
  return cnt;
}
function slBody() {
  const sc = SL.sc, cnt = slDepts(), depts = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  const bookings = sc.bookings || {};
  const load = sc.slots.map((_, i) => depts.filter(d => Number(sc.depts[d]) === i).reduce((s, d) => s + cnt[d], 0));
  const selfLoad = sc.slots.map((_, i) => Object.keys(bookings).filter(k => Number(bookings[k]) === i).length);
  return `<div class="grid gap-4 lg:grid-cols-2 items-start">
    ${UI.section(`${ic("calendar-clock", "text-brand-600")} أيام وساعات الاستلام`, "أضف موعداً لكل يوم أو فترة وحدد السعة القصوى (اختياري) ليتمكن الموظفون من حجز موعدهم", `
      <div class="grid gap-2">${sc.slots.map((s, i) => `<div class="rounded-2xl ring-1 ring-slate-200 p-3"><div class="flex items-center justify-between mb-2"><b class="text-[13.5px]">الموعد ${i + 1}</b><span class="text-[12px] text-slate-500"><b class="num text-brand-800">${fmt(load[i])}</b> جهة${selfLoad[i] ? ` · <b class="num text-emerald-700">${fmt(selfLoad[i])} حجز شخصي</b>` : ""}</span></div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2"><input type="date" class="input input-sm" value="${esc(s.date || "")}" data-change="slSet" data-id="${i}|date"><input type="time" class="input input-sm" value="${esc(s.from || "")}" data-change="slSet" data-id="${i}|from"><input type="time" class="input input-sm" value="${esc(s.to || "")}" data-change="slSet" data-id="${i}|to"><input type="number" min="0" class="input input-sm num" value="${esc(s.cap || "")}" placeholder="السعة (مفتوح)" title="الحد الأقصى للموظفين (0 = مفتوح)" data-change="slSet" data-id="${i}|cap"></div>
        <button class="btn btn-ghost btn-xs !text-rose-600 mt-2" data-act="slDel" data-id="${i}">${ic("trash-2")} حذف</button></div>`).join("")}
      <button class="btn btn-outline btn-sm" data-act="slAdd">${ic("plus")} موعد جديد</button></div>
      <label class="label mt-4">مكان الاستلام</label><input class="input" value="${esc(sc.place)}" data-change="slMeta" data-id="place" placeholder="مثال: مقر النقابة — الدور الأول">
      <label class="label mt-3">ملاحظة للموظفين</label><input class="input" value="${esc(sc.note)}" data-change="slMeta" data-id="note" placeholder="مثال: هات البطاقة أو رمز الاستلام">`)}
    ${UI.section(`${ic("building-2", "text-brand-600")} جهات العمل ومواعيدها`, "عدد الحاجزين من كل جهة · الجهة بلا موعد تأخذ أول موعد غير مخصص لجهة", depts.length ? `<ul class="divide-y divide-slate-100">${depts.map(d => `<li class="flex items-center gap-3 py-2"><div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px] truncate">${esc(d)}</div><div class="text-[11.5px] text-slate-400"><span class="num">${fmt(cnt[d])}</span> موظف</div></div>
      <div class="w-36 shrink-0"><select class="input input-sm" data-change="slDept" data-id="${esc(d)}"><option value="">— موعد عام —</option>${sc.slots.map((s, i) => `<option value="${i}" ${String(sc.depts[d]) === String(i) ? "selected" : ""}>الموعد ${i + 1}${s.date ? " · " + esc(s.date.slice(5)) : ""}</option>`).join("")}</select></div></li>`).join("")}</ul>` : UI.empty("users", "لا حجوزات في المرحلة بعد"))}
  </div>`;
}
Router.add("/a/slots", view => {
  if (!APP.phaseId) { view.innerHTML = UI.empty("calendar-clock", "لا توجد مرحلة"); return; }
  if (!SL.sc) SL.sc = parseSched((A().settingsMap || {}).PICKUP_SCHEDULE) || { place: "", note: "", slots: [], depts: {}, bookings: {}, packed: {} };
  view.innerHTML = UI.pageHead("مواعيد الاستلام", "وزّع جهات العمل أو حدّد سعة كل فترة ليحجز كل موظف موعده — وتابع التجهيز في «يوم التسليم»",
    `<button class="btn btn-outline btn-sm" data-act="slAuto">${ic("wand-sparkles")} توزيع تلقائي</button>${can("SAVE_SETTING") ? `<button class="btn btn-primary btn-sm" data-act="slSave">${ic("check")} حفظ ونشر</button>` : ""}`)
    + `<div id="slBody">${slBody()}</div>`;
});
const slRe = () => rerenderList("slBody", slBody);
on("slAdd", () => { const l = SL.sc.slots[SL.sc.slots.length - 1]; SL.sc.slots.push({ date: l && l.date ? addDays(l.date, 1) : (dayKey(phaseObj().Delivery_Start_Date) || todayKey()), from: (l && l.from) || "09:00", to: (l && l.to) || "14:00", cap: (l && l.cap) || 0 }); slRe(); });
on("slDel", i => { i = Number(i); SL.sc.slots.splice(i, 1); Object.keys(SL.sc.depts).forEach(d => { const v = Number(SL.sc.depts[d]); if (v === i) delete SL.sc.depts[d]; else if (v > i) SL.sc.depts[d] = v - 1; }); slRe(); });
on("slSet", (v, el) => { const [i, k] = el.dataset.id.split("|"); SL.sc.slots[Number(i)][k] = k === "cap" ? (parseInt(v, 10) || 0) : v; });
on("slMeta", (v, el) => { SL.sc[el.dataset.id] = v; });
on("slDept", (v, el) => { if (v === "") delete SL.sc.depts[el.dataset.id]; else SL.sc.depts[el.dataset.id] = Number(v); slRe(); });
on("slAuto", async () => {
  const f = await UI.form({ title: "توزيع تلقائي", intro: "يوزّع جهات العمل على الأيام بحيث يتقارب عدد الموظفين في كل يوم (الجهة الواحدة تبقى في يوم واحد).",
    fields: [{ name: "start", label: "أول يوم", type: "date", value: dayKey(phaseObj().Delivery_Start_Date) || todayKey() }, { name: "days", label: "عدد الأيام", type: "number", value: 3, min: 1 },
      { name: "from", label: "من الساعة", type: "time", value: "09:00" }, { name: "to", label: "إلى الساعة", type: "time", value: "14:00" }], ok: "وزّع" });
  if (!f) return;
  const nd = Math.max(1, Math.min(30, n(f.days))), cnt = slDepts(), load = Array(nd).fill(0), depts = {};
  SL.sc.slots = Array.from({ length: nd }, (_, i) => ({ date: addDays(f.start, i), from: f.from, to: f.to, cap: 0 }));
  Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).forEach(d => { const k = load.indexOf(Math.min(...load)); depts[d] = k; load[k] += cnt[d]; });
  SL.sc.depts = depts; slRe(); toast("راجع التوزيع ثم اضغط «حفظ ونشر»", "success");
});
on("slSave", async () => {
  if (SL.sc.slots.some(s => !s.date)) return toast("حدّد تاريخ كل موعد", "warning");
  const r = await call("SAVE_SETTING", { key: "PICKUP_SCHEDULE", value: JSON.stringify(SL.sc) }, { block: true });
  toast(r.success ? "اتنشرت المواعيد — كل موظف هيشوف موعده ويقدر يحجز فترته" : r.message, r.success ? "success" : "danger");
  if (r.success) { SL.sc = null; await Admin.load(); }
});
