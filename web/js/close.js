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
  const list = retReqs(); if (!list.length) return "";
  const { e, b } = maps();
  return `<div class="mt-4 sm:mt-6">${UI.section(`${ic("undo-2", "text-amber-500")} طلبات مرتجع (${fmt(list.length)})`, "الاعتماد يُدخل الكتاب المخزن ويخصم قيمته من فاتورة الموظف (الزيادة المدفوعة رصيد مستحق الرد)", `<ul class="divide-y divide-slate-100">${list.map(i => { const r = JSON.parse(i.Return_Request); return `<li class="flex flex-wrap items-center gap-2 py-2.5"><div class="flex-1 min-w-0"><div class="font-semibold text-[13.5px]">${empLink(i.Emp_ID, empName(e, i.Emp_ID))} · ${esc(bookName(b, i.Book_ID))}</div><div class="text-[12px] text-slate-500"><b class="num">${fmt(r.qty)}</b> نسخة · ${r.condition === "DAMAGED" ? "فيه عيب" : "سليم"} · ${esc(r.reason)} · <span class="num">${esc(String(r.at).slice(0, 16))}</span></div></div>
      <button class="btn btn-primary btn-xs" data-act="retRes" data-id="${esc(i.Res_Item_ID)}|1">${ic("check")} استلمت واعتمدت</button><button class="btn btn-outline btn-xs" data-act="retRes" data-id="${esc(i.Res_Item_ID)}|0">رفض</button></li>`; }).join("")}</ul>`)}</div>`;
}
on("retRes", async v => {
  const [id, ap] = v.split("|");
  const f = await UI.form({ title: ap === "1" ? "اعتماد المرتجع" : "رفض المرتجع", intro: ap === "1" ? "تأكد إنك استلمت الكتاب فعلاً. يُسجَّل إذن مرتجع ويدخل المخزن وتُخفَّض فاتورة الموظف." : "يبقى الكتاب مع الموظف وفاتورته كما هي.",
    fields: [...(ap === "1" ? [{ name: "condition", label: "حالة الكتاب عند الاستلام", type: "select", value: "GOOD", options: [["GOOD", "سليم"], ["DAMAGED", "تالف (يُستبعد من المخزن)"]] }] : []), { name: "note", label: "ملاحظة للموظف (اختياري)" }], ok: ap === "1" ? "اعتماد" : "رفض" });
  if (!f) return;
  await act("RESOLVE_RETURN_REQUEST", { resItemId: id, approve: ap === "1", condition: f.condition, note: f.note });
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
