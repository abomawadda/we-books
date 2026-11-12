/* ============================================================================
 * المستندات الرسمية: طلب الحجز، الفاتورة، الإيصال، إذن التسليم، طلب التوريد
 * قوالب احترافية بمقاس A5 (وطلب التوريد A4) مع معاينة داخل التطبيق
 * وحفظ PDF (عبر الطباعة) أو صورة PNG.
 * ========================================================================== */
"use strict";
const Doc = {
  // ---------------------------------------------------------------- التنسيق
  css(size) {
    const A4 = size === "A4", W = A4 ? "210mm" : "148mm", H = A4 ? "297mm" : "210mm";
    return `
@page { size: ${size} portrait; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; }
body { font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif; color: #1e1b2e; background: #e7e5ee; direction: rtl; }
.page { width: ${W}; min-height: ${H}; margin: 14px auto; background: #fff; padding: ${A4 ? "14mm 13mm" : "9mm 9mm 8mm"}; position: relative; overflow: hidden; box-shadow: 0 6px 24px rgba(30,20,60,.18); display: flex; flex-direction: column; font-size: ${A4 ? "11pt" : "8.6pt"}; line-height: 1.55; }
@media print { body { background: #fff; } .page { margin: 0; box-shadow: none; page-break-after: always; break-after: page; } .page:last-child { page-break-after: auto; break-after: auto; } }
.band { position: absolute; inset: 0 0 auto 0; height: ${A4 ? "6mm" : "4.5mm"}; background: linear-gradient(90deg, #f9b224, #7c4bb6 35%, #3a2059); }
.wm { position: absolute; left: 50%; top: 55%; transform: translate(-50%,-50%) rotate(-24deg); font-size: ${A4 ? "64pt" : "44pt"}; font-weight: 800; color: rgba(85,44,131,.05); white-space: nowrap; pointer-events: none; }
.wm.red { color: rgba(225,29,72,.10); }
.hd { display: flex; justify-content: space-between; align-items: flex-start; gap: 4mm; margin-top: ${A4 ? "4mm" : "3mm"}; padding-bottom: 3mm; border-bottom: 1.4px solid #3a2059; }
.brand { display: flex; gap: 2.6mm; align-items: center; }
.logo { width: ${A4 ? "14mm" : "11mm"}; height: ${A4 ? "14mm" : "11mm"}; border-radius: 3mm; background: #3a2059; color: #f9b224; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: ${A4 ? "15pt" : "12pt"}; }
.org { font-weight: 800; font-size: ${A4 ? "13pt" : "10pt"}; color: #3a2059; line-height: 1.3; }
.org small { display: block; font-weight: 500; font-size: ${A4 ? "8.5pt" : "7pt"}; color: #6b6585; }
.dt { text-align: left; }
.dt .t { font-size: ${A4 ? "17pt" : "13pt"}; font-weight: 800; color: #3a2059; line-height: 1.2; }
.dt .n { font-size: ${A4 ? "9pt" : "7.6pt"}; color: #6b6585; margin-top: 1mm; direction: ltr; text-align: left; font-variant-numeric: tabular-nums; }
.meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; margin-top: 3mm; }
.box { border: 1px solid #e4def0; border-radius: 2.2mm; padding: 2mm 2.6mm; background: #fbfaff; }
.box h4 { margin: 0 0 1mm; font-size: ${A4 ? "8.5pt" : "7pt"}; color: #7c4bb6; font-weight: 700; }
.kv { display: flex; justify-content: space-between; gap: 2mm; }
.kv span:first-child { color: #6b6585; }
.kv b { font-weight: 700; }
table { width: 100%; border-collapse: collapse; margin-top: 3mm; }
th { background: #3a2059; color: #fff; font-weight: 600; font-size: ${A4 ? "9pt" : "7.4pt"}; padding: 1.6mm 1.8mm; text-align: right; }
th:first-child { border-radius: 0 1.6mm 0 0; } th:last-child { border-radius: 1.6mm 0 0 0; }
td { padding: 1.5mm 1.8mm; border-bottom: 1px solid #ece8f3; vertical-align: top; }
tr:nth-child(even) td { background: #faf8fd; }
td.c, th.c { text-align: center; } td.l, th.l { text-align: left; }
.num { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; white-space: nowrap; }
.sub { color: #6b6585; font-size: .86em; }
.grp td { background: #f3eefa !important; color: #552c83; font-weight: 700; font-size: .92em; }
.tot { margin-top: 3mm; display: grid; grid-template-columns: 1.15fr 1fr; gap: 3mm; align-items: start; }
.sum .kv { padding: .9mm 0; border-bottom: 1px dashed #e4def0; }
.sum .kv.big { border: 0; margin-top: 1mm; padding: 2mm 2.6mm; border-radius: 2mm; background: #3a2059; color: #fff; font-size: 1.12em; }
.sum .kv.big span:first-child { color: #e9dcff; }
.sum .kv.save { color: #047857; }
.words { margin-top: 2mm; font-size: .9em; color: #3a2059; background: #fff8e6; border: 1px solid #fde7a8; border-radius: 2mm; padding: 1.6mm 2.4mm; }
.note { margin-top: 2.5mm; font-size: .86em; color: #6b6585; line-height: 1.6; }
.badge { display: inline-block; padding: .4mm 2mm; border-radius: 9mm; font-size: .82em; font-weight: 700; background: #ede6f7; color: #552c83; }
.badge.g { background: #dcfce7; color: #047857; } .badge.r { background: #ffe4e6; color: #be123c; } .badge.a { background: #fef3c7; color: #b45309; }
.sig { margin-top: auto; padding-top: 6mm; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; text-align: center; font-size: .86em; color: #6b6585; }
.sig div { border-top: 1px solid #b9b0cc; padding-top: 1.2mm; }
.ft { margin-top: 3mm; padding-top: 2mm; border-top: 1px solid #ece8f3; display: flex; justify-content: space-between; font-size: ${A4 ? "7.6pt" : "6.4pt"}; color: #9b94b0; }
.big-amt { text-align: center; margin: 5mm 0 2mm; }
.big-amt .v { font-size: ${A4 ? "26pt" : "21pt"}; font-weight: 800; color: #3a2059; }
.big-amt .l { color: #6b6585; font-size: .9em; }
`;
  },

  // ---------------------------------------------------------------- أدوات
  title() { return (APP && APP.title) || "مبادرة الكتب الخارجية"; },
  money(v) { const x = Math.round(n(v) * 100) / 100; return x.toLocaleString("en-US", { minimumFractionDigits: x % 1 ? 2 : 0, maximumFractionDigits: 2 }); },
  date(v) { const s = String(v || ""); return s ? s.slice(0, 10) : new Date().toISOString().slice(0, 10); },
  now() { const d = new Date(), p = x => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; },
  /** المبلغ بالحروف (جنيه مصري) */
  words(v) {
    const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
    const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
    const hund = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
    const u999 = x => { const h = Math.floor(x / 100), r = x % 100, parts = []; if (h) parts.push(hund[h]); if (r) parts.push(r < 20 ? ones[r] : (r % 10 ? ones[r % 10] + " و" + tens[Math.floor(r / 10)] : tens[r / 10])); return parts.join(" و"); };
    const scale = (x, one, two, few, many) => x === 1 ? one : x === 2 ? two : x <= 10 ? u999(x) + " " + few : u999(x) + " " + many;
    const whole = Math.floor(Math.abs(n(v))), pt = Math.round((Math.abs(n(v)) - whole) * 100);
    if (!whole && !pt) return "صفر جنيه";
    const m = Math.floor(whole / 1e6), t = Math.floor(whole % 1e6 / 1000), r = whole % 1000, parts = [];
    if (m) parts.push(scale(m, "مليون", "مليونان", "ملايين", "مليون"));
    if (t) parts.push(scale(t, "ألف", "ألفان", "آلاف", "ألف"));
    if (r) parts.push(u999(r));
    let s = parts.join(" و") + (whole ? " جنيهاً" : "");
    if (pt) s += (whole ? " و" : "") + u999(pt) + " قرشاً";
    return "فقط " + s + " لا غير";
  },
  head(title, no, extra) {
    return `<div class="band"></div><div class="hd"><div class="brand"><div class="logo">ك</div><div class="org">${esc(Doc.title())}<small>نقابة العاملين · خصم وتقسيط للعاملين</small></div></div>
      <div class="dt"><div class="t">${esc(title)}</div><div class="n">${esc(no)}</div>${extra || ""}</div></div>`;
  },
  foot(no) { return `<div class="ft"><span>${esc(no)}</span><span>صدر إلكترونياً ${esc(Doc.now())} · we-books</span></div>`; },
  kv(k, v) { return `<div class="kv"><span>${k}</span><b>${v}</b></div>`; },
  page(inner, wm, wmCls) { return `<section class="page">${wm ? `<div class="wm ${wmCls || ""}">${esc(wm)}</div>` : ""}${inner}</section>`; },
  methodAr(m) { return ({ INSTALLMENT: "تقسيط", CASH: "نقدي", INSTAPAY: "إنستاباي", WALLET: "محفظة إلكترونية", PAYROLL: "خصم من المرتب" })[m] || ar(m) || "—"; },

  // ---------------------------------------------------------------- القوالب
  /** طلب حجز: d = {no,date,phase,status,emp:{name,id,dept,mobile},lines:[{code,name,grade,ben,qty,cover,price}],plan:{method,down,count,per,last}} */
  reservation(d) {
    const groups = {}; d.lines.forEach(l => (groups[l.ben || ""] = groups[l.ben || ""] || []).push(l));
    const keys = ["", ...Object.keys(groups).filter(Boolean)].filter(k => groups[k]);
    const cover = d.lines.reduce((s, l) => s + l.qty * n(l.cover), 0), net = d.lines.reduce((s, l) => s + l.qty * n(l.price), 0), cnt = d.lines.reduce((s, l) => s + l.qty, 0);
    let i = 0;
    const rows = keys.map(k => `${keys.length > 1 || k ? `<tr class="grp"><td colspan="6">${k ? "لـ " + esc(k) : "للعضو وأبنائه"}</td></tr>` : ""}${groups[k].map(l => `<tr><td class="c num">${++i}</td><td><b>${esc(l.name)}</b><div class="sub"><span class="num">${esc(l.code)}</span> · ${esc(l.grade || "")}</div></td><td class="c num">${l.qty}</td><td class="l num"><span class="sub">${Doc.money(l.cover)}</span></td><td class="l num">${Doc.money(l.price)}</td><td class="l num"><b>${Doc.money(l.qty * n(l.price))}</b></td></tr>`).join("")}`).join("");
    const p = d.plan || {};
    return Doc.page(`${Doc.head("طلب حجز كتب", d.no, `<div style="margin-top:1mm"><span class="badge ${d.status === "مؤكد" ? "g" : "a"}">${esc(d.status || "")}</span></div>`)}
      <div class="meta"><div class="box"><h4>بيانات العضو</h4>${Doc.kv("الاسم", esc(d.emp.name))}${Doc.kv("الرقم الوظيفي", `<span class="num">${esc(d.emp.id)}</span>`)}${d.emp.dept ? Doc.kv("جهة العمل", esc(d.emp.dept)) : ""}${d.emp.mobile ? Doc.kv("الموبايل", `<span class="num">${esc(d.emp.mobile)}</span>`) : ""}</div>
        <div class="box"><h4>بيانات الطلب</h4>${Doc.kv("المرحلة", esc(d.phase))}${Doc.kv("تاريخ الطلب", `<span class="num">${esc(Doc.date(d.date))}</span>`)}${Doc.kv("عدد الكتب", `<span class="num">${cnt}</span>`)}${Doc.kv("طريقة السداد", esc(Doc.methodAr(p.method)))}</div></div>
      <table><thead><tr><th class="c" style="width:6%">#</th><th>الكتاب</th><th class="c" style="width:9%">العدد</th><th class="l" style="width:13%">الغلاف</th><th class="l" style="width:13%">سعرك</th><th class="l" style="width:15%">القيمة</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tot"><div>${p.method === "INSTALLMENT" && p.count ? `<div class="box"><h4>خطة السداد المقترحة</h4>${Doc.kv("مقدم عند الاستلام", `<span class="num">${Doc.money(p.down)}</span>`)}${Doc.kv(`${p.count} أقساط شهرية`, `<span class="num">${Doc.money(p.per)}${p.last && p.last !== p.per ? " (الأخير " + Doc.money(p.last) + ")" : ""}</span>`)}</div>` : `<div class="box"><h4>السداد</h4><div>كامل القيمة عند استلام الكتب.</div></div>`}
        <div class="note">• الأسعار بعد خصم العاملين، وتُحتسب الأسبقية بوقت حجز كل كتاب.<br>• هذا طلب حجز وليس فاتورة؛ تصدر الفاتورة عند جاهزية الكتب للتسليم.</div></div>
        <div class="sum">${Doc.kv("بسعر الغلاف", `<span class="num sub">${Doc.money(cover)}</span>`)}<div class="kv save"><span>توفيرك</span><b class="num">${Doc.money(cover - net)}</b></div><div class="kv big"><span>الإجمالي (ج.م)</span><b class="num">${Doc.money(net)}</b></div></div></div>
      <div class="words">${esc(Doc.words(net))}</div>
      <div class="sig"><div>توقيع العضو</div><div>مسؤول المبادرة</div><div>الختم</div></div>${Doc.foot(d.no)}`, d.status === "ملغي" ? "ملغي" : "", "red");
  },
  /** فاتورة: d = {no,date,phase,status,emp,lines:[{code,name,grade,ben,alloc,deliv,ret,price,cover}],adj,adjReason,paid,remaining,credit,down,method,schedule:[{label,due,amount,paid,rem,status}],payments:[{no,date,amount,method}]} */
  invoice(d) {
    const lines = d.lines.filter(l => Math.max(l.alloc, l.deliv) - l.ret > 0);
    const gross = lines.reduce((s, l) => s + (Math.max(l.alloc, l.deliv) - l.ret) * n(l.price), 0), cover = lines.reduce((s, l) => s + (Math.max(l.alloc, l.deliv) - l.ret) * n(l.cover), 0);
    const net = Math.max(0, gross + n(d.adj));
    const st = { Paid_In_Full: ["مسددة بالكامل", "g"], Overdue: ["متأخرة", "r"], Partially_Paid: ["مسددة جزئياً", "a"], Unpaid: ["غير مسددة", "a"], Refund_Due: ["مستحق رد", "a"] }[d.status] || [ar(d.status), ""];
    let i = 0;
    const rows = lines.map(l => { const q = Math.max(l.alloc, l.deliv) - l.ret; return `<tr><td class="c num">${++i}</td><td><b>${esc(l.name)}</b><div class="sub"><span class="num">${esc(l.code)}</span> · ${esc(l.grade || "")}${l.ben ? " · لـ " + esc(l.ben) : ""}</div></td><td class="c num">${q}</td><td class="c num">${l.deliv - l.ret > 0 ? l.deliv - l.ret : "—"}</td><td class="l num">${Doc.money(l.price)}</td><td class="l num"><b>${Doc.money(q * n(l.price))}</b></td></tr>`; }).join("");
    const sched = (d.schedule || []).length ? `<table><thead><tr><th>القسط</th><th class="c">الاستحقاق</th><th class="l">القيمة</th><th class="l">المسدد</th><th class="c">الحالة</th></tr></thead><tbody>${d.schedule.map(s => `<tr><td>${esc(s.label)}</td><td class="c num">${esc(Doc.date(s.due))}</td><td class="l num">${Doc.money(s.amount)}</td><td class="l num">${Doc.money(s.paid)}</td><td class="c"><span class="badge ${s.status === "Paid" ? "g" : s.status === "Overdue" ? "r" : ""}">${esc(ar(s.status))}</span></td></tr>`).join("")}</tbody></table>` : "";
    return Doc.page(`${Doc.head("فاتورة بيع كتب", d.no, `<div style="margin-top:1mm"><span class="badge ${st[1]}">${esc(st[0])}</span></div>`)}
      <div class="meta"><div class="box"><h4>العميل</h4>${Doc.kv("الاسم", esc(d.emp.name))}${Doc.kv("الرقم الوظيفي", `<span class="num">${esc(d.emp.id)}</span>`)}${d.emp.dept ? Doc.kv("جهة العمل", esc(d.emp.dept)) : ""}</div>
        <div class="box"><h4>الفاتورة</h4>${Doc.kv("تاريخ الإصدار", `<span class="num">${esc(Doc.date(d.date))}</span>`)}${Doc.kv("المرحلة", esc(d.phase))}${Doc.kv("السداد", esc(Doc.methodAr(d.method)))}</div></div>
      <table><thead><tr><th class="c" style="width:6%">#</th><th>البيان</th><th class="c" style="width:8%">الكمية</th><th class="c" style="width:9%">سُلّم</th><th class="l" style="width:13%">السعر</th><th class="l" style="width:15%">الإجمالي</th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="c sub">لا بنود</td></tr>`}</tbody></table>
      <div class="tot"><div>${sched ? `<div style="font-weight:700;color:#3a2059;margin-top:1mm">جدول السداد</div>${sched}` : ""}${d.adj ? `<div class="note">• ${n(d.adj) < 0 ? "خصم" : "إضافة"} ${Doc.money(Math.abs(n(d.adj)))} ج.م: ${esc(d.adjReason || "")}</div>` : ""}</div>
        <div class="sum">${Doc.kv("بسعر الغلاف", `<span class="num sub">${Doc.money(cover)}</span>`)}${Doc.kv("قيمة الكتب", `<span class="num">${Doc.money(gross)}</span>`)}${d.adj ? Doc.kv(n(d.adj) < 0 ? "خصم" : "إضافة", `<span class="num">${Doc.money(d.adj)}</span>`) : ""}<div class="kv big"><span>الصافي (ج.م)</span><b class="num">${Doc.money(net)}</b></div>
          ${Doc.kv("المقدم المطلوب", `<span class="num">${Doc.money(d.down)}</span>`)}${Doc.kv("المسدد", `<span class="num">${Doc.money(d.paid)}</span>`)}<div class="kv" style="color:${n(d.remaining) ? "#be123c" : "#047857"}"><span>المتبقي</span><b class="num">${Doc.money(d.remaining)}</b></div>${n(d.credit) ? `<div class="kv save"><span>رصيد مستحق الرد</span><b class="num">${Doc.money(d.credit)}</b></div>` : ""}<div class="kv save"><span>وفّرت</span><b class="num">${Doc.money(cover - net)}</b></div></div></div>
      <div class="words">${esc(Doc.words(net))}</div>
      <div class="sig"><div>المستلم</div><div>أمين الصندوق</div><div>مسؤول المبادرة</div></div>${Doc.foot(d.no)}`, d.status === "Paid_In_Full" ? "مسددة" : "", "");
  },
  /** إيصال: d = {no,date,emp,amount,method,ref,inv,net,remaining,collector,voided,voidReason} */
  receipt(d) {
    const refund = n(d.amount) < 0;
    return Doc.page(`${Doc.head(refund ? "إيصال رد مبلغ" : "إيصال استلام نقدية", d.no)}
      <div class="big-amt"><div class="l">${refund ? "رُدّ إلى" : "استلمنا من"} السيد/ة</div><div style="font-size:1.35em;font-weight:800;margin:1mm 0">${esc(d.emp.name)} <span class="sub num">(${esc(d.emp.id)})</span></div>
        <div class="l">مبلغاً وقدره</div><div class="v num">${Doc.money(Math.abs(n(d.amount)))} <span style="font-size:.45em">ج.م</span></div></div>
      <div class="words" style="text-align:center">${esc(Doc.words(Math.abs(n(d.amount))))}</div>
      <div class="meta"><div class="box"><h4>تفاصيل السداد</h4>${Doc.kv("التاريخ", `<span class="num">${esc(String(d.date || "").slice(0, 16))}</span>`)}${Doc.kv("الوسيلة", esc(Doc.methodAr(d.method)))}${d.ref ? Doc.kv("رقم المرجع", `<span class="num">${esc(d.ref)}</span>`) : ""}${d.collector ? Doc.kv("المحصِّل", esc(d.collector)) : ""}</div>
        <div class="box"><h4>عن الفاتورة</h4>${Doc.kv("رقم الفاتورة", `<span class="num">${esc(d.inv || "—")}</span>`)}${Doc.kv("صافي الفاتورة", `<span class="num">${Doc.money(d.net)}</span>`)}${Doc.kv("المتبقي بعد السداد", `<b class="num" style="color:${n(d.remaining) ? "#be123c" : "#047857"}">${Doc.money(d.remaining)}</b>`)}</div></div>
      ${d.voided ? `<div class="words" style="background:#ffe4e6;border-color:#fecdd3;color:#be123c">هذا الإيصال ملغى: ${esc(d.voidReason || "")}</div>` : ""}
      <div class="sig" style="grid-template-columns:1fr 1fr"><div>توقيع ${refund ? "المستلم" : "المسدِّد"}</div><div>أمين الصندوق</div></div>${Doc.foot(d.no)}`, d.voided ? "ملغى" : "", "red");
  },
  /** إذن تسليم / مرتجع: d = {title,no,date,emp,lines:[{code,name,qty,ben}],note} */
  delivery(d) {
    let i = 0;
    return Doc.page(`${Doc.head(d.title, d.no)}
      <div class="meta"><div class="box"><h4>المستلم</h4>${Doc.kv("الاسم", esc(d.emp.name))}${Doc.kv("الرقم الوظيفي", `<span class="num">${esc(d.emp.id)}</span>`)}</div><div class="box"><h4>المستند</h4>${Doc.kv("التاريخ", `<span class="num">${esc(String(d.date || "").slice(0, 16))}</span>`)}${Doc.kv("عدد الكتب", `<span class="num">${d.lines.reduce((s, l) => s + n(l.qty), 0)}</span>`)}</div></div>
      <table><thead><tr><th class="c" style="width:7%">#</th><th>الكتاب</th><th class="c" style="width:12%">الكمية</th><th class="c" style="width:12%">✓</th></tr></thead><tbody>${d.lines.map(l => `<tr><td class="c num">${++i}</td><td><b>${esc(l.name)}</b><div class="sub num">${esc(l.code)}${l.ben ? " · لـ " + esc(l.ben) : ""}</div></td><td class="c num">${l.qty}</td><td class="c">☐</td></tr>`).join("")}</tbody></table>
      ${d.note ? `<div class="note">${esc(d.note)}</div>` : ""}<div class="note">أقر باستلام الكتب الموضحة أعلاه بحالة سليمة.</div>
      <div class="sig"><div>توقيع المستلم</div><div>أمين المخزن</div><div>مسؤول المبادرة</div></div>${Doc.foot(d.no)}`);
  },
  /** طلب توريد للمكتبة (A4): d = {no,date,phase,supplier:{name,contact,phone,terms,discount},lines:[{code,name,grade,publisher,qty,cover,disc,cost}],by} */
  purchaseOrder(d) {
    const total = d.lines.reduce((s, l) => s + l.qty * n(l.cost), 0), qty = d.lines.reduce((s, l) => s + l.qty, 0), cover = d.lines.reduce((s, l) => s + l.qty * n(l.cover), 0);
    let i = 0;
    return Doc.page(`${Doc.head("أمر توريد", d.no, `<div class="n">التاريخ: ${esc(Doc.date(d.date))}</div>`)}
      <div class="meta"><div class="box"><h4>إلى المورد</h4>${Doc.kv("المكتبة", esc(d.supplier.name))}${d.supplier.contact ? Doc.kv("المسؤول", esc(d.supplier.contact)) : ""}${d.supplier.phone ? Doc.kv("الهاتف", `<span class="num">${esc(d.supplier.phone)}</span>`) : ""}${d.supplier.terms ? Doc.kv("شروط الدفع", esc(d.supplier.terms)) : ""}</div>
        <div class="box"><h4>بيانات الأمر</h4>${Doc.kv("المرحلة", esc(d.phase))}${Doc.kv("عدد الأصناف", `<span class="num">${d.lines.length}</span>`)}${Doc.kv("إجمالي النسخ", `<span class="num">${qty}</span>`)}${Doc.kv("حرره", esc(d.by || "—"))}</div></div>
      <p style="margin:3mm 0 0">السادة/ ${esc(d.supplier.name)}، تحية طيبة وبعد،<br>نرجو التكرم بتوريد الكتب الموضحة أدناه وفق الأسعار والخصومات المتفق عليها:</p>
      <table><thead><tr><th class="c" style="width:5%">#</th><th style="width:11%">الكود</th><th>الكتاب</th><th style="width:13%">الصف</th><th class="c" style="width:8%">الكمية</th><th class="l" style="width:10%">الغلاف</th><th class="c" style="width:8%">الخصم</th><th class="l" style="width:10%">السعر</th><th class="l" style="width:12%">الإجمالي</th></tr></thead>
        <tbody>${d.lines.map(l => `<tr><td class="c num">${++i}</td><td class="num">${esc(l.code)}</td><td><b>${esc(l.name)}</b>${l.publisher ? `<div class="sub">${esc(l.publisher)}</div>` : ""}</td><td>${esc(l.grade || "")}</td><td class="c num"><b>${l.qty}</b></td><td class="l num">${Doc.money(l.cover)}</td><td class="c num">${n(l.disc) ? n(l.disc) + "%" : "—"}</td><td class="l num">${Doc.money(l.cost)}</td><td class="l num"><b>${Doc.money(l.qty * n(l.cost))}</b></td></tr>`).join("")}</tbody></table>
      <div class="tot"><div class="note">• التوريد خلال المدة المتفق عليها، مع فاتورة مفصلة بالأصناف والكميات.<br>• يُعاد ما يزيد أو يتلف وفق سياسة المرتجعات${d.supplier.returnDays ? " (" + d.supplier.returnDays + " يوماً)" : ""}.<br>• يُرجى الإشارة إلى رقم الأمر <span class="num">${esc(d.no)}</span> في الفاتورة.</div>
        <div class="sum">${Doc.kv("إجمالي بسعر الغلاف", `<span class="num">${Doc.money(cover)}</span>`)}${Doc.kv("إجمالي الخصم", `<span class="num">${Doc.money(cover - total)}</span>`)}<div class="kv big"><span>القيمة التقديرية (ج.م)</span><b class="num">${Doc.money(total)}</b></div></div></div>
      <div class="words">${esc(Doc.words(total))}</div>
      <div class="sig"><div>مسؤول المبادرة</div><div>المدير المالي</div><div>استلام المورد</div></div>${Doc.foot(d.no)}`);
  },

  // ---------------------------------------------------------------- المعاينة والحفظ
  /** يفتح معاينة داخل التطبيق مع: حفظ PDF/طباعة، حفظ صورة، مشاركة */
  show(title, pagesHtml, opts) {
    opts = opts || {};
    const size = opts.size || "A5", file = (opts.file || title).replace(/[\\/:*?"<>|]+/g, "-");
    const base = location.href.replace(/[#?].*$/, "").replace(/[^/]*$/, "");
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="${base}app.css"><style>${Doc.css(size)}</style></head><body>${pagesHtml}</body></html>`;
    const root = document.createElement("div");
    root.className = "fixed inset-0 z-[70] flex flex-col bg-ink-950/80 backdrop-blur-sm animate-fade-in";
    root.innerHTML = `<div class="flex items-center gap-2 px-3 py-2.5 bg-white shadow safe-t">
        <button data-x class="icon-btn" aria-label="إغلاق">${ic("x")}</button>
        <div class="flex-1 min-w-0 font-bold text-[15px] truncate">${esc(title)}</div>
        <button data-png class="btn btn-outline btn-sm">${ic("download")} صورة</button>
        <button data-pdf class="btn btn-primary btn-sm">${ic("printer")} PDF / طباعة</button></div>
      <div class="flex-1 overflow-auto"><iframe title="${esc(title)}" class="w-full border-0 block" style="height:100%"></iframe></div>`;
    document.body.appendChild(root);
    const fr = root.querySelector("iframe");
    const fit = () => { const doc = fr.contentDocument; if (!doc || !doc.body) return; const pw = size === "A4" ? 794 : 560; const z = Math.min(1, (fr.clientWidth - 12) / pw); doc.body.style.zoom = z; fr.style.height = Math.max(root.clientHeight - 60, doc.documentElement.scrollHeight * 1) + "px"; };
    fr.onload = () => setTimeout(fit, 150);
    fr.srcdoc = html;
    const close = () => { root.remove(); window.removeEventListener("resize", fit); };
    window.addEventListener("resize", fit);
    root.querySelector("[data-x]").onclick = close;
    root.querySelector("[data-pdf]").onclick = () => { const w = fr.contentWindow; w.document.body.style.zoom = 1; w.focus(); w.print(); setTimeout(fit, 500); };
    root.querySelector("[data-png]").onclick = async e => {
      const btn = e.currentTarget; btn.disabled = true;
      try {
        await Doc.lib();
        const doc = fr.contentDocument; doc.body.style.zoom = 1;
        const pages = [...doc.querySelectorAll(".page")];
        for (let k = 0; k < pages.length; k++) {
          const c = await window.html2canvas(pages[k], { scale: 2, backgroundColor: "#ffffff", useCORS: true, windowWidth: size === "A4" ? 900 : 640 });
          const a = document.createElement("a"); a.download = file + (pages.length > 1 ? "-" + (k + 1) : "") + ".png"; a.href = c.toDataURL("image/png"); document.body.appendChild(a); a.click(); a.remove();
        }
        toast("تم حفظ الصورة ✅", "success");
      } catch (err) { toast("تعذر حفظ الصورة، استخدم «PDF / طباعة».", "danger"); }
      finally { btn.disabled = false; fit(); }
    };
    return root;
  },
  lib() {
    if (window.html2canvas) return Promise.resolve();
    return Doc._lib || (Doc._lib = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"; s.onload = res; s.onerror = () => { Doc._lib = null; rej(new Error("lib")); }; document.head.appendChild(s); }));
  }
};
