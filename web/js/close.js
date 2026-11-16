/* ============================================================================
 * إقرار نهاية الحملة: قائمة الإغلاق، أرشيف كامل للتنزيل، التقرير الختامي، الإغلاق النهائي
 * (ضمن حزمة الإدارة؛ لا يغيّر شيئاً في الخادم إلا زر الإغلاق = SET_PHASE_STATUS Completed)
 * ========================================================================== */
"use strict";
const CL = { st: null };
async function loadCloseState() {
  const r = await call("GET_SETTLEMENT_REPORT");
  CL.st = r.success ? r : { error: r.message || "تعذر التحميل" };
  APP.settlement = r.success ? r : APP.settlement;
  rerenderList("clBody", closeBody);
}
function closeBody() {
  if (!CL.st) { setTimeout(loadCloseState, 0); return UI.skeleton(4); }
  if (CL.st.error) return UI.empty("circle-alert", CL.st.error);
  const ph = phaseObj(), items = phaseItems(), st = ph.Effective_Status || ph.Phase_Status;
  const pend = items.reduce((s, i) => s + Math.max(0, n(i.Allocated_Qty) - n(i.Delivered_Qty)), 0);
  const list = [{ item: "كل الكتب المخصصة في هذه المرحلة سُلِّمت", ok: pend === 0, value: fmt(pend) + " نسخة", must: true }].concat(CL.st.checklist || []);
  const okAll = list.every(c => c.ok), P = CL.st.pnl || {};
  const step = (k, t, body) => `<section class="card mb-4"><div class="px-4 sm:px-5 pt-4 pb-2 flex items-center gap-3"><span class="w-8 h-8 rounded-full bg-brand-700 text-white font-bold flex items-center justify-center num">${k}</span><h2 class="card-title">${t}</h2></div><div class="px-4 sm:px-5 pb-4">${body}</div></section>`;
  return (st === "Completed" ? `<div class="mb-4 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800 p-4 font-semibold flex items-center gap-2">${ic("circle-check")} «${esc(ph.Phase_Name)}» مغلقة نهائياً — الحجوزات لا تقبل أي تعديل.</div>` : "")
    + step(1, "راجع قائمة الإغلاق", `<ul class="space-y-2">${list.map(c => `<li class="flex items-center gap-3 rounded-xl px-3 py-2.5 ${c.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}">${ic(c.ok ? "circle-check" : "circle-x")}<span class="flex-1 font-semibold text-[13.5px]">${esc(c.item)}</span><span class="text-[12px] num">${esc(String(c.value || ""))}</span></li>`).join("")}</ul>
      <p class="text-[12.5px] text-slate-500 mt-3">${okAll ? "كل البنود سليمة ✅" : "البنود الحمراء غير مانعة إلا التسليم، لكن الأفضل تسويتها قبل الإغلاق (التصفية تشمل كل المراحل)."}</p>`)
    + step(2, "احفظ أرشيف الحملة", `<p class="text-[13px] text-slate-600 mb-3">ملف كامل بكل بيانات المرحلة (حجوزات، فواتير، إيصالات، تسليمات، مخزون، مصروفات) يُحفظ على جهازك — بجانب النسخة الاحتياطية الليلية على الخادم.</p>
      <div class="flex flex-wrap gap-2"><button class="btn btn-primary btn-sm" data-act="clArchive">${ic("download")} أرشيف كامل (JSON)</button><button class="btn btn-outline btn-sm" data-act="clCsv">${ic("file-spreadsheet")} الفواتير والمدفوعات (Excel)</button></div>`)
    + step(3, "اطبع التقرير الختامي", `<div class="grid grid-cols-2 gap-2 mb-3">${UI.stat(n(P.surplus) >= 0 ? "الفائض" : "العجز", money(P.surplus))}${UI.stat("وفّرها الموظفون", money(P.employeeSavings))}</div>
      <div class="flex flex-wrap gap-2"><button class="btn btn-outline btn-sm" data-act="clRep" data-id="R00">${ic("printer")} تقرير المجلس</button><button class="btn btn-outline btn-sm" data-act="clRep" data-id="R14">${ic("printer")} التصفية المالية والمخزنية</button></div>`)
    + step(4, "أغلق المرحلة نهائياً", st === "Completed" ? `<div class="text-sm text-slate-500">تم.</div>` : `<p class="text-[13px] text-slate-600 mb-3">بعد الإغلاق: لا تعديل على الحجوزات في هذه المرحلة، وتظهر «مكتملة» للجميع. التحصيل والأقساط تستمر عادي.</p>
      ${can("SET_PHASE_STATUS") ? `<button class="btn ${pend ? "btn-outline" : "btn-gold"} w-full sm:w-auto" data-act="clClose" ${pend ? "disabled" : ""}>${ic("lock")} إغلاق «${esc(ph.Phase_Name)}» نهائياً</button>${pend ? `<div class="text-[12px] text-rose-600 mt-2">سلّم الـ ${fmt(pend)} نسخة المتبقية أو ألغِ تخصيصها أولاً.</div>` : ""}` : `<div class="text-sm text-slate-500">الإغلاق لمدير المنظومة.</div>`}`);
}
Router.add("/a/close", view => {
  if (!APP.phaseId) { view.innerHTML = UI.empty("calendar-range", "لا توجد مرحلة"); return; }
  view.innerHTML = UI.pageHead("إقرار نهاية الحملة", esc(phaseObj().Phase_Name || "") + " — أربع خطوات لإغلاق الموسم بأمان", `<button class="btn btn-ghost btn-sm" data-act="clReload">${ic("refresh-cw")} تحديث</button>`)
    + `<div id="clBody" class="max-w-3xl">${closeBody()}</div>`;
});
on("clReload", () => { CL.st = null; rerenderList("clBody", closeBody); });
const download = (name, text, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
on("clArchive", () => {
  const d = A(), id = APP.phaseId, inPh = x => String(x.Phase_ID || "") === id, invIds = new Set(d.empInvoices.filter(inPh).map(i => i.Emp_Inv_ID));
  const arc = { generatedAt: new Date().toISOString(), phase: phaseObj(), books: d.books, suppliers: d.suppliers,
    reservations: d.resHeaders.filter(inPh), reservationItems: d.resItems.filter(inPh), poSnapshots: d.poSnapshots.filter(inPh), supplierInvoices: d.supInvHeaders.filter(inPh), supplierInvoiceItems: (d.supInvItems || []),
    employeeInvoices: d.empInvoices.filter(inPh), installments: d.installments.filter(i => invIds.has(i.Emp_Inv_ID)), payments: d.empPayments.filter(p => invIds.has(p.Emp_Inv_ID)),
    deliveriesReturns: d.deliveryReturns.filter(inPh), expenses: d.expenses.filter(inPh), supplierLedger: d.supLedger.filter(inPh), settlement: CL.st && !CL.st.error ? CL.st : null,
    employees: d.employees.filter(e => d.resHeaders.some(h => inPh(h) && h.Emp_ID === e.Emp_ID)).map(e => ({ Emp_ID: e.Emp_ID, Full_Name: e.Full_Name, Department: e.Department })) };
  download(`أرشيف-${phaseObj().Phase_Name || id}-${todayKey()}.json`, JSON.stringify(arc, null, 1), "application/json");
  toast("اتحفظ الأرشيف على جهازك", "success");
});
on("clCsv", () => {
  const { e } = maps(), invs = A().empInvoices.filter(i => i.Phase_ID === APP.phaseId);
  exportCSV("فواتير " + (phaseObj().Phase_Name || ""), ["الفاتورة", "الرقم الوظيفي", "الموظف", "الصافي", "المسدد", "المتبقي", "الحالة"], invs.map(i => [i.Emp_Inv_ID, i.Emp_ID, empName(e, i.Emp_ID), i.Net_Final_Invoice_Amount, i.Total_Paid_Amount, i.Remaining_Balance, ar(i.Invoice_Status)]));
});
on("clRep", id => { Rep.sel = id; Router.go("/a/reports"); });
on("clClose", async () => {
  const ph = phaseObj();
  const v = await UI.form({ title: "إغلاق المرحلة نهائياً", sub: ph.Phase_Name, danger: true, intro: "بعد الإغلاق لا يمكن تعديل الحجوزات في هذه المرحلة. اكتب كلمة «إغلاق» للتأكيد.", fields: [{ name: "c", label: "التأكيد", required: true, placeholder: "إغلاق" }], ok: "إغلاق نهائي", icon: "lock" });
  if (!v) return;
  if (String(v.c).trim() !== "إغلاق") return toast("اكتب كلمة «إغلاق» بالظبط للتأكيد", "warning");
  const r = await call("SET_PHASE_STATUS", { phaseId: APP.phaseId, status: "Completed" }, { block: true });
  toast(r.success ? "اتقفلت المرحلة نهائياً ✅" : r.message, r.success ? "success" : "danger");
  if (r.success) { CL.st = null; await Admin.load(); }
});

// ---------------------------------------------------------------- قرار المدير في الكتب المنتظرة لموظف (ترحيل / إنهاء على المتاح)
const _epBodyBase = epBody;
epBody = function (id) {
  const html = _epBodyBase(id);
  if (!APP.phaseId || !can("WAITLIST_DECISION")) return html;
  const ph = phaseObj(); if ((ph.Effective_Status || ph.Phase_Status) === "Open") return html;
  const { b } = maps(), w = phaseItems().filter(i => i.Emp_ID === id && n(i.Requested_Qty) > Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)));
  if (!w.length) return html;
  const ch = w.every(i => i.Waitlist_Choice === "carry") ? "وافق على الترحيل" : w.some(i => i.Waitlist_Choice) ? "قرار جزئي" : "لم يختر بعد";
  return `<div class="mb-3 rounded-2xl bg-sky-50 ring-1 ring-sky-200 p-3 text-[13px]"><div class="flex items-center justify-between gap-2"><b class="text-sky-900">⏳ ${fmt(w.length)} كتاب لم يصل — ${esc(ch)}</b></div>
    <div class="text-[12px] text-slate-600 mt-1">${w.map(i => esc(bookName(b, i.Book_ID)) + (i.Beneficiary ? " (" + esc(i.Beneficiary) + ")" : "")).join("، ")}</div>
    <div class="flex flex-wrap gap-2 mt-2"><button class="btn btn-primary btn-xs" data-act="admWait" data-id="${esc(id)}|carry">${ic("arrow-left-right")} ترحيل للمرحلة التالية</button><button class="btn btn-outline btn-xs !text-rose-600" data-act="admWait" data-id="${esc(id)}|cancel">${ic("x")} إنهاء الحجز على المتاح</button></div></div>` + html;
};
on("admWait", async v => {
  const [empId, choice] = v.split("|");
  if (choice === "cancel" && !await UI.confirm({ title: "إنهاء الحجز على المتاح", message: "ستُلغى الكتب التي لم تصل من حجز هذا الموظف ولن تُرحَّل.", ok: "إنهاء", tone: "danger" })) return;
  await act("WAITLIST_DECISION", { empId, choice, phaseId: APP.phaseId });
});

// ---------------------------------------------------------------- طلبات إلغاء الموظفين بعد طلب التوريد
const cancelReqs = () => A().resHeaders.filter(h => { try { const c = JSON.parse(h.Cancel_Request || "null"); return c && c.status === "Pending"; } catch (_) { return false; } });
function cancelReqBox() {
  const list = cancelReqs(); if (!list.length) return "";
  const { e } = maps();
  return `<div class="mt-4 sm:mt-6">${UI.section(`${ic("x", "text-rose-500")} طلبات إلغاء من الموظفين (${fmt(list.length)})`, "بعد طلب التوريد — الاعتماد يلغي غير المُسلَّم فقط ويعيد حساب الفاتورة", `<ul class="divide-y divide-slate-100">${list.map(h => { const c = JSON.parse(h.Cancel_Request); return `<li class="flex flex-wrap items-center gap-2 py-2.5"><div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px]">${empLink(h.Emp_ID, empName(e, h.Emp_ID))} <span class="text-[11px] text-slate-400 num">${esc(h.Phase_ID)}</span></div><div class="text-[12px] text-slate-500">${esc(c.reason)} · <span class="num">${esc(String(c.at).slice(0, 16))}</span></div></div>
      <button class="btn btn-primary btn-xs" data-act="cancelRes" data-id="${esc(h.Emp_ID)}|${esc(h.Phase_ID)}|1">${ic("check")} اعتماد</button><button class="btn btn-outline btn-xs" data-act="cancelRes" data-id="${esc(h.Emp_ID)}|${esc(h.Phase_ID)}|0">رفض</button></li>`; }).join("")}</ul>`)}</div>`;
}
on("cancelRes", async v => {
  const [empId, phaseId, ap] = v.split("|");
  const f = await UI.form({ title: ap === "1" ? "اعتماد الإلغاء" : "رفض الإلغاء", intro: ap === "1" ? "يُلغى غير المُسلَّم من طلب الموظف، وتتحرر نسخه المخصصة للمنتظرين، ويُعاد حساب فاتورته. المُسلَّم يُعالج كمرتجع من صفحة التسليم." : "يبقى طلب الموظف كما هو.", fields: [{ name: "note", label: "ملاحظة للموظف (اختياري)" }], ok: ap === "1" ? "اعتماد" : "رفض", danger: ap === "1" });
  if (!f) return;
  await act("RESOLVE_CANCEL_REQUEST", { empId, phaseId, approve: ap === "1", note: f.note });
});

// ---------------------------------------------------------------- طلبات المرتجع + جرس الإدارة (إلغاء ومرتجع)
const retReqs = () => A().resItems.filter(i => { try { const r = JSON.parse(i.Return_Request || "null"); return r && r.status === "Pending"; } catch (_) { return false; } });
function retReqBox() {
  const list = retReqs(); if (!list.length) return ""; const lateN = list.filter(i => { try { return (Date.now() - new Date(String(JSON.parse(i.Return_Request).at).replace(" ", "T"))) / 864e5 > 2; } catch (_) { return false; } }).length;
  const { e, b } = maps();
  return `<div class="mt-4 sm:mt-6">${UI.section(`${ic("undo-2", "text-amber-500")} طلبات مرتجع/استبدال (${fmt(list.length)})${lateN ? ` <span class="text-rose-600 text-[12px]">⚠️ ${lateN} متأخر أكتر من يومين</span>` : ""} <a href="#/a/returns" class="text-[12px] text-brand-700 font-semibold">الكل</a>`, "الاعتماد يُدخل الكتاب المخزن ويخصم قيمته من فاتورة الموظف (الزيادة المدفوعة رصيد مستحق الرد)", `<ul class="divide-y divide-slate-100">${list.map(i => { const r = JSON.parse(i.Return_Request); return `<li class="flex flex-wrap items-center gap-2 py-2.5"><div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px]">${empLink(i.Emp_ID, empName(e, i.Emp_ID))} · ${esc(bookName(b, i.Book_ID))}</div><div class="text-[12px] text-slate-500"><b class="num">${fmt(r.qty)}</b> نسخة · ${r.condition === "DAMAGED" ? "فيه عيب" : "سليم"} · ${esc(r.reason)} · <span class="num">${esc(String(r.at).slice(0, 16))}</span></div></div>
      <button class="btn btn-primary btn-xs" data-act="retRes" data-id="${esc(i.Res_Item_ID)}|1">${ic("check")} استلمت واعتمدت</button><button class="btn btn-outline btn-xs" data-act="retRes" data-id="${esc(i.Res_Item_ID)}|0">رفض</button></li>`; }).join("")}</ul>`)}</div>`;
}
on("retRes", async v => {
  const [id, ap] = v.split("|"), it = A().resItems.find(i => i.Res_Item_ID === id) || {}, r = (() => { try { return JSON.parse(it.Return_Request || "null"); } catch (_) { return null; } })() || {}, ex = r.kind === "EXCHANGE";
  const f = await UI.form({ title: (ap === "1" ? "اعتماد " : "رفض ") + (ex ? "الاستبدال" : "المرتجع"),
    intro: ap === "1" ? (ex ? "استلم النسخة المعيبة وسلّم نسخة سليمة من المخزن. الفاتورة لا تتغير، والمعيبة تُستبعد وتُسجَّل مطالبة على المكتبة (لو عيب صناعة)." : "تأكد إنك استلمت الكتاب فعلاً. يُسجَّل إذن مرتجع ويدخل المخزن وتُخفَّض فاتورة الموظف.") : "يبقى الكتاب مع الموظف وفاتورته كما هي. سبب الرفض بيظهر له.",
    fields: [...(ap === "1" && !ex ? [{ name: "condition", label: "حالة الكتاب عند الاستلام", type: "select", value: "GOOD", options: [["GOOD", "سليم"], ["DAMAGED", "تالف (يُستبعد من المخزن)"]] }] : []),
      ...(ap === "1" && ex ? [{ name: "claim", label: "تحميل النسخة المعيبة على", type: "select", value: "1", options: [["1", "المكتبة (عيب صناعة — مطالبة)"], ["0", "المبادرة (خسارة)"]] }] : []),
      { name: "note", label: ap === "1" ? "ملاحظة للموظف (اختياري)" : "سبب الرفض (إجباري)", required: ap !== "1" }], ok: ap === "1" ? "اعتماد" : "رفض" });
  if (!f) return;
  if (ap !== "1" && !String(f.note || "").trim()) return toast("اكتب سبب الرفض", "warning");
  const res = await act("RESOLVE_RETURN_REQUEST", { resItemId: id, approve: ap === "1", condition: f.condition, note: f.note, claimSupplier: f.claim !== "0" });
  if (res && res.success && res.receiptNo && ex && typeof printDoc === "function") printDoc(res.receiptNo);
});
const _notifAdm = Notif.list;
Notif.list = function () {
  const out = _notifAdm.call(Notif);
  if (APP.adm && APP.user && APP.user.userType !== "EMPLOYEE") {
    const c = cancelReqs().length, r = retReqs().length;
    if (r) out.unshift({ id: "ret-" + r + "-" + retReqs().map(i => i.Res_Item_ID).join(",").length, icon: "undo-2", tone: "amber", title: `${r} طلب مرتجع بانتظارك`, body: "راجعها واعتمدها من لوحة القيادة", href: "#/a/dash" });
    if (c) out.unshift({ id: "cancel-" + c + "-" + cancelReqs().map(h => h.Res_ID).join(",").length, icon: "x", tone: "red", title: `${c} طلب إلغاء من الموظفين`, body: "راجعها واعتمدها من لوحة القيادة", href: "#/a/dash" });
  }
  return out;
};
setTimeout(() => { try { Notif.badge(); } catch (_) {} }, 0);

const _wrapA = (path, fn) => { const base = Router.routes[path]; if (base) Router.add(path, view => { base(view); fn(view); }); };
// ================================================================ المتأخرات + تذكير واتساب
ADMIN_NAV[3].items.push(["late", "triangle-alert", "المتأخرات"]);
const lateRows = () => {
  const d = A(), today = new Date().toISOString().slice(0, 10), { e } = maps(), by = {};
  d.installments.filter(i => n(i.Remaining_Inst_Amount) > 0 && String(i.Due_Date).slice(0, 10) < today).forEach(i => {
    const inv = d.empInvoices.find(x => x.Emp_Inv_ID === i.Emp_Inv_ID) || {}; const id = inv.Emp_ID || i.Emp_ID; if (!id) return;
    const o = by[id] = by[id] || { id, name: empName(e, id), mobile: (e[id] || {}).Mobile || "", amount: 0, n: 0, oldest: i.Due_Date };
    o.amount += n(i.Remaining_Inst_Amount); o.n++; if (String(i.Due_Date) < String(o.oldest)) o.oldest = i.Due_Date; });
  return Object.values(by).map(o => Object.assign(o, { days: Math.floor((new Date(today) - new Date(String(o.oldest).slice(0, 10))) / 864e5) })).sort((a, b) => b.days - a.days || b.amount - a.amount);
};
const lateMsg = o => `السلام عليكم أ/ ${o.name}\nتذكير ودّي من مبادرة الكتب: عليك ${o.n > 1 ? o.n + " أقساط متأخرة" : "قسط متأخر"} بإجمالي ${fmt(o.amount)} ج.م (من ${day(o.oldest)}).\nتقدر تدفع من «مدفوعاتي» ← ادفع الآن (إنستاباي/محفظة) أو نقداً للمسؤول. شكراً لتعاونك 🌷`;
const waNum = m => { m = String(m || "").replace(/\D/g, ""); return m.startsWith("0") ? "2" + m : m; };
Router.add("/a/late", view => {
  const rows = lateRows(), tot = rows.reduce((s, o) => s + o.amount, 0);
  view.innerHTML = UI.pageHead("المتأخرات", "كل من فات ميعاد قسطه، مع تذكير واتساب جاهز")
    + `<div class="grid grid-cols-2 gap-3 sm:gap-4 mb-4">${UI.kpi("متأخرين", fmt(rows.length), { icon: "users", tone: "red" })}${UI.kpi("إجمالي المتأخر", money(tot), { icon: "triangle-alert", tone: "amber" })}</div>`
    + UI.section(`${ic("triangle-alert", "text-rose-500")} القائمة`, "الأقدم تأخيراً أولاً", (rows.length ? `<div class="flex justify-end mb-2"><button class="btn btn-outline btn-xs" data-act="lateCopy">${ic("copy")} نسخ القائمة كلها</button></div>` : "") + UI.table([
      { t: "الموظف", v: o => `${empLink(o.id, o.name)}<div class="text-[11px] text-slate-400 num">${esc(o.id)} · ${esc(o.mobile)}</div>` },
      { t: "المتأخر", cls: "num", v: o => `<b class="text-rose-600">${fmt(o.amount)}</b><div class="text-[11px] text-slate-400">${o.n} قسط</div>` },
      { t: "من", cls: "num", v: o => `${esc(day(o.oldest))}<div class="text-[11px] ${o.days > 14 ? "text-rose-600 font-bold" : "text-amber-600"}">${o.days} يوم</div>` },
      { t: "تذكير", actions: true, v: o => o.mobile ? `<a class="btn btn-success btn-xs" target="_blank" rel="noopener" href="${esc(Brand.waLink(waNum(o.mobile), lateMsg(o)))}">${ic("message-circle")} واتساب</a>` : `<span class="text-[11px] text-slate-400">بلا موبايل</span>` }
    ], rows, { maxH: 700, emptyIcon: "circle-check", empty: "مفيش متأخرات 🎉" }));
});
on("lateCopy", () => { const t = lateRows().map(o => `${o.name} (${o.id}) — ${fmt(o.amount)} ج.م — ${o.days} يوم — ${o.mobile}`).join("\n"); try { navigator.clipboard.writeText(t); toast("اتنسخت القائمة", "success"); } catch (_) {} });

// ================================================================ محضر إقفال الخزينة (طباعة)
_wrapA("/a/cash", view => {
  const inp = $$("input[data-change=cashDay]", view)[0]; if (!inp) return;
  inp.insertAdjacentHTML("afterend", `<button class="btn btn-outline btn-sm w-full mb-3" data-act="cashReport">${ic("printer")} محضر اليوم (PDF)</button>`);
});
on("cashReport", () => {
  const d = A(), { e } = maps(), dv = Q.cashDay || new Date().toISOString().slice(0, 10);
  const ps = d.empPayments.filter(p => day(p.Payment_Date) === dv), ok = ps.filter(p => !isTrue(p.Is_Voided));
  const byM = {}, byU = {}; ok.forEach(p => { byM[p.Payment_Method] = (byM[p.Payment_Method] || 0) + n(p.Amount); byU[p.Collected_By || "—"] = (byU[p.Collected_By || "—"] || 0) + n(p.Amount); });
  const t = (h, rows) => `<table><thead><tr>${h.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows || `<tr><td colspan="${h.length}" class="c sub">—</td></tr>`}</tbody></table>`;
  const html = Doc.page(`${Doc.head("محضر إقفال الخزينة", dv)}
    <div class="meta"><div class="box"><h4>حسب الوسيلة</h4>${Object.keys(byM).map(k => Doc.kv(esc(ar(k)), `<span class="num">${Doc.money(byM[k])}</span>`)).join("") || "—"}${Doc.kv("الإجمالي", `<b class="num">${Doc.money(sum(ok, "Amount"))}</b>`)}</div>
      <div class="box"><h4>حسب المحصِّل</h4>${Object.keys(byU).map(k => Doc.kv(esc(k), `<span class="num">${Doc.money(byU[k])}</span>`)).join("") || "—"}${Doc.kv("عدد الإيصالات", `<span class="num">${ok.length}</span>`)}</div></div>
    <h4 style="margin:2mm 0 1mm">الإيصالات</h4>${t(["الإيصال", "الموظف", "الوسيلة", "المرجع", "المبلغ"], ps.map(p => `<tr><td class="num">${esc(p.Receipt_No)}${isTrue(p.Is_Voided) ? " (ملغى)" : ""}</td><td>${esc(empName(e, p.Emp_ID))}</td><td>${esc(ar(p.Payment_Method))}</td><td class="num">${esc(p.Transaction_Ref || "")}</td><td class="l num">${Doc.money(p.Amount)}</td></tr>`).join(""))}
    <div class="meta" style="margin-top:8mm"><div class="box"><h4>المحصِّل</h4><br>التوقيع: ..................</div><div class="box"><h4>المراجع المالي</h4><br>التوقيع: ..................</div></div>
    ${Doc.foot("CASH-" + dv)}`, "", "", "dense");
  Doc.show("محضر خزينة " + dv, html, { file: "cash-" + dv });
});

// ================================================================ تصدير Excel لأي جدول في الإدارة
const _uiTable = UI.table;
UI.table = function (cols, rows, opts) {
  const h = _uiTable.call(UI, cols, rows, opts);
  if (!rows.length || !APP.user || APP.user.userType === "EMPLOYEE" || (opts && opts.noExport)) return h;
  return `<div class="wb-xls"><div class="flex justify-end -mt-1 mb-1"><button class="btn btn-ghost btn-xs text-slate-500" data-act="tblXls">${ic("file-spreadsheet")} Excel</button></div>${h}</div>`;
};
document.addEventListener("click", ev => {
  const btn = ev.target.closest && ev.target.closest('[data-act="tblXls"]'); if (!btn) return;
  ev.stopPropagation();
  const box = btn.closest(".wb-xls"), tb = box && box.querySelector("table"); if (!tb) return;
  const cell = c => '"' + c.innerText.replace(/\s*\n\s*/g, " — ").replace(/"/g, '""').trim() + '"';
  const csv = "﻿" + $$("tr", tb).map(r => $$("th,td", r).map(cell).join(",")).join("\r\n");
  const t = ((document.querySelector("main h1, h1") || {}).innerText || "جدول").trim();
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = t + "-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a); a.click(); setTimeout(() => document.body.removeChild(a), 500);
}, true);

// ================================================================ تقييمات الموظفين بعد الاستلام
_wrapA("/a/dash", view => {
  const fb = A().resHeaders.map(h => { try { const f = JSON.parse(h.Feedback || "null"); return f ? Object.assign({ emp: h.Emp_ID }, f) : null; } catch (_) { return null; } }).filter(x => x && x.stars);
  if (!fb.length) return; const { e } = maps(), avg = fb.reduce((s, x) => s + x.stars, 0) / fb.length, notes = fb.filter(x => x.note).sort((a, b) => String(b.at).localeCompare(a.at)).slice(0, 6);
  view.insertAdjacentHTML("beforeend", `<div class="mt-4 sm:mt-6">${UI.section(`⭐ رأي الموظفين بعد الاستلام`, `${fmt(fb.length)} تقييم · المتوسط ${avg.toFixed(1)} من 5`, `<div class="flex gap-1 mb-3">${[5, 4, 3, 2, 1].map(s => { const c = fb.filter(x => x.stars === s).length; return `<div class="flex-1 rounded-xl bg-slate-50 text-center py-2"><div class="text-[11px]">${s} ⭐</div><b class="num">${c}</b></div>`; }).join("")}</div>${notes.length ? `<ul class="divide-y divide-slate-100 text-[13px]">${notes.map(x => `<li class="py-2"><b>${esc(empName(e, x.emp))}</b> ${"⭐".repeat(x.stars)}<div class="text-slate-600">${esc(x.note)}</div></li>`).join("")}</ul>` : ""}`)}</div>`);
});

// ================================================================ تبويبات الموبايل بدل القوائم المتراصة
Q.mtab = Q.mtab || {};
function mobileTabs(view, key, tabs) {
  tabs = tabs.filter(t => t.els.every(Boolean)); if (tabs.length < 2) return;
  const cur = Math.min(Q.mtab[key] || 0, tabs.length - 1);
  tabs.forEach((t, i) => t.els.forEach(el => el.classList.toggle("mt-off", i !== cur)));
  const bar = document.createElement("div");
  bar.className = "lg:hidden sticky top-[3.6rem] z-[5] -mx-1 mb-3 p-1 rounded-2xl bg-white/90 backdrop-blur ring-1 ring-slate-200 shadow-sm flex gap-1";
  bar.innerHTML = tabs.map((t, i) => `<button class="flex-1 h-10 rounded-xl text-[13px] font-bold transition ${i === cur ? "bg-brand-700 text-white shadow" : "text-slate-600"}" data-mt="${i}">${t.label}${t.count != null ? ` <span class="num ${i === cur ? "text-gold-300" : "text-slate-400"}">${fmt(t.count)}</span>` : ""}</button>`).join("");
  bar.addEventListener("click", ev => { const b = ev.target.closest("[data-mt]"); if (!b) return; Q.mtab[key] = +b.dataset.mt; Shell.rerender(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  const head = view.firstElementChild; head.insertAdjacentElement("afterend", bar);
}
_wrapA("/a/delivery", view => {
  const k = [...view.children];
  const docs = A().deliveryReturns.filter(x => x.Phase_ID === APP.phaseId).length;
  mobileTabs(view, "delivery", [{ label: "👥 التسليم", els: [k[1], k[2]] }, { label: "📄 المستندات", count: docs, els: [k[4]] }]);
});
_wrapA("/a/cash", view => {
  const g = view.querySelector(".grid.items-start"); if (!g || g.children.length < 2) return;
  mobileTabs(view, "cash", [{ label: "🧾 الإيصالات", count: A().empPayments.length, els: [g.children[0]] }, { label: "🔒 إقفال اليوم", els: [g.children[1]] }]);
});

// ================================================================ الحجز نيابة عن موظف — بنفس شاشات الموظف وآليته
// المسؤول يختار الموظف ← تتحول الواجهة لبوابة الموظف (الرئيسية، المعالج، الدليل، السداد) ببياناته،
// وكل الطلبات تمر بجلسة المسؤول نفسها مع empId (ADMIN_EMP_PORTAL / SUBMIT_OR_UPDATE_RESERVATION / SAVE_MY_KIDS / WAITLIST_DECISION).
const EmpProxy = { on: false, empId: "", name: "", saved: null };
const _callProxy = call;
call = function (action, payload, opts) {
  if (EmpProxy.on) {
    payload = Object.assign({}, payload || {});
    if (action === "GET_EMPLOYEE_PORTAL_DATA") { action = "ADMIN_EMP_PORTAL"; payload.empId = EmpProxy.empId; }
    else if (["SUBMIT_OR_UPDATE_RESERVATION", "SAVE_MY_KIDS", "WAITLIST_DECISION"].includes(action)) payload.empId = EmpProxy.empId;
    else if (/^(EMP_|LOGOUT$|CHANGE_PASSWORD$)/.test(action)) return Promise.resolve({ success: false, message: "العملية دي للموظف نفسه — اخرج من «الحجز نيابة عن موظف» الأول." });
  }
  return _callProxy(action, payload, opts);
};
async function proxyStart(empId) {
  const { e } = maps(), emp = e[empId] || {};
  const r = await call("ADMIN_EMP_PORTAL", { empId, phaseId: APP.phaseId }, { block: true });
  if (!r.success) return toast(r.message, "danger");
  if (!r.activePhase || !r.activePhase.Booking_Open) { toast("الحجز مقفول في المرحلة دي — هيفتح محرر الإدارة المباشر", "info"); return ACTIONS.resEditQuick(empId); }
  EmpProxy.saved = { user: APP.user, adm: APP.adm, phaseId: APP.phaseId, hash: location.hash };
  Object.assign(EmpProxy, { on: true, empId, name: emp.Full_Name || empId });
  APP.user = Object.assign({}, APP.user, { userType: "EMPLOYEE", empId, fullName: emp.Full_Name || empId, department: emp.Department || "", mobile: emp.Mobile || "", installmentAllowed: true, _proxy: true });
  APP.emp = r; APP.phasePicked = false; if (r.activePhase) APP.phaseId = r.activePhase.Phase_ID;
  Emp.dirty = false; Emp.resetCart();
  try { localStorage.removeItem("wb_wz_" + empId); } catch (_) {}
  proxyBar();
  location.hash = "#/e/home"; setTimeout(() => ACTIONS.wizStart && ACTIONS.wizStart(), 300);
}
function proxyBar() {
  let el = document.getElementById("wb-proxy");
  if (!EmpProxy.on) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "wb-proxy"; document.body.appendChild(el); }
  el.style.cssText = "position:fixed;left:10px;right:10px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:55;max-width:560px;margin:0 auto";
  el.innerHTML = `<div class="flex items-center gap-2 rounded-2xl bg-amber-500 text-amber-950 shadow-lg ring-2 ring-amber-300 px-3 py-2"><span class="text-[20px]">🧑‍💼</span>
    <div class="flex-1 min-w-0 text-[12.5px] leading-tight"><b class="block truncate">بتحجز نيابة عن: ${esc(EmpProxy.name)}</b><span class="num opacity-80">${esc(EmpProxy.empId)} · نفس شاشات الموظف بالظبط</span></div>
    <button class="btn btn-dark btn-xs shrink-0" data-act="proxyExit">${ic("arrow-right")} رجوع للإدارة</button></div>`;
}
on("proxyExit", async () => {
  if (Emp.dirty && !(await UI.confirm({ title: "فيه تعديلات ما اتأكدتش", message: "الحجز ده لسه ما اتأكدش. تخرج من غير حفظ؟", ok: "اخرج", tone: "danger" }))) return;
  const s = EmpProxy.saved; if (!s) return proxyBar(); Object.assign(EmpProxy, { on: false, empId: "", name: "", saved: null });
  while (UI._stack.length) UI.close(UI._stack[UI._stack.length - 1], true);
  APP.user = s.user; APP.emp = null; APP.adm = s.adm; APP.phaseId = s.phaseId; Emp.dirty = false;
  proxyBar(); location.hash = "#/a/res";
  await Admin.load(); Shell.rerender();
});
// «حجز لموظف» و«تعديل الحجز» من الإدارة ← وضع النيابة (المحرر السريع القديم متاح باسم resEditQuick)
ACTIONS.resEditQuick = ACTIONS.resEdit;
on("resEdit", empId => proxyStart(empId));

// ================================================================ جاهزية الإطلاق (أعلى لوحة القيادة)
function launchChecks() {
  const d = A(), sm = d.settingsMap || {}, sup = d.suppliers[0] || {};
  const pricing = d.books.filter(b => b.Book_Status === "Pricing").length;
  const defUsers = (d.users || []).filter(u => isTrue(u.Must_Change_Password) && isTrue(u.Is_Active !== "" ? u.Is_Active : true));
  return [
    { ok: d.phases.some(p => p.Booking_Open), t: "مرحلة حجز مفتوحة بمواعيدها", tip: "افتح المرحلة وحدد بداية ونهاية الحجز", go: "/a/phases" },
    { ok: !pricing, t: pricing ? `${fmt(pricing)} كتاب لسه من غير سعر` : "كل الكتب مسعّرة", tip: "التوزيع لا يخصص كتاباً بلا سعر", go: "/a/books" },
    { ok: !!sm.PICKUP_SCHEDULE, t: "مواعيد ومكان الاستلام", tip: "تظهر للموظف في «حجوزاتي»", go: "/a/slots" },
    { ok: !!sm.PAY_INSTAPAY_LINK, t: "رابط دفع إنستاباي", tip: "يفتح تطبيق إنستاباي مباشرة للموظف (اختياري)", go: "/a/settings", soft: true },
    { ok: !!(sup.Phone && sup.Contact_Person), t: "بيانات المكتبة (المسؤول والتليفون)", tip: (sup.Supplier_Name || "المكتبة") + " — تظهر في أوامر التوريد", go: "/a/suppliers" },
    { ok: !defUsers.length, t: defUsers.length ? `${defUsers.length} حساب إدارة بكلمة سر مؤقتة` : "كلمات سر الإدارة متغيرة", tip: defUsers.map(u => u.Username).join("، ") || "", go: "/a/settings" },
    { ok: isTrue(sm.RESET_LOCKED), t: "قفل زر تصفير البيانات", tip: "يمنع المسح الكامل بالخطأ بعد الإطلاق", act: "lockReset" }
  ];
}
_wrapA("/a/dash", view => {
  if (!can("SAVE_SETTING") && APP.user.role !== "Coordinator") return;
  const cs = launchChecks(), done = cs.filter(c => c.ok).length, all = done === cs.length;
  let hide = false; try { hide = all && localStorage.getItem("wb_launch_hide") === "1"; } catch (_) {}
  if (hide) return;
  const pct = Math.round(done / cs.length * 100);
  const html = `<section class="card overflow-hidden mb-4 ring-1 ${all ? "ring-emerald-200" : "ring-amber-200"}">
    <div class="p-4 ${all ? "bg-emerald-50/60" : "bg-gradient-to-l from-amber-50 to-white"} flex items-center gap-3">
      <div class="relative w-14 h-14 shrink-0">${UI.donut ? "" : ""}<svg viewBox="0 0 36 36" class="w-14 h-14 -rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2e8f0" stroke-width="4"/><circle cx="18" cy="18" r="15.5" fill="none" stroke="${all ? "#10b981" : "#f59e0b"}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${pct * 0.974} 100"/></svg><b class="absolute inset-0 flex items-center justify-center text-[13px] num">${done}/${cs.length}</b></div>
      <div class="flex-1 min-w-0"><h3 class="font-bold text-slate-900">${all ? "🚀 المنصة جاهزة للإطلاق" : "🚦 جاهزية الإطلاق"}</h3><p class="text-[12.5px] text-slate-600">${all ? "كل البنود الأساسية تمام — ابعت رسالة الإطلاق وتابع من غرفة المتابعة." : "خلّص البنود دي قبل ما تعلن عن المنصة."}</p></div></div>
    <ul class="divide-y divide-slate-100">${cs.map(c => `<li class="flex items-center gap-3 px-4 py-2.5"><span class="text-[18px]">${c.ok ? "✅" : c.soft ? "🟡" : "⛔"}</span><div class="flex-1 min-w-0"><div class="text-[13.5px] font-semibold ${c.ok ? "text-slate-500" : "text-slate-900"}">${esc(c.t)}</div>${c.tip && !c.ok ? `<div class="text-[11.5px] text-slate-500">${esc(c.tip)}</div>` : ""}</div>
      ${c.ok ? "" : c.act ? `<button class="btn btn-dark btn-xs" data-act="${c.act}">نفّذ</button>` : `<a class="btn btn-outline btn-xs" href="#${c.go}">كمّل ${ic("chevron-left")}</a>`}</li>`).join("")}</ul>
    <div class="flex flex-wrap gap-2 p-3 bg-slate-50/70 border-t border-slate-100"><button class="btn btn-success btn-sm" data-act="launchMsg">${ic("message-circle")} رسالة الإطلاق</button><a class="btn btn-primary btn-sm" href="#/a/live">${ic("activity")} غرفة المتابعة</a>${all ? `<button class="btn btn-ghost btn-sm" data-act="launchHide">إخفاء</button>` : ""}</div></section>`;
  const h = view.firstElementChild; if (h) h.insertAdjacentHTML("afterend", html); else view.insertAdjacentHTML("afterbegin", html);
});
on("launchHide", () => { try { localStorage.setItem("wb_launch_hide", "1"); } catch (_) {} Shell.rerender(); });
on("lockReset", () => act("SAVE_SETTING", { key: "RESET_LOCKED", value: true }, { title: "قفل التصفير", message: "بعد القفل مش هينفع تصفير بيانات التشغيل إلا لو رجّعت الإعداد RESET_LOCKED لـ false من الإعدادات. تقفل دلوقتي؟", ok: "اقفل" }));

// ================================================================ رسالة الإطلاق (واتساب)
function launchText() {
  const d = A(), ph = d.phases.find(p => p.Booking_Open) || d.phases[d.phases.length - 1] || {}, base = location.origin + location.pathname.replace(/index\.html$/, "");
  const end = ph.End_DateTime ? String(ph.End_DateTime).slice(0, 10) : "";
  return `📚 *منصة حجز الكتب المخفضة* — النقابة العامة بالدقهلية

كتب ولادك الخارجية *بخصم ${fmt((d.settingsMap || {}).UNIFIED_EMP_DISCOUNT_PCT || 18)}%* وبالتقسيط المريح 💜
الحجز مفتوح دلوقتي${ph.Phase_Name ? ` لـ «${ph.Phase_Name}»` : ""}${end ? ` لحد ${end}` : ""}

👈 ادخل من موبايلك:
${base}

✅ ادخل برقمك الوظيفي + آخر 4 أرقام من القومي + موبايلك
✅ اختار ولادك والمنصة تجهزلك كتب صفهم
✅ اختار تدفع كاش أو تقسيط وأكّد

🎬 فيديو طريقة الحجز (دقيقة ونص):
${base}media/booking.mp4

⏱ الأسبقية بالدقيقة — احجز بدري
❓ مش قادر تدخل؟ اضغط «مش قادر تدخل؟» في صفحة الدخول`;
}
on("launchMsg", () => {
  const t = launchText();
  const m = UI.open(`<textarea class="input !h-72 text-[13px] leading-relaxed" id="lmTxt">${esc(t)}</textarea>
    <div class="grid grid-cols-2 gap-2 mt-3"><button class="btn btn-outline" data-lm="copy">${ic("copy")} نسخ</button><a class="btn btn-success" target="_blank" rel="noopener" data-lm="wa" href="https://wa.me/?text=${encodeURIComponent(t)}">${ic("message-circle")} شارك على واتساب</a></div>
    <p class="text-[12px] text-slate-500 mt-2">عدّل النص براحتك قبل الإرسال. لإرسال تذكير فردي لمن لم يحجز: صفحة «متابعة الأعضاء».</p>`, { title: "رسالة الإطلاق", sub: "جاهزة للجروبات والأعضاء" });
  const ta = m.root.querySelector("#lmTxt"), wa = m.root.querySelector('[data-lm="wa"]');
  ta.addEventListener("input", () => { wa.href = "https://wa.me/?text=" + encodeURIComponent(ta.value); });
  m.root.querySelector('[data-lm="copy"]').addEventListener("click", () => { try { navigator.clipboard.writeText(ta.value); toast("اتنسخت ✅", "success"); } catch (_) { ta.select(); } });
});

// ================================================================ غرفة المتابعة يوم الإطلاق + مسار الحجز (funnel)
ADMIN_NAV[0].items.push(["live", "activity", "غرفة المتابعة"]);
const LIVE = { f: null, at: 0, timer: null };
async function liveFetch() { const r = await call("GET_FUNNEL", {}); if (r.success) { LIVE.f = r; LIVE.at = Date.now(); } return r; }
const FUNNEL = [["login", "دخل المنصة"], ["portal", "فتح البوابة"], ["wiz", "بدأ الحجز"], ["review", "وصل للمراجعة"], ["pay", "اختار السداد"], ["submit", "أكّد الحجز"]];
function funnelHTML(f) {
  const m = {}; (f.steps || []).forEach(s => { m[s.step] = s.n; }); const top = Math.max(1, m.login || 0, m.portal || 0);
  return `<div class="space-y-2">${FUNNEL.map(([k, l], i) => { const v = m[k] || 0, prev = i ? (m[FUNNEL[i - 1][0]] || 0) : 0, drop = i && prev ? Math.round((1 - v / prev) * 100) : 0;
    return `<div><div class="flex justify-between text-[12.5px] mb-1"><span class="font-semibold text-slate-700">${l}</span><span class="num"><b>${fmt(v)}</b>${i && prev && drop > 0 ? ` <span class="text-rose-500 text-[11px]">−${drop}%</span>` : ""}</span></div>
      <div class="h-3 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-l from-brand-600 to-gold-400" style="width:${Math.round(v / top * 100)}%"></div></div></div>`; }).join("")}</div>
    ${(m.review || 0) > (m.submit || 0) ? `<p class="text-[12px] text-amber-700 bg-amber-50 rounded-xl p-2.5 mt-3">💡 ${fmt((m.review || 0) - (m.submit || 0))} وصلوا للمراجعة وما أكّدوش — ابعتلهم تذكير من «متابعة الأعضاء».</p>` : ""}`;
}
Router.add("/a/live", view => {
  const d = A(), today = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10), { e, b } = maps();
  const f = LIVE.f || { steps: [], recent: [], errs: [], days: [] }, rec = {}; (f.recent || []).forEach(x => { rec[x.step] = x.n; });
  const items = d.resItems.filter(i => String(i.Priority_Timestamp).slice(0, 10) === today && !String(i.Allocation_Status).startsWith("Cancelled"));
  const hdrs = d.resHeaders.filter(h => String(h.Last_Modified_At).slice(0, 10) === today).sort((x, y) => String(y.Last_Modified_At).localeCompare(String(x.Last_Modified_At)));
  const byHour = {}; items.forEach(i => { const h = String(i.Priority_Timestamp).slice(11, 13); byHour[h] = (byHour[h] || 0) + n(i.Requested_Qty); });
  const topB = {}; items.forEach(i => { topB[i.Book_ID] = (topB[i.Book_ID] || 0) + n(i.Requested_Qty); });
  const hrs = Object.keys(byHour).sort(), mx = Math.max(1, ...Object.values(byHour));
  view.innerHTML = UI.pageHead("غرفة المتابعة", `يتحدث كل دقيقة · آخر تحديث ${LIVE.at ? new Date(LIVE.at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }) : "—"}`, `<button class="btn btn-outline btn-sm" data-act="liveNow">${ic("refresh-cw")} تحديث الآن</button>`)
    + `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">${UI.kpi("حجوزات اليوم", fmt(new Set(hdrs.map(h => h.Emp_ID)).size), { icon: "notebook-pen", tone: "brand", foot: fmt(items.reduce((s, i) => s + n(i.Requested_Qty), 0)) + " نسخة" })}${UI.kpi("آخر 15 دقيقة", fmt(rec.submit || 0), { icon: "activity", tone: "green", foot: `${fmt(rec.login || 0)} دخول · ${fmt(rec.portal || 0)} فتح` })}${UI.kpi("أخطاء اليوم", fmt((f.errs || []).length), { icon: "triangle-alert", tone: (f.errs || []).length ? "red" : "gray", foot: (f.errs || []).filter(x => x.step === "err:busy").length ? "منها زحمة على الخادم" : "" })}${UI.kpi("زوار اليوم", fmt(((f.steps || []).find(s => s.step === "portal") || {}).n || 0), { icon: "users", tone: "blue" })}</div>
    <div class="grid gap-4 lg:grid-cols-2">
      ${UI.section(`${ic("filter", "text-brand-600")} مسار الحجز اليوم`, "فين الناس بتقف قبل ما تأكّد", funnelHTML(f))}
      ${UI.section(`${ic("chart-column", "text-brand-600")} الحجز بالساعة`, "عدد النسخ المحجوزة اليوم لكل ساعة", hrs.length ? `<div class="flex items-end gap-1.5 h-36">${hrs.map(h => `<div class="flex-1 flex flex-col items-center gap-1"><span class="text-[10px] num text-slate-500">${byHour[h]}</span><div class="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-400" style="height:${Math.round(byHour[h] / mx * 100)}%"></div><span class="text-[10px] num text-slate-400">${h}</span></div>`).join("")}</div>` : UI.empty("clock", "لا حجوزات اليوم بعد"))}
      ${UI.section(`${ic("activity", "text-emerald-600")} آخر الحجوزات`, "مباشر", hdrs.length ? `<ul class="divide-y divide-slate-100">${hdrs.slice(0, 12).map(h => `<li class="flex items-center gap-2 py-2"><span class="w-2 h-2 rounded-full bg-emerald-500"></span><div class="flex-1 min-w-0 text-[13px]">${empLink(h.Emp_ID, empName(e, h.Emp_ID))} <span class="text-slate-400 text-[11.5px]">${esc((e[h.Emp_ID] || {}).Department || "")}</span></div><b class="num text-[13px]">${fmt(h.Total_Emp_Value)}</b><span class="num text-[11px] text-slate-400">${esc(String(h.Last_Modified_At).slice(11, 16))}</span></li>`).join("")}</ul>` : UI.empty("activity", "مستني أول حجز 👀"))}
      ${UI.section(`${ic("zap", "text-amber-500")} الأكثر حجزاً اليوم`, "", Object.keys(topB).length ? `<ul class="space-y-1.5">${Object.entries(topB).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => `<li class="flex justify-between text-[13px]"><span class="truncate">${esc(bookName(b, k))}</span><b class="num">${v}</b></li>`).join("")}</ul>` : UI.empty("zap", "—"))}
      ${UI.section(`${ic("triangle-alert", "text-rose-500")} مشاكل واجهت الموظفين`, "آخر 24 ساعة — كلّم صاحبها لو اتكررت", (f.errs || []).length ? `<ul class="divide-y divide-slate-100 text-[12.5px]">${f.errs.slice(0, 20).map(x => `<li class="py-1.5 flex gap-2"><span class="num text-slate-400 shrink-0">${esc(new Date(x.at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }))}</span><span class="shrink-0 font-semibold">${esc({ "err:login": "دخول", "err:submit": "حجز", "err:busy": "زحمة", "err:queued": "اتحفظ على الجهاز" }[x.step] || x.step)}</span><span class="text-slate-600 flex-1 min-w-0">${x.emp_id ? empLink(x.emp_id, empName(e, x.emp_id)) + " · " : ""}${esc(x.detail || "")}</span></li>`).join("")}</ul>` : `<div class="text-center text-emerald-700 py-4">✅ مفيش مشاكل</div>`)}
      ${UI.section(`${ic("trending-up", "text-brand-600")} آخر 14 يوم`, "دخول مقابل تأكيد حجز", (f.days || []).length ? (() => { const dd = {}; f.days.forEach(x => { (dd[x.day] = dd[x.day] || {})[x.step] = x.n; }); return `<ul class="text-[12.5px] space-y-1">${Object.keys(dd).map(k => `<li class="flex justify-between"><span class="num">${k.slice(5)}</span><span>دخل <b class="num">${dd[k].login || 0}</b> · حجز <b class="num text-emerald-700">${dd[k].submit || 0}</b></span></li>`).join("")}</ul>`; })() : UI.empty("trending-up", "البيانات بتبدأ تتجمع من النهارده"))}
    </div>`;
  if (!LIVE.f && !LIVE.tried) { LIVE.tried = 1; liveFetch().then(r => { if (r.success && Router.current === "/a/live") Shell.rerender(); }); }
  clearInterval(LIVE.timer);
  LIVE.timer = setInterval(async () => { if (Router.current !== "/a/live") return clearInterval(LIVE.timer); await Promise.all([liveFetch(), Admin.load()]); if (Router.current === "/a/live") Shell.rerender(); }, 60000);
});
on("liveNow", async () => { await Promise.all([liveFetch(), Admin.load()]); Shell.rerender(); });

// ================================================================ (4) ملف الكتاب: كل شيء عن الكتاب في شاشة واحدة (من بيانات الإدارة المحمّلة — بلا طلب للخادم)
on("bookFile", id => {
  const d = A(), { b, e } = maps(), bk = b[id] || {}, st = (d.stockMap || {})[id] || {};
  const live = i => !String(i.Allocation_Status).startsWith("Cancelled") && n(i.Requested_Qty) > 0;
  const all = d.resItems.filter(i => i.Book_ID === id && live(i)), cur = all.filter(i => i.Phase_ID === APP.phaseId).sort((x, y) => String(x.Priority_Timestamp).localeCompare(String(y.Priority_Timestamp)));
  const byPh = {}; all.forEach(i => { const o = byPh[i.Phase_ID] = byPh[i.Phase_ID] || { q: 0, al: 0, dl: 0, p: new Set() }; o.q += n(i.Requested_Qty); o.al += n(i.Allocated_Qty); o.dl += n(i.Delivered_Qty); o.p.add(i.Emp_ID); });
  const rets = d.deliveryReturns.filter(x => x.Book_ID === id && /RETURN/.test(x.Doc_Type));
  const po = d.poSnapshots.filter(p => p.Book_ID === id && p.Phase_ID === APP.phaseId);
  const mg = r2(n(bk.Emp_Selling_Price) - n(bk.Standard_Net_Cost));
  const rq = sum(cur, "Requested_Qty"), al = sum(cur, "Allocated_Qty");
  const tile = (l, v, cls) => `<div class="rounded-xl ${cls || "bg-slate-50"} p-2 text-center"><div class="text-[10.5px] text-slate-500">${l}</div><div class="font-bold num text-[15px]">${v}</div></div>`;
  UI.open(`<div class="flex items-center gap-2 flex-wrap mb-3"><span class="rounded-lg bg-brand-50 text-brand-800 px-2 py-0.5 text-[12px] font-bold num">${esc(id)}</span>${pill(bk.Book_Status)}<span class="text-[12px] text-slate-500">${esc([bk.Publisher, bk.Subject, bk.Book_Part, bk.School_Types].filter(Boolean).join(" · "))}</span></div>
    <div class="label">السعر</div><div class="grid grid-cols-4 gap-1.5 mb-3">${tile("قبل الخصم", fmt(bk.Cover_Price))}${tile("للموظف", fmt(bk.Emp_Selling_Price), "bg-brand-50")}${tile("التكلفة", fmt(bk.Standard_Net_Cost))}${tile("الهامش", fmt(mg), mg < 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50")}</div>
    <div class="label">المرحلة الحالية</div><div class="grid grid-cols-4 gap-1.5 mb-3">${tile("حاجز", fmt(new Set(cur.map(i => i.Emp_ID)).size))}${tile("محجوز", fmt(rq))}${tile("مخصص", fmt(al))}${tile("منتظر", fmt(Math.max(0, rq - al)), rq > al ? "bg-amber-50" : "bg-slate-50")}</div>
    <div class="label">المخزن والتوريد</div><div class="grid grid-cols-4 gap-1.5 mb-3">${tile("بالمخزن", fmt(st.onHand || 0))}${tile("حر", fmt(st.free || 0), (st.free || 0) ? "bg-emerald-50" : "bg-slate-50")}${tile("طُلب", fmt(sum(po, "Net_Order_To_Supplier_Qty")))}${tile("مرتجعات", fmt(rets.reduce((s, x) => s + n(x.Qty), 0)))}</div>
    ${Object.keys(byPh).length > 1 ? `<div class="label">كل المراحل</div><ul class="text-[12.5px] mb-3 divide-y divide-slate-100">${Object.keys(byPh).map(p => `<li class="flex justify-between py-1.5"><span>${esc((d.phases.find(x => x.Phase_ID === p) || {}).Phase_Name || p)}</span><span class="num">${byPh[p].p.size} حاجز · ${byPh[p].q} نسخة · سُلّم ${byPh[p].dl}</span></li>`).join("")}</ul>` : ""}
    <div class="label">الحاجزون بالأسبقية (${fmt(cur.length)})</div>
    ${cur.length ? `<ol class="divide-y divide-slate-100 text-[13px] max-h-72 overflow-y-auto">${cur.slice(0, 200).map((i, k) => `<li class="flex items-start gap-2 py-1.5"><b class="w-6 text-slate-400 num">${k + 1}</b><div class="flex-1 min-w-0">${empLink(i.Emp_ID, empName(e, i.Emp_ID))}${i.Beneficiary ? ` <span class="text-[11px] text-sky-700">لـ ${esc(i.Beneficiary)}</span>` : ""}<div class="text-[11px] text-slate-400 num" dir="ltr">${esc(String(i.Priority_Timestamp).slice(0, 16))}</div></div><span class="num text-[12px] whitespace-nowrap">${fmt(i.Requested_Qty)} / <b>${fmt(i.Allocated_Qty)}</b></span></li>`).join("")}</ol>` : `<div class="text-[13px] text-slate-500 py-2">لا حجوزات لهذا الكتاب في المرحلة.</div>`}`,
    { title: bookName(b, id), sub: "ملف الكتاب", footer: `<div class="flex flex-wrap gap-2 justify-end">${can("SAVE_BOOK") ? `<button class="btn btn-outline btn-sm" data-act="bookForm" data-id="${esc(id)}">${ic("pencil")} تعديل الكتاب</button>` : ""}<button class="btn btn-primary btn-sm" data-act="bookResList" data-id="${esc(id)}">${ic("users")} إدارة الحاجزين</button></div>` });
});
// الضغط على اسم أي كتاب في الإدارة يفتح ملفه؛ «إدارة الحاجزين» القديمة متاحة من داخله
ACTIONS.bookResList = ACTIONS.bookRes;
on("bookRes", id => { while (UI._stack.length) UI.close(UI._stack[UI._stack.length - 1], true); ACTIONS.bookFile(id); });
const _bookResList0 = ACTIONS.bookResList;
on("bookResList", id => { while (UI._stack.length) UI.close(UI._stack[UI._stack.length - 1], true); _bookResList0(id); });

// ================================================================ الشُّعب (علمي/أدبي/بكالوريا…): إدارة مرنة للصفوف والكتب
// الإعداد GRADE_TRACKS = {"2 ثانوي": ["علمي","أدبي",...]}؛ حقل الكتاب Tracks (فارغ = مشترك لكل الشعب). الأزهر واللغات والحكومي بنفس الشعب.
const TRK = { grade: "", sel: {}, dirty: {} };
const trkList = () => { const v = (A().settingsMap || {}).GRADE_TRACKS; let o = v; if (typeof v === "string") { try { o = JSON.parse(v || "{}"); } catch (_) { o = {}; } } return o || {}; };
const bookTracks = b => String(b.Tracks || "").split(/[،,]/).map(x => x.trim()).filter(Boolean);
on("tracksMgr", () => {
  const tl = trkList(), grades = (A().catalog.grades || []).map(g => g.label);
  TRK.grade = TRK.grade || Object.keys(tl)[0] || "2 ثانوي"; TRK.dirty = {};
  trkOpen();
});
function trkBody() {
  const tl = trkList(), g = TRK.grade, tracks = tl[g] || [], books = A().books.filter(b => b.Grade === g);
  const bySub = {}; books.forEach(b => (bySub[b.Subject || "—"] = bySub[b.Subject || "—"] || []).push(b));
  const cur = b => TRK.dirty[b.Book_ID] || bookTracks(b);
  const chip = (b, t) => { const on = cur(b).includes(t); return `<button class="rounded-full px-2 h-7 text-[11.5px] font-semibold ring-1 ${on ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-600 ring-slate-200"}" data-trk="${esc(b.Book_ID)}|${esc(t)}">${esc(t)}</button>`; };
  const grades = Object.keys(tl).concat((A().catalog.grades || []).map(x => x.label).filter(x => /ثانوي/.test(x) && !tl[x]));
  return `<div class="flex gap-1.5 overflow-x-auto pb-1 mb-3">${grades.map(x => `<button class="chip shrink-0" data-trkg="${esc(x)}" aria-pressed="${x === g}">${esc(x)}${tl[x] ? ` <span class="num opacity-60">${tl[x].length}</span>` : ""}</button>`).join("")}</div>
    <div class="rounded-2xl bg-brand-50/60 ring-1 ring-brand-100 p-3 mb-3"><div class="flex items-center justify-between gap-2"><b class="text-[13.5px] text-brand-900">شُعب ${esc(g)}</b><button class="btn btn-outline btn-xs" data-trkedit>${ic("pencil")} تعديل القائمة</button></div>
      <div class="flex flex-wrap gap-1.5 mt-2">${tracks.length ? tracks.map(t => `<span class="rounded-full bg-white ring-1 ring-brand-200 px-2.5 py-1 text-[12px] font-semibold text-brand-800">${esc(t)}</span>`).join("") : `<span class="text-[12.5px] text-slate-500">الصف ده من غير شُعب — كل كتبه للكل.</span>`}</div>
      <p class="text-[11.5px] text-slate-500 mt-2">${ic("info", "inline -mt-0.5")} نفس الشُّعب للحكومي واللغات والأزهر. الكتاب من غير شعبة = <b>مشترك</b> يظهر لكل الشعب.</p></div>
    ${tracks.length ? Object.keys(bySub).sort((a, b) => a.localeCompare(b, "ar")).map(sub => { const l = bySub[sub];
      return `<section class="rounded-2xl ring-1 ring-slate-200 bg-white mb-2 overflow-hidden"><div class="flex items-center gap-2 p-2.5 bg-slate-50 border-b border-slate-100"><b class="flex-1 text-[13.5px]">${esc(sub)} <span class="text-[11px] text-slate-400 font-normal num">${l.length} كتاب</span></b>
          <select class="input !h-8 !w-auto !text-[12px]" data-trksub="${esc(sub)}"><option value="">طبّق على كل كتب المادة…</option><option value="__all">مشترك (كل الشعب)</option>${tracks.map(t => `<option value="${esc(t)}">${esc(t)} فقط</option>`).join("")}</select></div>
        <ul class="divide-y divide-slate-100">${l.map(b => `<li class="p-2.5"><div class="text-[12.5px] font-semibold text-slate-800">${esc(b.Book_Name)} <span class="text-[10.5px] text-slate-400 num">${esc(b.Book_ID)}</span>${TRK.dirty[b.Book_ID] ? ` <span class="text-amber-600 text-[11px]">• معدّل</span>` : ""}</div>
          <div class="flex flex-wrap gap-1 mt-1.5">${tracks.map(t => chip(b, t)).join("")}${cur(b).length ? "" : `<span class="rounded-full px-2 h-7 inline-flex items-center text-[11.5px] bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">مشترك</span>`}</div></li>`).join("")}</ul></section>`; }).join("") : ""}`;
}
function trkOpen() {
  const n = () => Object.keys(TRK.dirty).length;
  const m = UI.open(`<div id="trkBody">${trkBody()}</div>`, { title: "الشُّعب الدراسية", sub: "علمي · أدبي · بكالوريا — مرنة بالكامل", wide: true,
    footer: `<div class="flex items-center justify-between gap-2"><span class="text-[12.5px] text-slate-500" id="trkN"></span><button class="btn btn-primary" id="trkSave">${ic("check")} حفظ شُعب الكتب</button></div>` });
  const re = () => { m.root.querySelector("#trkBody").innerHTML = trkBody(); m.root.querySelector("#trkN").textContent = n() ? `${n()} كتاب معدّل` : ""; };
  m.root.addEventListener("click", async ev => {
    const c = ev.target.closest("[data-trk]"), g = ev.target.closest("[data-trkg]"), ed = ev.target.closest("[data-trkedit]");
    if (c) { const [id, t] = c.dataset.trk.split("|"), b = A().books.find(x => x.Book_ID === id); const cur = (TRK.dirty[id] || bookTracks(b)).slice(); const i = cur.indexOf(t); i < 0 ? cur.push(t) : cur.splice(i, 1); TRK.dirty[id] = cur; re(); }
    if (g) { TRK.grade = g.dataset.trkg; re(); }
    if (ed) { const tl = trkList(), v = await UI.form({ title: "شُعب " + TRK.grade, intro: "شعبة في كل سطر. سيبها فاضية لو الصف من غير شُعب.", fields: [{ name: "t", label: "الشُّعب", type: "textarea", rows: 7, value: (tl[TRK.grade] || []).join("\n") }], ok: "حفظ" });
      if (!v) return; const list = String(v.t).split(/\n+/).map(x => x.trim()).filter(Boolean), nt = Object.assign({}, tl); if (list.length) nt[TRK.grade] = list; else delete nt[TRK.grade];
      const r = await call("SAVE_SETTING", { key: "GRADE_TRACKS", value: JSON.stringify(nt) }, { block: true }); toast(r.message || "تم", r.success ? "success" : "danger"); if (r.success) { await Admin.load(); re(); } }
  });
  m.root.addEventListener("change", ev => { const sel = ev.target.closest("[data-trksub]"); if (!sel || !sel.value) return;
    A().books.filter(b => b.Grade === TRK.grade && (b.Subject || "—") === sel.dataset.trksub).forEach(b => { TRK.dirty[b.Book_ID] = sel.value === "__all" ? [] : [sel.value]; }); re(); });
  m.root.querySelector("#trkSave").addEventListener("click", async () => {
    const rows = Object.keys(TRK.dirty).map(id => ({ bookId: id, tracks: TRK.dirty[id] })); if (!rows.length) return toast("مفيش تعديلات", "info");
    const r = await call("SET_BOOK_TRACKS", { rows }, { block: true }); toast(r.message, r.success ? "success" : "danger"); if (r.success) { TRK.dirty = {}; await Admin.load(); re(); }
  });
}
// زر «الشُّعب» في صفحة الكتب + شارة الشعبة على بطاقة الكتاب
_wrapA("/a/books", view => {
  if (!can("SAVE_BOOK")) return;
  const head = view.querySelector(".flex.flex-wrap.gap-2, [data-act=bulkPrice]"); const btn = `<button class="btn btn-outline btn-sm" data-act="tracksMgr">${ic("graduation-cap")} الشُّعب (علمي/أدبي/بكالوريا)</button>`;
  const bp = view.querySelector("[data-act=bulkPrice]"); if (bp) bp.insertAdjacentHTML("afterend", btn);
});

// ================================================================ حساب العضو: له / عليه + تسوية الرصيد + طلب بالمتبقي
const acctOf = invs => { const lah = invs.reduce((s, i) => s + n(i.Credit_Balance), 0), alayh = invs.reduce((s, i) => s + n(i.Remaining_Balance), 0); return { lah, alayh, net: alayh - lah }; };
/** بنود لم تُخصَّص بعد التوزيع (المتبقي للمرحلة التالية) — لا تشمل ما اختار العضو إنهاءه */
const leftoverOf = (items, invPhases) => items.filter(i => invPhases.has(i.Phase_ID) && !String(i.Allocation_Status).startsWith("Cancelled") && i.Allocation_Status !== "Carried_Forward"
  && i.Waitlist_Choice !== "cancel" && n(i.Requested_Qty) > Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)));
function acctCardHTML(a, opts) {
  const tone = a.net > 0.004 ? ["عليه", "rose"] : a.net < -0.004 ? ["له", "emerald"] : ["متزن", "slate"];
  return `<section class="rounded-2xl ring-1 ring-slate-200 bg-white p-3 mb-3"><div class="flex items-center justify-between gap-2 mb-2"><b class="text-[14px] text-slate-900">${ic("scale", "inline -mt-0.5")} ${opts.title || "حساب العضو"}</b><span class="pill pill-${tone[1] === "slate" ? "brand" : tone[1] === "rose" ? "red" : "green"}">${tone[0]}${tone[0] !== "متزن" ? " " + fmt(Math.abs(a.net)) + " ج.م" : ""}</span></div>
    <div class="grid grid-cols-3 gap-2 text-center"><div class="rounded-xl bg-rose-50 p-2"><div class="text-[11.5px] text-rose-700">${opts.due || "عليه (متبقي)"}</div><b class="num text-rose-700 text-[16px]">${fmt(a.alayh)}</b></div>
      <div class="rounded-xl bg-emerald-50 p-2"><div class="text-[11.5px] text-emerald-700">${opts.cr || "له (رصيد)"}</div><b class="num text-emerald-700 text-[16px]">${fmt(a.lah)}</b></div>
      <div class="rounded-xl bg-slate-50 p-2"><div class="text-[11.5px] text-slate-600">الصافي</div><b class="num text-[16px] ${a.net > 0 ? "text-rose-700" : a.net < 0 ? "text-emerald-700" : "text-slate-700"}">${fmt(Math.abs(a.net))}</b></div></div>
    ${opts.extra || ""}</section>`;
}
if (typeof epBody === "function") {
  const _epBody0 = epBody;
  epBody = function (id) {
    const d = A(), invs = d.empInvoices.filter(i => i.Emp_ID === id), a = acctOf(invs);
    const lo = leftoverOf(d.resItems.filter(i => i.Emp_ID === id), new Set(invs.map(i => i.Phase_ID)));
    const btns = [a.lah > 0 && a.alayh > 0 && can("TRANSFER_EMPLOYEE_CREDIT") ? `<button class="btn btn-primary btn-sm" data-act="settleCredit" data-id="${esc(id)}">${ic("arrow-left-right")} خصم الرصيد من المتبقي (${fmt(Math.min(a.lah, a.alayh))})</button>` : "",
      a.lah > 0 && !(a.alayh > 0) && can("REFUND_EMPLOYEE_CREDIT") ? `<span class="text-[12px] text-emerald-700">العضو له رصيد ومفيش عليه متبقي — ممكن «رد الرصيد» من الفواتير أو يُخصم من فاتورته الجاية.</span>` : "",
      lo.length ? `<button class="btn btn-outline btn-sm" data-act="printLeftover" data-id="${esc(id)}">${ic("printer")} طلب بالمتبقي (${lo.length})</button>` : ""].filter(Boolean).join("");
    return ((invs.length || lo.length) ? acctCardHTML(a, { extra: btns ? `<div class="flex flex-wrap items-center gap-2 mt-2.5">${btns}</div>` : "" }) : "") + _epBody0(id);
  };
}
on("settleCredit", async id => {
  const invs = A().empInvoices.filter(i => i.Emp_ID === id), from = invs.filter(i => n(i.Credit_Balance) > 0), to = invs.filter(i => n(i.Remaining_Balance) > 0).sort((x, y) => String(x.Issue_Date).localeCompare(String(y.Issue_Date)));
  const a = acctOf(invs), amt = Math.min(a.lah, a.alayh);
  if (!(await UI.confirm({ title: "تسوية رصيد العضو", message: `يُخصم ${fmt(amt)} ج.م من رصيده (له) ويُضاف سداداً على فواتيره المتبقية (عليه) — قيد داخلي بدون نقدية، ويظهر في كشف الحساب.`, ok: "سوّي الرصيد" }))) return;
  let done = 0; const cr = from.map(i => ({ id: i.Emp_Inv_ID, v: n(i.Credit_Balance) })), du = to.map(i => ({ id: i.Emp_Inv_ID, v: n(i.Remaining_Balance) }));
  for (const f of cr) for (const t of du) { const x = Math.min(f.v, t.v); if (x <= 0.004) continue;
    const r = await call("TRANSFER_EMPLOYEE_CREDIT", { fromInvId: f.id, toInvId: t.id, amount: Math.round(x * 100) / 100 }, { block: true });
    if (!r.success) { toast(r.message, "danger"); break; } f.v -= x; t.v -= x; done += x; }
  if (done) toast(`تمت تسوية ${fmt(done)} ج.م`, "success");
  await Admin.load(); const el = $("#epBody"); if (el) el.innerHTML = epBody(id);
});
/** طلب حجز بالمتبقي (الكتب التي لم تُخصَّص في مرحلتها) — جاهز للطباعة للمرحلة التالية */
on("printLeftover", id => {
  const d = A(), { e, b } = maps(), emp = e[id] || {}, invs = d.empInvoices.filter(i => i.Emp_ID === id);
  const lo = leftoverOf(d.resItems.filter(i => i.Emp_ID === id), new Set(invs.map(i => i.Phase_ID))); if (!lo.length) return toast("لا يوجد متبقي", "info");
  const ph = by(d.phases, "Phase_ID"), from = [...new Set(lo.map(i => (ph[i.Phase_ID] || {}).Phase_Name || i.Phase_ID))].join(" + ");
  const next = (d.phases.find(p => p.Phase_Status === "Open") || {}).Phase_Name || "المرحلة التالية";
  Doc.show("طلب بالمتبقي " + id, Doc.reservation({ title: "طلب حجز بالمتبقي", no: id + "-REM", date: new Date().toISOString(), phase: next, status: "متبقي",
    emp: { name: emp.Full_Name || id, id, dept: emp.Department, mobile: emp.Mobile },
    lines: lo.map(i => { const bk = b[i.Book_ID] || {}; return { code: i.Book_ID, name: bk.Book_Name, grade: bk.Grade, ben: i.Beneficiary, qty: n(i.Requested_Qty) - Math.max(n(i.Allocated_Qty), n(i.Delivered_Qty)), cover: bk.Cover_Price, price: bk.Emp_Selling_Price }; }),
    note: `• كتب حُجزت في «${esc(from)}» ولم تُسلَّم لعدم وصولها، وتُرحَّل إلى «${esc(next)}» بأسبقية الحجز الأصلية.<br>• الأسعار تقديرية وتُثبَّت عند التوزيع، ولا تدخل أي فاتورة سابقة.`,
    plan: { method: "", down: 0, count: 0, per: 0 } }), { file: "متبقي-" + id });
});

// ================================================================ صفحة المرتجعات (الإدارة): الطلبات المعلّقة + سجل القرارات + أذون المرتجع
ADMIN_NAV[3].items.push(["returns", "undo-2", "المرتجعات"]);
const RET = { tab: "pending", q: "" };
const rjson = i => { try { return JSON.parse(i.Return_Request || "null"); } catch (_) { return null; } };
on("retTab", t => { RET.tab = t; Router.render(); });
Router.add("/a/returns", view => {
  const d = A(), { e, b } = maps(), ph = by(d.phases, "Phase_ID"), win = n((d.settingsMap || {}).EMP_RETURN_WINDOW_DAYS) || 7;
  const reqs = d.resItems.map(i => ({ i, r: rjson(i) })).filter(x => x.r);
  const pend = reqs.filter(x => x.r.status === "Pending").sort((a, c) => String(a.r.at).localeCompare(String(c.r.at)));
  const done = reqs.filter(x => x.r.status !== "Pending").sort((a, c) => String(c.r.resolvedAt || "").localeCompare(String(a.r.resolvedAt || "")));
  const docs = d.deliveryReturns.filter(x => x.Doc_Type === "EMP_RETURN" || x.Doc_Type === "EMP_EXCHANGE").sort((a, c) => String(c.Trans_Date).localeCompare(String(a.Trans_Date)));
  const val = docs.reduce((s, x) => s + Math.abs(n(x.Total_Amount_Impact)), 0), qty = docs.filter(x => x.Doc_Type === "EMP_RETURN").reduce((s, x) => s + n(x.Qty), 0), exq = docs.filter(x => x.Doc_Type === "EMP_EXCHANGE").reduce((s, x) => s + n(x.Qty), 0);
  const kindPill = r => r.kind === "EXCHANGE" ? pill("", "استبدال", "blue") : pill("", "مرتجع", "amber");
  const late = r => (Date.now() - new Date(String(r.at).replace(" ", "T"))) / 864e5 > 2;
  done.forEach(x => (x.r.history || []).forEach(h => { if (h.status !== "Pending") done.push({ i: x.i, r: h, old: 1 }); }));
  const appr = done.filter(x => x.r.status === "Approved").length, rej = done.length - appr;
  const reasons = {}; reqs.forEach(x => { const k = String(x.r.reason || "بدون سبب").trim(); reasons[k] = (reasons[k] || 0) + 1; });
  const topR = Object.entries(reasons).sort((a, c) => c[1] - a[1]).slice(0, 4);
  const age = at => { const h = (Date.now() - new Date(String(at).replace(" ", "T"))) / 36e5; return isNaN(h) ? "" : h < 24 ? Math.max(1, Math.round(h)) + " ساعة" : Math.round(h / 24) + " يوم"; };
  const who = id => `${empLink(id, empName(e, id))} <span class="text-[11px] text-slate-400 num">${esc(id)}</span>`;
  const kpi = (l, v, t) => `<div class="card p-3"><div class="text-[12px] text-slate-500">${l}</div><b class="num text-[20px] ${t || "text-slate-900"}">${v}</b></div>`;
  const tab = (k, l, c) => `<button class="chip" data-act="retTab" data-id="${k}" aria-pressed="${RET.tab === k}">${l} <span class="num opacity-70">${fmt(c)}</span></button>`;
  const reqRow = x => { const i = x.i, r = x.r, bk = b[i.Book_ID] || {};
    return { i, r, bk, ph: (ph[i.Phase_ID] || {}).Phase_Name || i.Phase_ID, amt: n(r.qty) * n(i.Unit_Emp_Price) }; };
  let body = "";
  if (RET.tab === "pending") body = pend.length ? UI.table([
      { t: "الموظف", v: x => who(x.i.Emp_ID) },
      { t: "الكتاب", v: x => `<b>${esc(bookName(b, x.i.Book_ID))}</b><div class="text-[11.5px] text-slate-500">${esc(x.ph)}${x.i.Beneficiary ? " · لـ " + esc(x.i.Beneficiary) : ""}</div>` },
      { t: "العدد", cls: "num", v: x => fmt(x.r.qty) }, { t: "القيمة", cls: "num", v: x => `<b>${fmt(x.amt)}</b>` },
      { t: "النوع والسبب", v: x => `${kindPill(x.r)} ${esc(x.r.reason)}<div>${x.r.kind === "EXCHANGE" ? "" : x.r.condition === "DAMAGED" ? pill("", "فيه عيب", "red") : pill("", "سليم", "green")}</div>` },
      { t: "منذ", cls: "num whitespace-nowrap", v: x => `<span class="${late(x.r) ? "text-rose-600 font-bold" : ""}">${late(x.r) ? "⚠️ " : ""}${esc(age(x.r.at))}</span><div class="text-[11px] text-slate-400">${esc(dt(x.r.at))}</div>` },
      { t: "", actions: true, v: x => can("RESOLVE_RETURN_REQUEST") ? `<div class="inline-flex gap-1"><button class="btn btn-primary btn-xs" data-act="retRes" data-id="${esc(x.i.Res_Item_ID)}|1">${ic("check")} اعتماد</button><button class="btn btn-outline btn-xs" data-act="retRes" data-id="${esc(x.i.Res_Item_ID)}|0">رفض</button></div>` : "" }
    ], pend.map(reqRow)) : UI.empty("undo-2", "مفيش طلبات مرتجع معلّقة 👌", "أي طلب من الموظفين هيظهر هنا للاعتماد أو الرفض");
  else if (RET.tab === "log") body = done.length ? UI.table([
      { t: "الموظف", v: x => who(x.i.Emp_ID) },
      { t: "الكتاب", v: x => `<b>${esc(bookName(b, x.i.Book_ID))}</b><div class="text-[11.5px] text-slate-500">${esc(x.ph)}</div>` },
      { t: "العدد", cls: "num", v: x => fmt(x.r.qty) }, { t: "النوع والسبب", v: x => `${kindPill(x.r)} ${esc(x.r.reason)}${x.old ? ' <span class="text-[11px] text-slate-400">(طلب سابق)</span>' : ""}` },
      { t: "القرار", v: x => (x.r.status === "Approved" ? pill("", "معتمد", "green") : pill("", "مرفوض", "red")) + (x.r.note ? `<div class="text-[11.5px] text-slate-500 mt-0.5">${esc(x.r.note)}</div>` : "") },
      { t: "بواسطة", v: x => `${esc(x.r.by || "")}<div class="text-[11px] text-slate-400 num">${esc(dt(x.r.resolvedAt))}</div>` }
    ], done.map(reqRow)) : `<p class="text-center text-slate-500 py-8">لسه مفيش قرارات.</p>`;
  else body = docs.length ? UI.table([
      { t: "المستند", cls: "num", v: x => `${x.Doc_Type === "EMP_EXCHANGE" ? pill("", "استبدال", "blue") : pill("", "مرتجع", "amber")} <b>${esc(x.Printed_Receipt_No)}</b><div class="text-[11px] text-slate-400">${esc(dt(x.Trans_Date))}</div>` },
      { t: "الموظف", v: x => who(x.Party_ID) }, { t: "الكتاب", v: x => esc(bookName(b, x.Book_ID)) },
      { t: "العدد", cls: "num", v: x => fmt(x.Qty) }, { t: "القيمة", cls: "num", v: x => x.Doc_Type === "EMP_EXCHANGE" ? `<span class="text-slate-400 text-[12px]">بدون أثر مالي</span>` : `<b>${fmt(Math.abs(n(x.Total_Amount_Impact)))}</b>` },
      { t: "السبب", v: x => esc(x.Return_Reason || "") },
      { t: "", actions: true, v: x => `<button class="act-ic act-ic-edit" data-act="printDoc" data-id="${esc(x.Printed_Receipt_No)}" title="طباعة إذن المرتجع" aria-label="طباعة إذن المرتجع">${ic("printer")}</button>` }
    ], docs) : `<p class="text-center text-slate-500 py-8">لا توجد أذون مرتجع.</p>`;
  view.innerHTML = `${UI.pageHead ? UI.pageHead("المرتجعات", `طلبات الموظفين وقراراتها وأذون المرتجع — مدة المرتجع ${win} أيام من الاستلام`) : `<h1 class="text-[20px] font-extrabold mb-1">المرتجعات</h1><p class="text-[12.5px] text-slate-500 mb-3">مدة المرتجع ${win} أيام من الاستلام</p>`}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">${kpi("طلبات معلّقة" + (pend.filter(x => late(x.r)).length ? ` <span class="text-rose-600">(${pend.filter(x => late(x.r)).length} متأخر)</span>` : ""), fmt(pend.length), pend.length ? "text-amber-600" : "")}${kpi("معتمد / مرفوض", `${fmt(appr)} / ${fmt(rej)}`)}${kpi("مرتجع / استبدال", `${fmt(qty)} / ${fmt(exq)}`)}${kpi("قيمة المرتجع", fmt(val) + ' <span class="text-[12px] font-normal">ج.م</span>', "text-emerald-700")}</div>
    ${topR.length ? `<div class="card p-3 mb-3"><div class="text-[12.5px] font-bold text-slate-700 mb-1.5">أكثر أسباب المرتجع</div><div class="flex flex-wrap gap-1.5">${topR.map(([k, c]) => `<span class="rounded-full bg-slate-100 px-2.5 py-1 text-[12px]">${esc(k)} <b class="num">${c}</b></span>`).join("")}</div></div>` : ""}
    <div class="flex gap-1.5 overflow-x-auto pb-1 mb-3">${tab("pending", "معلّقة", pend.length)}${tab("log", "سجل القرارات", done.length)}${tab("docs", "أذون المرتجع", docs.length)}</div>${body}`;
});
