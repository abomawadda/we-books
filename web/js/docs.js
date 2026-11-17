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
body { font-family: "Cairo", "Segoe UI", Tahoma, sans-serif; color: #1e1b2e; background: #e7e5ee; direction: rtl; }
.page { width: ${W}; min-height: ${H}; margin: 14px auto; background: #fff; padding: ${A4 ? "14mm 13mm" : "9mm 9mm 8mm"}; position: relative; overflow: hidden; box-shadow: 0 6px 24px rgba(30,20,60,.18); display: flex; flex-direction: column; font-size: ${A4 ? "11pt" : "8.6pt"}; line-height: 1.55; }
@media print { body { background: #fff; } .page { margin: 0; box-shadow: none; page-break-after: always; break-after: page; } .page:last-child { page-break-after: auto; break-after: auto; } }
.band { position: absolute; inset: 0 0 auto 0; height: ${A4 ? "6mm" : "4.5mm"}; background: linear-gradient(90deg, #f9b224, #7c4bb6 35%, #3a2059); }
.wm { position: absolute; left: 50%; top: 55%; transform: translate(-50%,-50%) rotate(-24deg); font-size: ${A4 ? "64pt" : "44pt"}; font-weight: 800; color: rgba(85,44,131,.05); white-space: nowrap; pointer-events: none; }
.wm.red { color: rgba(225,29,72,.10); }
.dt .t, .org, .big-amt .v, h4, th { font-family: "Cairo", sans-serif; font-weight: 700; }
.hd { display: flex; justify-content: space-between; align-items: center; gap: 4mm; margin-top: ${A4 ? "4mm" : "3mm"}; padding-bottom: 3mm; border-bottom: 1.4px solid #3a2059; }
.brand { display: flex; gap: 2.6mm; align-items: center; }
.lg { height: ${A4 ? "17mm" : "13mm"}; width: auto; object-fit: contain; }
.brand { flex: 1; justify-content: center; text-align: center; }
.logo { width: ${A4 ? "14mm" : "11mm"}; height: ${A4 ? "14mm" : "11mm"}; border-radius: 3mm; background: #3a2059; color: #f9b224; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: ${A4 ? "15pt" : "12pt"}; }
.org { font-weight: 800; font-size: ${A4 ? "13pt" : "10pt"}; color: #3a2059; line-height: 1.3; }
.org small { display: block; font-weight: 500; font-size: ${A4 ? "8.5pt" : "7pt"}; color: #6b6585; }
.dt { text-align: left; }
.dt .t { font-size: ${A4 ? "17pt" : "13pt"}; font-weight: 800; color: #3a2059; line-height: 1.2; }
.dt .n { font-size: ${A4 ? "9pt" : "7.6pt"}; color: #6b6585; margin-top: 1mm; direction: ltr; text-align: left; font-variant-numeric: tabular-nums; }
.meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; margin-top: 3mm; }
.box { border: 1px solid #d9cfe9; border-radius: 2.2mm; padding: 2mm 2.6mm; background: #fbfaff; }
.box h4 { margin: 0 0 1mm; font-size: ${A4 ? "8.5pt" : "7pt"}; color: #7c4bb6; font-weight: 700; }
.kv { display: flex; justify-content: space-between; gap: 2mm; }
.kv span:first-child { color: #6b6585; }
.kv b { font-weight: 700; }
/* جداول بحدود احترافية: إطار خارجي داكن، فواصل داخلية رفيعة، رأس ملوّن */
table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 3mm; border: 1.2px solid #3a2059; border-radius: 2mm; overflow: hidden; }
th { background: #3a2059; color: #fff; font-weight: 600; font-size: ${A4 ? "9pt" : "7.4pt"}; padding: var(--pad-y, 1.6mm) 1.8mm; text-align: right; border-left: 1px solid rgba(255,255,255,.18); }
td { padding: var(--pad-y, 1.5mm) 1.8mm; border-bottom: 1px solid #e4def0; border-left: 1px solid #ece8f3; vertical-align: middle; }
th:last-child, td:last-child { border-left: 0; }
tbody tr:last-child td { border-bottom: 0; }
tr:nth-child(even) td { background: #faf8fd; }
tfoot td { background: #f3eefa !important; font-weight: 700; border-top: 1.2px solid #3a2059; border-bottom: 0; }
/* كثافة تتكيف مع عدد الصفوف: قليلة ← مريحة، كثيرة ← مضغوطة */
.page.roomy { --pad-y: 2.6mm; } .page.roomy td { font-size: 1.04em; }
.page.dense { --pad-y: .9mm; font-size: ${A4 ? "9.6pt" : "7.6pt"}; line-height: 1.4; } .page.dense .sub { font-size: .8em; } .page.dense .sig { padding-top: 4mm; }
.page.xdense { --pad-y: .5mm; font-size: ${A4 ? "8.6pt" : "6.9pt"}; line-height: 1.3; } .page.xdense .sub { font-size: .82em; } .page.xdense .meta { gap: 1.5mm; } .page.xdense .box { padding: 1.2mm 2mm; } .page.xdense .strip div { padding: .4mm 1.2mm; } .page.xdense .sig { padding-top: 3mm; } .page.xdense .grp td { padding-top: .4mm; padding-bottom: .4mm; }
td.c, th.c { text-align: center; } td.l, th.l { text-align: left; }
.num { font-variant-numeric: tabular-nums; direction: ltr; unicode-bidi: isolate; white-space: nowrap; }
.sub { color: #6b6585; font-size: .86em; }
td.code { font-size: .86em; color: #4c3d73; white-space: nowrap; direction: ltr; text-align: center; }
td.info { color: #2e2648; line-height: 1.35; } td.info i { font-style: normal; color: #a39dbb; margin: 0 .6mm; }
td.bk b { font-weight: 700; color: #3b1d63; } td.bk .ben { font-size: .78em; color: #0369a1; font-weight: 700; }
.grp td { background: #f3eefa !important; color: #552c83; font-weight: 700; font-size: .92em; }
.tot-row td { background: #ede5f8 !important; color: #2e1650; border-top: 1.5px solid #6a3aa0; }
.strip { margin-top: 2mm; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1mm; }
.strip div { border: 1px solid #e4def0; border-radius: 1.4mm; padding: .8mm 1.6mm; display: flex; justify-content: space-between; align-items: baseline; gap: 1mm; font-size: .86em; }
.strip span { color: #6b6585; } .strip .big { background: #3a2059; border-color: #3a2059; color: #fff; } .strip .big span { color: #e9dcff; }
.strip .r b { color: #be123c; } .strip .g b { color: #047857; } .strip .m b { color: #6b6585; font-weight: 500; }
.strip-w { margin-top: 1mm; font-size: .8em; color: #3a2059; }
.tot { margin-top: 3mm; display: grid; grid-template-columns: 1.15fr 1fr; gap: 3mm; align-items: start; }
.sum .kv { padding: .9mm 0; border-bottom: 1px dashed #e4def0; }
.sum .kv.big { border: 0; margin-top: 1mm; padding: 2mm 2.6mm; border-radius: 2mm; background: #3a2059; color: #fff; font-size: 1.12em; }
.sum .kv.big span:first-child { color: #e9dcff; }
.sum .kv.save { color: #047857; }
.words { margin-top: 2mm; font-size: .9em; color: #3a2059; background: #fff8e6; border: 1px solid #fde7a8; border-radius: 2mm; padding: 1.6mm 2.4mm; }
.note { margin-top: 2.5mm; font-size: .86em; color: #6b6585; line-height: 1.6; }
.badge { white-space: nowrap; display: inline-block; padding: .4mm 2mm; border-radius: 9mm; font-size: .82em; font-weight: 700; background: #ede6f7; color: #552c83; }
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
    const b = Brand.get(), lg = k => `<img class="lg" src="${Brand.logoUrl(k)}" alt="" onerror="this.style.display='none'">`;
    return `<div class="band"></div><div class="hd">${lg("we")}<div class="brand"><div class="org">${esc(b.org)}<small>${esc(b.platform)}</small></div></div>
      <div class="dt"><div class="t">${esc(title)}</div><div class="n">${esc(no)}</div>${extra || ""}</div>${lg("union")}</div>`;
  },
  foot(no) { const b = Brand.get(); return `<div class="ft"><span>${esc(no)} · صدر إلكترونياً ${esc(Doc.now())}</span><span>${esc(b.credit || b.platform)}${b.phone ? " · " + esc(b.phone) : ""}</span></div>`; },
  /** فئة الكثافة حسب عدد الصفوف وحجم الصفحة */
  /** كثافة صفوف الفاتورة: قليلة ← مريحة، كثيرة ← مضغوطة (لتبقى في صفحة A5 واحدة قدر الإمكان) */
  invDensity(rows) { return rows <= 5 ? "roomy" : rows <= 9 ? "" : rows <= 15 ? "dense" : "xdense"; },
  density(rows, size) { const cap = size === "A4" ? [10, 22, 34] : [6, 12, 20]; return rows <= cap[0] ? "roomy" : rows <= cap[1] ? "" : rows <= cap[2] ? "dense" : "xdense"; },
  kv(k, v) { return `<div class="kv"><span>${k}</span><b>${v}</b></div>`; },
  page(inner, wm, wmCls, dens) { return `<section class="page ${dens || ""}">${wm ? `<div class="wm ${wmCls || ""}">${esc(wm)}</div>` : ""}${inner}</section>`; },
  methodAr(m) { return ({ INSTALLMENT: "تقسيط", CASH: "نقدي", INSTAPAY: "إنستاباي", WALLET: "محفظة إلكترونية", PAYROLL: "خصم من المرتب", CREDIT: "تسوية رصيد" })[m] || ar(m) || "—"; },

  // ---------------------------------------------------------------- القوالب
  /** بيانات الكتاب من الدليل المحمّل (الإدارة أو الموظف) لأعمدة الكود/الناشر/المادة/الصف */
  bk(code) { const list = (APP.adm && APP.adm.books) || (APP.emp && APP.emp.books) || []; if (Doc._bkSrc !== list) { Doc._bkSrc = list; Doc._bk = {}; list.forEach(b => { Doc._bk[b.Book_ID] = b; }); } return Doc._bk[code] || {}; },
  /** «الصف الرابع الابتدائي» ← «4 ابتدائي» لتوفير المساحة */
  shortGrade(v) { const ORD = { "الأول": 1, "الثاني": 2, "الثالث": 3, "الرابع": 4, "الخامس": 5, "السادس": 6 }; let t = String(v || "").replace(/^الصف\s+/, "");
    Object.keys(ORD).forEach(k => { t = t.replace(new RegExp("^" + k + "\\s+"), ORD[k] + " "); }); return t.replace(/\s+ال(ابتدائي|إعدادي|ثانوي)/, " $1"); },
  /** أعمدة الكتاب بلا تكرار: الكود | الناشر | المادة · الجزء · الصف (+ المستفيد) */
  bookCells(l, ben) {
    const b = Doc.bk(l.code), pub = l.publisher || b.Publisher, subj = l.subject || b.Subject;
    const parts = [subj, b.Book_Part, Doc.shortGrade(l.grade || b.Grade)].filter(Boolean);
    const info = pub || subj ? parts.map(v => `<bdi>${esc(v)}</bdi>`).join("<i>·</i>") : esc(l.name);
    return `<td class="code num">${esc(l.code)}</td><td class="bk"><b>${esc(pub || "—")}</b></td><td class="info">${info}${ben && l.ben ? `<div class="ben">لـ ${esc(l.ben)}</div>` : ""}</td>`;
  },
  bookHead: `<th class="c" style="width:11%">الكود</th><th style="width:22%">الناشر</th><th>المادة والصف</th>`,
  /** الترتيب: الناشر الأشهر أولاً (الأكثر كتباً وحجزاً في الدليل)، ثم المادة */
  pubRank() { const list = (APP.adm && APP.adm.books) || (APP.emp && APP.emp.books) || []; if (Doc._prSrc === list) return Doc._pr; const r = {}; list.forEach(b => { r[b.Publisher] = (r[b.Publisher] || 0) + 1 + n(b.Pop) * 3; }); Doc._prSrc = list; Doc._pr = r; return r; },
  sortLines(lines) { const r = Doc.pubRank(), k = l => { const b = Doc.bk(l.code); return [l.publisher || b.Publisher || "", l.subject || b.Subject || ""]; };
    return lines.slice().sort((x, y) => { const [px, sx] = k(x), [py, sy] = k(y); return (r[py] || 0) - (r[px] || 0) || px.localeCompare(py, "ar") || sx.localeCompare(sy, "ar"); }); },
  /** تنويه الكتب التي لم تصل (لا تدخل الفاتورة) وقرار العضو فيها */
  waitNote(lines) {
    const w = lines.filter(l => n(l.req) > Math.max(n(l.alloc), n(l.deliv)));
    if (!w.length) return "";
    const names = w.map(l => { const b = Doc.bk(l.code); const g = Doc.shortGrade ? Doc.shortGrade(b.Grade || l.grade || "") : (b.Grade || l.grade || ""); return `${esc(b.Publisher || l.name)} ${esc(b.Subject || "")}${g ? " " + esc(g) : ""}${l.ben ? " (" + esc(l.ben) + ")" : ""}`; }).join("، ");
    const ch = w.every(l => l.choice === "carry") ? "وافق العضو على ترحيلها للمرحلة التالية بأسبقيته." : "ستُضاف للمرحلة التالية بأسبقية الحجز، أو يُنهي العضو حجزه على المتاح.";
    return `<div class="words" style="background:#f0f9ff;border-color:#bae6fd;color:#075985">⏳ كتب لم تصل بعد ولا تدخل هذه الفاتورة: ${names}. ${ch}</div>`;
  },
  /** ملخص مضغوط في شبكة خلايا صغيرة: items = [[label, value, kind]] (kind: big|r|g|m) */
  sumStrip(items, words) {
    return `<div class="strip">${items.map(([l, v, k]) => `<div class="${k || ""}"><span>${esc(l)}</span><b class="num">${Doc.money(v)}</b></div>`).join("")}</div>${words ? `<div class="strip-w">${words}</div>` : ""}`;
  },
  /** طلب حجز: d = {no,date,phase,status,emp:{name,id,dept,mobile},lines:[{code,name,grade,ben,qty,cover,price}],plan:{method,down,count,per,last}} */
  reservation(d) {
    // التجميع: حسب الابن وصفه (l.grp) إن وُجد، وإلا حسب المستفيد
    const gk = l => l.grp !== undefined ? l.grp : (l.ben || "");
    const groups = {}; Doc.sortLines(d.lines).forEach(l => (groups[gk(l)] = groups[gk(l)] || []).push(l));
    const byGrp = d.lines.some(l => l.grp !== undefined);
    const keys = byGrp ? Object.keys(groups) : ["", ...Object.keys(groups).filter(Boolean)].filter(k => groups[k]);
    const cover = d.lines.reduce((s, l) => s + l.qty * n(l.cover), 0), net = d.lines.reduce((s, l) => s + l.qty * n(l.price), 0), cnt = d.lines.reduce((s, l) => s + l.qty, 0);
    let i = 0;
    const sub = k => { const g = groups[k], c = g.reduce((a, l) => a + l.qty, 0), v = g.reduce((a, l) => a + l.qty * n(l.price), 0); return `<span style="float:left">${booksWord(c).replace(/^(\d+)/, '<span class="num">$1</span>')} · <span class="num">${Doc.money(v)}</span> ج.م</span>`; };
    const rows = keys.map(k => `${byGrp ? `<tr class="grp"><td colspan="8">${esc(k)}${sub(k)}</td></tr>` : keys.length > 1 || k ? `<tr class="grp"><td colspan="8">${k ? "لـ " + esc(k) : "للعضو وأبنائه"}</td></tr>` : ""}${groups[k].map(l => `<tr><td class="c num">${++i}</td>${Doc.bookCells(l)}<td class="c num">${l.qty}</td><td class="l num"><span class="sub">${Doc.money(l.cover)}</span></td><td class="l num">${Doc.money(l.price)}</td><td class="l num"><b>${Doc.money(l.qty * n(l.price))}</b></td></tr>`).join("")}`).join("");
    const p = d.plan || {};
    return Doc.page(`${Doc.head(d.title || "طلب حجز كتب", d.no, `<div style="margin-top:1mm"><span class="badge ${d.status === "مؤكد" ? "g" : "a"}">${esc(d.status || "")}</span></div>`)}
      <div class="meta"><div class="box"><h4>بيانات العضو</h4>${Doc.kv("الاسم", esc(d.emp.name))}${Doc.kv("الرقم الوظيفي", `<span class="num">${esc(d.emp.id)}</span>`)}${d.emp.dept ? Doc.kv("جهة العمل", esc(d.emp.dept)) : ""}${d.emp.mobile ? Doc.kv("الموبايل", `<span class="num">${esc(d.emp.mobile)}</span>`) : ""}</div>
        <div class="box"><h4>بيانات الطلب</h4>${Doc.kv("المرحلة", esc(d.phase))}${Doc.kv("تاريخ الطلب", `<span class="num">${esc(Doc.date(d.date))}</span>`)}${Doc.kv("عدد الكتب", `<span class="num">${cnt}</span>`)}${Doc.kv("طريقة السداد", esc(Doc.methodAr(p.method)))}</div></div>
      <table><thead><tr><th class="c" style="width:5%">#</th>${Doc.bookHead}<th class="c" style="width:6%">العدد</th><th class="l" style="width:10%">قبل الخصم</th><th class="l" style="width:10%">سعرك</th><th class="l" style="width:11%">القيمة</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tot"><div>
        <div class="note">${d.note ? d.note : `• الأسعار بعد خصم العاملين، وتُحتسب الأسبقية بوقت حجز كل كتاب.<br>• هذا طلب حجز وليس فاتورة؛ تصدر الفاتورة عند جاهزية الكتب للتسليم.`}</div></div>
        <div class="sum">${Doc.kv("قبل الخصم", `<span class="num sub">${Doc.money(cover)}</span>`)}<div class="kv save"><span>توفيرك</span><b class="num">${Doc.money(cover - net)}</b></div><div class="kv big"><span>الإجمالي (ج.م)</span><b class="num">${Doc.money(net)}</b></div></div></div>
      <div class="words">${esc(Doc.words(net))}</div>
      <div class="pay-row">${/^فاتورة/.test(d.title || "") && d.status !== "ملغي" ? `<div class="insta-slot" data-amt=""></div>` : ""}<div class="sig"><div>توقيع العضو</div><div>مسؤول المبادرة</div><div>الختم</div></div></div>${Doc.foot(d.no)}`, d.status === "ملغي" ? "ملغي" : "", "red", Doc.density(d.lines.length + keys.length, "A5"));
  },
  /** فاتورة: d = {no,date,phase,status,emp,lines:[{code,name,grade,ben,alloc,deliv,ret,price,cover}],adj,adjReason,paid,remaining,credit,down,method,schedule:[{label,due,amount,paid,rem,status}],payments:[{no,date,amount,method}]} */
  invoice(d) {
    const lines = Doc.sortLines(d.lines.filter(l => Math.max(l.alloc, l.deliv) - l.ret > 0));
    const gross = lines.reduce((s, l) => s + (Math.max(l.alloc, l.deliv) - l.ret) * n(l.price), 0), cover = lines.reduce((s, l) => s + (Math.max(l.alloc, l.deliv) - l.ret) * n(l.cover), 0);
    const net = Math.max(0, gross + n(d.adj));
    const st = { Paid_In_Full: ["مسددة بالكامل", "g"], Overdue: ["متأخرة", "r"], Partially_Paid: ["مسددة جزئياً", "a"], Unpaid: ["غير مسددة", "a"], Refund_Due: ["مستحق رد", "a"] }[d.status] || [ar(d.status), ""];
    let i = 0;
    // تقسيم الفاتورة حسب الابن/المستفيد: صف عنوان (الاسم والصف والإجمالي الفرعي) ثم كتبه، وفي الآخر الإجمالي
    const qOf = l => Math.max(l.alloc, l.deliv) - l.ret, grp = {}, order = [];
    lines.forEach(l => { const k = l.ben || ""; if (!grp[k]) { grp[k] = []; order.push(k); } grp[k].push(l); });
    order.sort((a, b) => (a ? 1 : 0) - (b ? 1 : 0));
    const split = order.length > 1 || (order.length === 1 && order[0]);
    const gradeOf = ls => { const c = {}; ls.forEach(l => { const g = Doc.shortGrade(l.grade || Doc.bk(l.code).Grade); if (g) c[g] = (c[g] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || ""; };
    const row = l => { const q = qOf(l); return `<tr><td class="c num">${++i}</td>${Doc.bookCells(l, false)}<td class="c num">${q}</td><td class="c num">${l.deliv - l.ret > 0 ? l.deliv - l.ret : "—"}</td><td class="l num">${Doc.money(l.price)}</td><td class="l num"><b>${Doc.money(q * n(l.price))}</b></td></tr>`; };
    const rows = order.map(k => { const ls = grp[k], c = ls.reduce((a, l) => a + qOf(l), 0), v = ls.reduce((a, l) => a + qOf(l) * n(l.price), 0), g = gradeOf(ls);
      return (split ? `<tr class="grp"><td colspan="8">${k ? "👦 " + esc(k) : "👤 العضو"}${g ? ` <span style="font-weight:600;opacity:.8">— ${esc(g)}</span>` : ""}<span style="float:left">${booksWord(c).replace(/^(\d+)/, '<span class="num">$1</span>')} · <span class="num">${Doc.money(v)}</span> ج.م</span></td></tr>` : "") + ls.map(row).join(""); }).join("")
      + (split ? `<tr class="tot-row"><td colspan="4" style="text-align:right;font-weight:800">الإجمالي${order.length > 1 ? ` (${order.length} ${order.length > 2 ? "أفراد" : "فردين"})` : ""}</td><td class="c num"><b>${lines.reduce((a, l) => a + qOf(l), 0)}</b></td><td></td><td></td><td class="l num"><b>${Doc.money(gross)}</b></td></tr>` : "");
    // فاتورة قصيرة ← ملخص الإجماليات في شريط مضغوط لتكفي صفحة A5 واحدة؛ الطويلة تبقى بالتفصيل
    const rowsCount = lines.length + (split ? order.length + 1 : 0), compact = rowsCount <= 26;
    const sched = (d.schedule || []).length ? `<table><thead><tr><th>القسط</th><th class="c">الاستحقاق</th><th class="l">القيمة</th><th class="l">المسدد</th><th class="c">الحالة</th></tr></thead><tbody>${d.schedule.map(s => `<tr><td>${esc(s.label)}</td><td class="c num">${esc(Doc.date(s.due))}</td><td class="l num">${Doc.money(s.amount)}</td><td class="l num">${Doc.money(s.paid)}</td><td class="c"><span class="badge ${s.status === "Paid" ? "g" : s.status === "Overdue" ? "r" : ""}">${esc(ar(s.status))}</span></td></tr>`).join("")}</tbody></table>` : "";
    return Doc.page(`${Doc.head("فاتورة بيع كتب", d.no, `<div style="margin-top:1mm"><span class="badge ${st[1]}">${esc(st[0])}</span></div>`)}
      <div class="meta"><div class="box"><h4>العميل</h4>${Doc.kv("الاسم", esc(d.emp.name))}${Doc.kv("الرقم الوظيفي", `<span class="num">${esc(d.emp.id)}</span>`)}${d.emp.dept ? Doc.kv("جهة العمل", esc(d.emp.dept)) : ""}</div>
        <div class="box"><h4>الفاتورة</h4>${Doc.kv("تاريخ الإصدار", `<span class="num">${esc(Doc.date(d.date))}</span>`)}${Doc.kv("المرحلة", esc(d.phase))}${Doc.kv("السداد", esc(planIsInst(d) ? "تقسيط" + (d.count ? " (مقدم + " + d.count + " أقساط)" : "") : "كاش — مرة واحدة"))}</div></div>
      <table><thead><tr><th class="c" style="width:5%">#</th>${Doc.bookHead}<th class="c" style="width:6%">الكمية</th><th class="c" style="width:6%">سُلّم</th><th class="l" style="width:10%">السعر</th><th class="l" style="width:11%">الإجمالي</th></tr></thead><tbody>${rows || `<tr><td colspan="8" class="c sub">لا بنود</td></tr>`}</tbody></table>
      ${Doc.waitNote(d.lines)}
      ${compact ? Doc.sumStrip([["قبل الخصم", cover, "m"], ["قيمة الكتب", gross], ["الصافي", net, "big"], ...(planIsInst(d) ? [["المقدم المطلوب", d.down]] : []), ["المسدد", d.paid], ["المتبقي", d.remaining, n(d.remaining) ? "r" : "g"], ...(n(d.credit) ? [["مستحق الرد", d.credit, "g"]] : []), ["وفّرت", cover - net, "g"]],
        esc(Doc.words(net))) : `
      <div class="tot"><div>${d.adj ? `<div class="note">• ${n(d.adj) < 0 ? "خصم" : "إضافة"} ${Doc.money(Math.abs(n(d.adj)))} ج.م: ${esc(d.adjReason || "")}</div>` : ""}</div>
        <div class="sum">${Doc.kv("قبل الخصم", `<span class="num sub">${Doc.money(cover)}</span>`)}${Doc.kv("قيمة الكتب", `<span class="num">${Doc.money(gross)}</span>`)}${d.adj ? Doc.kv(n(d.adj) < 0 ? "خصم" : "إضافة", `<span class="num">${Doc.money(d.adj)}</span>`) : ""}<div class="kv big"><span>الصافي (ج.م)</span><b class="num">${Doc.money(net)}</b></div>
          ${planIsInst(d) ? Doc.kv("المقدم المطلوب", `<span class="num">${Doc.money(d.down)}</span>`) : ""}${Doc.kv("المسدد", `<span class="num">${Doc.money(d.paid)}</span>`)}<div class="kv" style="color:${n(d.remaining) ? "#be123c" : "#047857"}"><span>المتبقي</span><b class="num">${Doc.money(d.remaining)}</b></div>${n(d.credit) ? `<div class="kv save"><span>رصيد مستحق الرد</span><b class="num">${Doc.money(d.credit)}</b></div>` : ""}<div class="kv save"><span>وفّرت</span><b class="num">${Doc.money(cover - net)}</b></div></div></div>
      <div class="words">${esc(Doc.words(net))}</div>`}
      <div class="pay-row">${n(d.remaining) > 0 ? `<div class="insta-slot" data-amt="${Doc.money(d.remaining)}"></div>` : ""}<div class="sig"><div>المستلم</div><div>أمين الصندوق</div><div>مسؤول المبادرة</div></div></div>${Doc.foot(d.no)}`, d.status === "Paid_In_Full" ? "مسددة" : "", "", Doc.invDensity(rowsCount));
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
      <table><thead><tr><th class="c" style="width:5%">#</th>${Doc.bookHead}<th class="c" style="width:8%">الكمية</th><th class="c" style="width:6%">✓</th></tr></thead><tbody>${Doc.sortLines(d.lines).map(l => `<tr><td class="c num">${++i}</td>${Doc.bookCells(l, true)}<td class="c num">${l.qty}</td><td class="c">☐</td></tr>`).join("")}</tbody></table>
      ${d.note ? `<div class="note">${esc(d.note)}</div>` : ""}<div class="note">أقر باستلام الكتب الموضحة أعلاه بحالة سليمة.</div>
      <div class="sig"><div>توقيع المستلم</div><div>أمين المخزن</div><div>مسؤول المبادرة</div></div>${Doc.foot(d.no)}`, "", "", Doc.density(d.lines.length, "A5"));
  },
  /** طلب توريد للمكتبة (A4): d = {no,date,phase,supplier:{name,contact,phone,terms,discount},lines:[{code,name,grade,publisher,qty,cover,disc,cost}],by} */
  /** أمر توريد (A4) احترافي: مجمّع بالناشر (الأكثر حجزاً أولاً) ثم المادة ثم الصف، في عمودين يكمل أحدهما الآخر، بلا تكرار
   *  d = {no,date,phase,requester:{org,platform,name,phone},supplier:{name,contact,phone},lines:[{code,publisher,subject,part,grade,gradeRank,tracks,qty,pop}]} */
  purchaseOrder(d) {
    const qty = d.lines.reduce((x, l) => x + n(l.qty), 0);
    const SUBJ = ["عربي", "اللغة العربية", "إنجليزي", "اللغة الإنجليزية", "رياضيات", "ماث", "علوم", "ساينس", "دراسات", "دين", "تربية دينية", "فرنساوي", "ألماني", "حاسب آلي", "تكنولوجيا", "أي سي تي", "مهارات"];
    const sr = x => { const k = SUBJ.indexOf(String(x || "").trim()); return k < 0 ? 99 : k; };
    const by = {}; d.lines.forEach(l => { const k = l.publisher || "أخرى"; (by[k] = by[k] || { pop: 0, q: 0, l: [] }).l.push(l); by[k].pop += n(l.pop); by[k].q += n(l.qty); });
    const pubs = Object.keys(by).sort((a, b) => by[b].pop - by[a].pop || by[b].q - by[a].q || a.localeCompare(b, "ar"));
    // تقسيم دقيق: كل صفحة عمودان (يمين ثم يسار) بسعة ثابتة؛ المجموعة المقسومة تكمل بعنوان «تابع»
    const CAP1 = 36, CAP = 38; let i = 0;
    const cols = [[]]; let left = CAP1, pageCol = 0;
    const newCol = () => { cols.push([]); pageCol++; left = pageCol < 2 ? CAP1 : CAP; };
    pubs.forEach((pb, gi) => { const g = by[pb];
      g.l.sort((a, b) => sr(a.subject) - sr(b.subject) || String(a.subject).localeCompare(String(b.subject), "ar") || n(a.gradeRank) - n(b.gradeRank) || String(a.code).localeCompare(String(b.code)));
      if (left < 4) newCol();
      cols[cols.length - 1].push({ h: 1, pb, gi, g }); left -= 2;
      let prev = null;
      g.l.forEach(l => { if (left < 1) { newCol(); cols[cols.length - 1].push({ h: 1, pb, gi, g, cont: 1 }); left -= 2; prev = null; }
        cols[cols.length - 1].push({ l, n: ++i, nw: prev !== null && l.subject !== prev }); prev = l.subject; left -= 1; }); });
    const sumU = pubs.length + 12; if (left >= sumU) cols[cols.length - 1].push({ sum: 1 }); else if (left >= 7) cols[cols.length - 1].push({ sum: 2 }); // يستغل المساحة الفاضية فقط دون صفحة جديدة
    const sp = { name: "مكتبة الإيمان بالمنصورة", contact: "محمود العراقي", phone: "01550100025" }; // ثابت بطلب المستخدم (طلب التوريد فقط)
    const qr = (() => { try { const Q = window.qrcode; if (!Q) return ""; if (Q.stringToBytesFuncs && Q.stringToBytesFuncs["UTF-8"]) Q.stringToBytes = Q.stringToBytesFuncs["UTF-8"];
      const q = Q(0, "M"); q.addData(`BEGIN:VCARD\nVERSION:3.0\nFN:${sp.contact}\nORG:${d.no}\nTEL;TYPE=CELL:${sp.phone}\nNOTE:طلب توريد ${d.no} · ${d.phase || ""} · ${d.lines.length} صنف · ${qty} نسخة\nEND:VCARD`); q.make(); return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }); } catch (_) { return ""; } })();
    const sumHTML = qrOnly => `${qrOnly ? "" : `<table class="pog pos"><colgroup><col style="width:8%"><col><col style="width:16%"><col style="width:16%"></colgroup><tbody><tr class="pub"><td colspan="4">ملخص الطلبية</td></tr><tr class="ch"><td>م</td><td>الناشر</td><td>الأصناف</td><td>النسخ</td></tr>
      ${pubs.map((pb, k) => `<tr><td class="c num">${k + 1}</td><td>${esc(pb)}</td><td class="c num">${by[pb].l.length}</td><td class="c num q">${by[pb].q}</td></tr>`).join("")}
      <tr class="tt"><td></td><td>الإجمالي</td><td class="c num">${d.lines.length}</td><td class="c num">${qty}</td></tr></tbody></table>`}
      <div class="po-qr">${qr ? `<div class="qr">${qr}</div>` : ""}<div><b>للتواصل بخصوص الطلبية</b><div>${esc(sp.contact)}</div><div class="num">${esc(sp.phone)}</div><small>${qr ? "امسح الرمز لحفظ رقم المسؤول وبيانات الطلبية" : ""}</small><div class="num ref">${esc(d.no)}</div></div></div>`;
    const colHTML = items => { let html = "", open = false;
      items.forEach(it => { if (it.sum) { if (open) html += "</tbody></table>"; open = false; html += sumHTML(it.sum === 2); return; }
        if (it.h) { if (open) html += "</tbody></table>";
          html += `<table class="pog"><colgroup><col style="width:8%"><col style="width:16%"><col><col style="width:22%"><col style="width:12%"></colgroup><tbody><tr class="pub"><td colspan="5">${it.gi + 1}. ${esc(it.pb)}${it.cont ? " (تابع)" : ""}<span class="ps">${it.g.l.length} صنف · ${it.g.q} نسخة</span></td></tr><tr class="ch"><td>م</td><td>الكود</td><td>المادة</td><td>الصف</td><td>العدد</td></tr>`; open = true; return; }
        const l = it.l;
        html += `<tr${it.nw ? ' class="ns"' : ""}><td class="c num">${it.n}</td><td class="c num">${esc(l.code)}</td><td>${esc(l.subject || "")}${l.part ? ` (${esc(l.part)})` : ""}</td><td>${esc(l.grade || "")}${l.tracks ? ` - ${esc(l.tracks)}` : ""}</td><td class="c num q">${l.qty}</td></tr>`; });
      return html + (open ? "</tbody></table>" : ""); };
    const css = `<style>
      .po-top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #3b1d63;padding-bottom:2mm;margin-bottom:2.5mm;font-size:1.02em;line-height:1.55}
      .po-top .r b{font-size:1.18em;color:#3b1d63}.po-top .l{display:grid;grid-template-columns:auto auto;column-gap:3mm}.po-top .l span{color:#6b5f86}.po-top .l b{color:#3b1d63}
      .po-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm;align-items:start}.po-grid>div{min-width:0}
      .pog{width:100%;box-sizing:border-box;table-layout:fixed;border-collapse:separate;border-spacing:0;margin:0 0 2.5mm;border:1.2px solid #8b6fc0;border-radius:2.5mm;overflow:hidden;font-size:.88em}
      .pog td{border-left:.8px solid #d9cdea;border-bottom:.8px solid #d9cdea;padding:.85mm 1mm;line-height:1.2;vertical-align:middle;background:#fff}
      .pog td:last-child{border-left:0}.pog tr:last-child td{border-bottom:0}
      .pog tr:nth-child(even) td{background:#faf7fe}
      .pog .pub td{background:linear-gradient(90deg,#3b1d63,#6a3aa0);color:#fff;font-weight:800;border-left:0}
      .pog .ps{float:left;font-weight:600;font-size:.9em;opacity:.9}
      .pog .ch td{font-weight:700;text-align:center;background:#f3edfa;color:#4c1d95}
      .pog .q{font-weight:800;color:#3b1d63}
      .pog tr.ns td{border-top:1.6px solid #6a3aa0}
      .pog .tt td{background:#f3edfa;font-weight:800;color:#3b1d63;border-top:1.4px solid #6a3aa0}
      .po-qr{display:flex;gap:3mm;align-items:center;border:1.2px dashed #8b6fc0;border-radius:2.5mm;padding:2.5mm;margin-top:1mm;font-size:.92em;line-height:1.5}
      .po-qr .qr{width:24mm;height:24mm;flex:none}.po-qr .qr svg{width:100%;height:100%}.po-qr b{color:#3b1d63}.po-qr small{color:#6b5f86;display:block;line-height:1.3}.po-qr .ref{font-size:.8em;color:#8d84a3}
      .po-pg{text-align:center;font-size:.8em;color:#6b5f86;margin-top:auto;padding-top:1.5mm}
      @media print{
        .page{height:296mm!important;min-height:0!important;max-height:296mm;overflow:hidden!important;break-inside:avoid}.po-grid{flex:1;min-height:0}
        .po-top,.po-top .r b,.po-top .l b,.po-top .l span{color:#000!important;border-color:#000!important}
        .pog{border-color:#000!important}.pog td{border-color:#555!important;background:#fff!important;color:#000!important}
        .pog .pub td{background:#e6e6e6!important;color:#000!important;border-bottom-color:#000!important}
        .pog .ch td{background:#f2f2f2!important}.pog tr.ns td{border-top:1.6px solid #000!important}.pog .tt td{background:#eee!important;border-top-color:#000!important}.po-qr{border-color:#000!important}.po-qr b,.po-qr small{color:#000!important}
      }
    </style>`;
    const pairs = []; for (let k = 0; k < cols.length; k += 2) pairs.push([cols[k], cols[k + 1] || []]);
    const top = `<div class="po-top"><div class="r"><b>${esc(sp.name || "")}</b>${sp.contact ? `<div>${esc(sp.contact)}</div>` : ""}${sp.phone ? `<div class="num">${esc(sp.phone)}</div>` : ""}</div>
      <div class="l"><span>رقم الطلبية:</span><b class="num">${esc(d.no)}</b><span>المرحلة:</span><b>${esc(d.phase || "")}</b><span>تاريخ الطلبية:</span><b class="num">${esc(Doc.date(d.date))}</b><span>الإجمالي:</span><b><bdi class="num">${d.lines.length}</bdi> صنف · <bdi class="num">${qty}</bdi> نسخة</b></div></div>`;
    return pairs.map((pr, pi) => Doc.page(`${css}${top}
      <div class="po-grid"><div>${colHTML(pr[0])}</div><div>${colHTML(pr[1])}</div></div>
      <div class="po-pg num">${pairs.length > 1 ? `صفحة ${pi + 1} من ${pairs.length}` : ""}</div>`, "", "", "")).join("");
  },
  /** فاتورة توريد مكتبة (A4): d = {ref,no,date,phase,status,supplier,volPct,volAmt,afterFirst,net,damaged,stated,variance,by,lines:[{code,name,ord,rec,dmg,cover,disc,unit,total,flag,mismatch}]} */
  supplierInvoice(d) {
    let i = 0;
    const rows = d.lines.map(l => `<tr><td class="c num">${++i}</td><td class="code num">${esc(l.code)}</td><td><b>${esc(l.name)}</b>${l.mismatch ? ` <span class="badge a">سعر مختلف</span>` : ""}${l.meta ? `<div class="sub">${esc(l.meta)}</div>` : ""}</td>
      <td class="c num">${l.ord}</td><td class="c num"><b>${l.rec}</b></td><td class="c num">${l.dmg || "—"}</td>
      <td class="l num">${Doc.money(l.cover)}</td><td class="c num">${Doc.money(l.disc)}%</td><td class="l num">${Doc.money(l.unit)}</td><td class="l num"><b>${Doc.money(l.total)}</b></td></tr>`).join("");
    return Doc.page(`${Doc.head("فاتورة توريد وجرد", d.ref, `<div style="margin-top:1mm"><span class="badge ${d.status === "Voided" ? "r" : d.status === "Approved_With_Variance" ? "a" : "g"}">${esc(ar(d.status))}</span></div>`)}
      <div class="meta"><div class="box"><h4>المكتبة</h4>${Doc.kv("الاسم", esc(d.supplier))}${Doc.kv("رقم فاتورة المكتبة", `<span class="num">${esc(d.no)}</span>`)}</div>
        <div class="box"><h4>بيانات الاعتماد</h4>${Doc.kv("المرحلة", esc(d.phase))}${Doc.kv("التاريخ", `<span class="num">${esc(Doc.date(d.date))}</span>`)}${d.by ? Doc.kv("المُعتمد", esc(d.by)) : ""}</div></div>
      <table><thead><tr><th class="c" style="width:4%">#</th><th class="c" style="width:10%">الكود</th><th>الكتاب</th><th class="c" style="width:6%">مطلوب</th><th class="c" style="width:6%">سليم</th><th class="c" style="width:6%">تالف</th><th class="l" style="width:9%">قبل الخصم</th><th class="c" style="width:6%">خصم</th><th class="l" style="width:9%">التكلفة</th><th class="l" style="width:10%">الإجمالي</th></tr></thead>
        <tbody>${rows}</tbody></table>
      <div class="tot"><div>${n(d.variance) ? `<div class="note">• فرق مع صافي المكتبة (${Doc.money(d.stated)} ج.م): <b class="num">${Doc.money(d.variance)}</b> ج.م</div>` : ""}</div>
        <div class="sum">${Doc.kv("بعد خصم الأصناف", `<span class="num">${Doc.money(d.afterFirst)}</span>`)}${Doc.kv(`خصم الكمية (${Doc.money(d.volPct)}%)`, `<span class="num">− ${Doc.money(d.volAmt)}</span>`)}${n(d.damaged) ? Doc.kv("مطالبة تالف", `<span class="num" style="color:#be123c">${Doc.money(d.damaged)}</span>`) : ""}<div class="kv big"><span>الصافي المستحق (ج.م)</span><b class="num">${Doc.money(d.net)}</b></div></div></div>
      <div class="words">${esc(Doc.words(d.net))}</div>
      <div class="sig"><div>أمين المخزن</div><div>المدير المالي</div><div>مسؤول المبادرة</div></div>${Doc.foot(d.ref)}`, d.status === "Voided" ? "ملغاة" : "", "red", Doc.density(d.lines.length, "A4"));
  },

  /** كشف مرتجع نهائي للمكتبة: d = {no,date,phase,by,supplier,phone,lines:[{code,name,meta,qty,cover,disc,unit,after,vol,net}],groups:[{vol,after,amt,net}],cover,after,volAmt,net,balBefore,balAfter} */
  supplierReturn(d) {
    let i = 0;
    const rows = d.lines.map(l => `<tr><td class="c num">${++i}</td><td class="code num">${esc(l.code)}</td><td><b>${esc(l.name)}</b>${l.meta ? `<div class="sub">${esc(l.meta)}</div>` : ""}</td>
      <td class="c num"><b>${l.qty}</b></td><td class="l num">${Doc.money(l.cover)}</td><td class="c num">${Doc.money(l.disc)}%</td><td class="l num">${Doc.money(l.unit)}</td><td class="l num">${Doc.money(l.after)}</td><td class="c num">${Doc.money(l.vol)}%</td><td class="l num"><b>${Doc.money(l.net)}</b></td></tr>`).join("");
    const qty = d.lines.reduce((a, l) => a + l.qty, 0);
    const bal = v => Math.abs(v) < 0.005 ? "متصفّي" : (v > 0 ? "للمكتبة " : "على المكتبة ") + Doc.money(Math.abs(v));
    return Doc.page(`${Doc.head("إذن مرتجع نهائي للمكتبة", d.no, `<div style="margin-top:1mm"><span class="badge g">تصفية حساب</span></div>`)}
      <div class="meta"><div class="box"><h4>المكتبة (المستلِم)</h4>${Doc.kv("الاسم", esc(d.supplier))}${d.phone ? Doc.kv("الهاتف", `<span class="num">${esc(d.phone)}</span>`) : ""}${Doc.kv("عدد الأصناف / النسخ", `<span class="num">${d.lines.length} / ${qty}</span>`)}</div>
        <div class="box"><h4>بيانات الإذن</h4>${Doc.kv("التاريخ", `<span class="num">${esc(Doc.date(d.date))}</span>`)}${d.phase ? Doc.kv("المرحلة", esc(d.phase)) : ""}${d.by ? Doc.kv("حُرِّر بمعرفة", esc(d.by)) : ""}</div></div>
      <table><thead><tr><th class="c" style="width:4%">#</th><th class="c" style="width:9%">الكود</th><th>الكتاب</th><th class="c" style="width:5%">عدد</th><th class="l" style="width:8%">الغلاف</th><th class="c" style="width:6%">خصم الصنف</th><th class="l" style="width:8%">صافي النسخة</th><th class="l" style="width:9%">بعد خصم الصنف</th><th class="c" style="width:6%">خصم الكمية</th><th class="l" style="width:10%">الصافي</th></tr></thead>
        <tbody>${rows}</tbody></table>
      <div class="tot"><div><div class="note">• طريقة الحساب: سعر الغلاف − خصم المكتبة لكل صنف (من فاتورة التوريد الأصلية)، ثم خصم الكمية بنسبة فاتورة الطلبية على <b>إجمالي</b> كتب الإذن وليس لكل صنف.</div>
          ${d.groups.length > 1 ? d.groups.map(g => `<div class="note">• خصم كمية <span class="num">${Doc.money(g.vol)}%</span> على <span class="num">${Doc.money(g.after)}</span> = <span class="num">${Doc.money(g.amt)}</span></div>`).join("") : ""}
          ${d.balBefore !== undefined ? `<div class="note">• حساب المكتبة قبل الإذن: <b class="num">${bal(d.balBefore)}</b> — وبعده: <b class="num">${bal(d.balAfter)}</b> ج.م</div>` : ""}</div>
        <div class="sum">${Doc.kv("إجمالي الغلاف", `<span class="num sub">${Doc.money(d.cover)}</span>`)}${Doc.kv("بعد خصم الأصناف", `<span class="num">${Doc.money(d.after)}</span>`)}${Doc.kv(d.groups.length > 1 ? "خصم الكمية" : `خصم الكمية (${Doc.money((d.groups[0] || {}).vol)}%)`, `<span class="num">− ${Doc.money(d.volAmt)}</span>`)}<div class="kv big"><span>صافي المرتجع — يُخصم من حساب المكتبة (ج.م)</span><b class="num">${Doc.money(d.net)}</b></div></div></div>
      <div class="words">${esc(Doc.words(d.net))}</div>
      <div class="sig"><div>أمين المخزن (المُسلِّم)</div><div>مندوب المكتبة (المستلِم)</div><div>المدير المالي</div></div>${Doc.foot(d.no)}`, "", "", Doc.density(d.lines.length, "A4"));
  },

  /** كشف حساب المكتبة: d = {supplier,phone,from,to,lines:[{date,type,ref,notes,dr,cr,bal}],groups:[[label,dr,cr]],dr,cr,bal} — صفحات A4 متعددة */
  supplierStatement(d) {
    const balTxt = v => Math.abs(v) < 0.005 ? "متصفّي" : `<span style="color:${v > 0 ? "#be123c" : "#047857"}">${Doc.money(Math.abs(v))} ${v > 0 ? "لها" : "عليها"}</span>`;
    const PER = 24, chunks = []; for (let k = 0; k < Math.max(1, d.lines.length); k += PER) chunks.push(d.lines.slice(k, k + PER));
    let i = 0;
    const head = `<div class="meta"><div class="box"><h4>المكتبة</h4>${Doc.kv("الاسم", esc(d.supplier))}${d.phone ? Doc.kv("الهاتف", `<span class="num">${esc(d.phone)}</span>`) : ""}</div>
      <div class="box"><h4>الفترة</h4>${Doc.kv("من", `<span class="num">${esc(d.from || "—")}</span>`)}${Doc.kv("إلى", `<span class="num">${esc(d.to || "—")}</span>`)}${Doc.kv("عدد الحركات", `<span class="num">${d.lines.length}</span>`)}</div></div>`;
    return chunks.map((ls, ci) => Doc.page(`${Doc.head("كشف حساب المكتبة", "STM-" + (d.to || ""))}${ci === 0 ? head : ""}
      <table><thead><tr><th class="c" style="width:4%">#</th><th class="c" style="width:10%">التاريخ</th><th style="width:15%">البند</th><th>البيان</th><th class="c" style="width:11%">المرجع</th><th class="l" style="width:10%">مدين</th><th class="l" style="width:10%">دائن</th><th class="l" style="width:13%">الرصيد</th></tr></thead>
        <tbody>${ci === 0 ? `<tr><td></td><td colspan="6"><b>رصيد أول المدة</b></td><td class="l num">${balTxt(0)}</td></tr>` : ""}${ls.map(l => `<tr><td class="c num">${++i}</td><td class="c num">${esc(l.date)}</td><td><b>${esc(l.type)}</b></td><td><div class="sub" style="font-size:.95em">${esc(l.notes || "")}</div></td><td class="c num">${esc(l.ref || "")}</td><td class="l num">${l.dr ? Doc.money(l.dr) : ""}</td><td class="l num">${l.cr ? Doc.money(l.cr) : ""}</td><td class="l num"><b>${balTxt(l.bal)}</b></td></tr>`).join("")}
        ${ci === chunks.length - 1 ? `<tr class="tot-row"><td colspan="5" style="text-align:right;font-weight:800">الإجمالي</td><td class="l num"><b>${Doc.money(d.dr)}</b></td><td class="l num"><b>${Doc.money(d.cr)}</b></td><td class="l num"><b>${balTxt(d.bal)}</b></td></tr>` : ""}</tbody></table>
      ${ci === chunks.length - 1 ? `<div class="tot"><div><div class="note">• <b>دائن</b> = يزوّد المستحق للمكتبة (فواتير التوريد، عكس المطالبات) — <b>مدين</b> = ينزل منه (الدفعات، المرتجع النهائي، مطالبات التالف، إلغاء الفواتير).</div>
          <div class="note">• الرصيد الموجب «لها» = مستحق للمكتبة علينا، و«عليها» = مستحق لنا على المكتبة.</div></div>
        <div class="sum">${d.groups.map(([t, dr, cr]) => Doc.kv(esc(t), `<span class="num">${cr ? "+ " + Doc.money(cr) : "− " + Doc.money(dr)}</span>`)).join("")}<div class="kv big"><span>${Math.abs(d.bal) < 0.005 ? "الحساب متصفّي" : d.bal > 0 ? "الرصيد المستحق للمكتبة" : "الرصيد المستحق على المكتبة"} (ج.م)</span><b class="num">${Doc.money(Math.abs(d.bal))}</b></div></div></div>
      <div class="words">${esc(Doc.words(Math.abs(d.bal)))}</div>
      <div class="sig"><div>المحاسب</div><div>المدير المالي</div><div>مندوب المكتبة (للمطابقة)</div></div>` : ""}${Doc.foot("كشف حساب " + d.supplier)}`, "", "", "dense")).join("");
  },
  /** الكشف النهائي الشامل للمرتجعات: d = {pool:{emp,free,merge,ret}, empRet:{docs,qty,amt}, docs:[{no,date,lines:[{code,name,meta,qty,cover,disc,unit,after,vol,net}],after,volAmt,net}], qty, cover, after, volAmt, net, poolRows:[{code,name,emp,free,merge,ret}]} */
  returnsReport(d) {
    let i = 0;
    const rows = d.docs.map(x => `<tr class="grp"><td colspan="9">إذن <span class="num">${esc(x.no)}</span> · <span class="num">${esc(Doc.date(x.date))}</span><span style="float:left">صافي <span class="num">${Doc.money(x.net)}</span> ج.م</span></td></tr>`
      + x.lines.map(l => `<tr><td class="c num">${++i}</td><td class="code num">${esc(l.code)}</td><td><b>${esc(l.name)}</b>${l.meta ? `<div class="sub">${esc(l.meta)}</div>` : ""}</td><td class="c num">${l.qty}</td><td class="l num">${Doc.money(l.cover)}</td><td class="c num">${Doc.money(l.disc)}%</td><td class="l num">${Doc.money(l.after)}</td><td class="c num">${Doc.money(l.vol)}%</td><td class="l num"><b>${Doc.money(l.net)}</b></td></tr>`).join("")).join("");
    const pool = d.poolRows.length ? `<h4 style="margin:3mm 0 1mm">المخزون الحر الآن (بعد المرتجعات)</h4><table><thead><tr><th class="c" style="width:10%">الكود</th><th>الكتاب</th><th class="c">رجّعها موظفين</th><th class="c">حر بالمخزن</th><th class="c">هتتدمج في حجوزات</th><th class="c">متاح لمرتجع نهائي</th></tr></thead><tbody>${d.poolRows.map(r => `<tr><td class="code num">${esc(r.code)}</td><td>${esc(r.name)}</td><td class="c num">${r.emp}</td><td class="c num">${r.free}</td><td class="c num">${r.merge}</td><td class="c num"><b>${r.ret}</b></td></tr>`).join("")}</tbody></table>` : "";
    return Doc.page(`${Doc.head("الكشف النهائي الشامل للمرتجعات", "RET-ALL-" + Doc.date())}
      <div class="meta"><div class="box"><h4>مرتجعات الموظفين (تعود للمخزن)</h4>${Doc.kv("عدد الأذون", `<span class="num">${d.empRet.docs}</span>`)}${Doc.kv("النسخ", `<span class="num">${d.empRet.qty}</span>`)}${Doc.kv("خُصم من فواتيرهم", `<span class="num">${Doc.money(d.empRet.amt)}</span>`)}</div>
        <div class="box"><h4>المرتجع النهائي للمكتبة</h4>${Doc.kv("عدد الأذون", `<span class="num">${d.docs.length}</span>`)}${Doc.kv("النسخ", `<span class="num">${d.qty}</span>`)}${Doc.kv("نزل من حساب المكتبة", `<b class="num">${Doc.money(d.net)}</b>`)}</div></div>
      <div class="strip">${[["رجّعها موظفين", d.pool.emp], ["حر بالمخزن", d.pool.free], ["هتتدمج في حجوزات", d.pool.merge], ["متاح لمرتجع نهائي", d.pool.ret]].map(([l, v]) => `<div><span>${l}</span><b class="num">${v}</b></div>`).join("")}</div>
      ${d.docs.length ? `<table><thead><tr><th class="c" style="width:4%">#</th><th class="c" style="width:9%">الكود</th><th>الكتاب</th><th class="c" style="width:5%">عدد</th><th class="l" style="width:8%">الغلاف</th><th class="c" style="width:7%">خصم الصنف</th><th class="l" style="width:10%">بعد خصم الصنف</th><th class="c" style="width:7%">خصم الكمية</th><th class="l" style="width:10%">الصافي</th></tr></thead><tbody>${rows}
        <tr class="tot-row"><td colspan="3" style="text-align:right;font-weight:800">الإجمالي</td><td class="c num"><b>${d.qty}</b></td><td class="l num">${Doc.money(d.cover)}</td><td></td><td class="l num">${Doc.money(d.after)}</td><td class="l num">− ${Doc.money(d.volAmt)}</td><td class="l num"><b>${Doc.money(d.net)}</b></td></tr></tbody></table>
        <div class="words">إجمالي المرتجع النهائي: ${esc(Doc.words(d.net))}</div>` : `<div class="note" style="margin:3mm 0">لم يُسجَّل مرتجع نهائي للمكتبة حتى الآن.</div>`}
      ${pool}
      <div class="note" style="margin-top:2mm">• مرتجع الموظف يعود رصيداً حراً بالمخزن ويُدمج في حجوزات المراحل التالية (ويُخصم من طلبية المكتبة)، والمرتجع النهائي للمكتبة لما لم يحجزه أحد فقط: غلاف − خصم الصنف، ثم خصم الكمية بنسبة فاتورة الطلبية على إجمالي الإذن.</div>
      <div class="sig"><div>أمين المخزن</div><div>المدير المالي</div><div>مسؤول المبادرة</div></div>${Doc.foot("الكشف الشامل للمرتجعات")}`, "", "", Doc.density(i + d.docs.length + d.poolRows.length, "A4"));
  },

  // ---------------------------------------------------------------- المعاينة والحفظ
  fontsCss(base) {
    return [400, 500, 600, 700, 800].map(w =>
      `@font-face{font-family:"Cairo";font-weight:${w};font-display:swap;src:url(${base}fonts/cairo-arabic-${w}-normal.woff2) format("woff2");unicode-range:U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF;}`
      + `@font-face{font-family:"Cairo";font-weight:${w};font-display:swap;src:url(${base}fonts/cairo-latin-${w}-normal.woff2) format("woff2");unicode-range:U+0000-00FF;}`
    ).join("\n");
  },
  /** يفتح معاينة داخل التطبيق مع: حفظ PDF/طباعة، حفظ صورة، مشاركة */
  /** ختم المستند: ترقيم الصفحات عند تعددها + رمز QR للتحقق من المنظومة (لو للمستند رقم مرجعي) */
  async stamp(doc, ref) {
    if (!doc || !doc.body) return;
    const pages = [...doc.querySelectorAll("section.page")], N = pages.length;
    let svg = "";
    if (ref) { try { if (typeof qrLib === "function" && !window.qrcode) await Promise.race([qrLib(), new Promise(r => setTimeout(r, 1500))]);
      const Q = window.qrcode; if (Q) { const q = Q(0, "M"); q.addData(Doc.verifyUrl(ref)); q.make(); svg = q.createSvgTag({ cellSize: 2, margin: 0, scalable: true }); } } catch (_) {} }
    const st = doc.createElement("style");
    st.textContent = `section.page{position:relative}.vstamp{position:absolute;left:5mm;bottom:4mm;display:flex;align-items:center;gap:1.6mm;font-size:6.5pt;color:#6b5f86;line-height:1.25;background:#fff;padding:.8mm;border-radius:1.5mm}.vstamp .q{width:13mm;height:13mm}.vstamp.in{position:static;padding:0;margin-right:auto;order:9}.vstamp.in .q{width:11mm;height:11mm}.ft.ftq{display:flex;align-items:center;gap:3mm;flex-wrap:nowrap}.vstamp .q svg{width:100%;height:100%}.vstamp b{color:#3b1d63;font-size:7pt}
      .insta-slot{display:flex;align-items:center;gap:3mm;border:1.2px dashed #8b6fc0;border-radius:2.5mm;padding:1mm 2mm;margin:1mm 0 0;font-size:6.8pt;line-height:1.3;color:#4c4466;break-inside:avoid}.insta-slot .iq{width:21mm;height:21mm;flex:none}.insta-slot .iq svg{width:100%;height:100%}.insta-slot b{color:#3b1d63;font-size:8pt}.pay-row{margin-top:auto;display:flex;gap:3mm;align-items:flex-end}.pay-row .sig{flex:1;margin-top:0}.pay-row .insta-slot{flex:0 0 48%;margin:2mm 0 0}.vstamp.in .q{width:10mm!important;height:10mm!important}.insta-slot small{color:#8d84a3;display:block}
      .pgno{position:absolute;right:0;left:0;bottom:2mm;text-align:center;font-size:7.5pt;color:#6b5f86}@media print{.vstamp,.pgno{color:#000!important}.vstamp b{color:#000!important}}`;
    doc.head.appendChild(st);
    pages.forEach((pg, i) => {
      if (svg) { const ft = pg.querySelector(".ft"), h = `<div class="vstamp${ft ? " in" : ""}"><div class="q">${svg}</div><div><b>تحقق من المستند</b><br><span dir="ltr">${esc(ref)}</span></div></div>`;
        if (ft) { ft.classList.add("ftq"); ft.insertAdjacentHTML("beforeend", h); } else pg.insertAdjacentHTML("beforeend", h); }
    });
    // رمز الدفع بإنستاباي على الفاتورة (لو عليها متبقي)
    const slots = doc.querySelectorAll(".insta-slot");
    if (slots.length && typeof instaQrSvg === "function") { const I = instaInfo(), q = await instaQrSvg(I.link);
      if (q) slots.forEach(sl => { sl.innerHTML = `<div class="iq">${q}</div><div><b>${sl.dataset.amt ? `ادفع المتبقي <span class="num">${esc(sl.dataset.amt)}</span> ج.م بإنستاباي` : "ادفع بإنستاباي"}</b><div>امسح الرمز من التطبيق أو حوّل على:</div><div class="num" dir="ltr">${esc(I.ipa)}</div></div>`; });
      else slots.forEach(sl => sl.remove()); } else slots.forEach(sl => sl.remove());
    if (N > 1) { doc.querySelectorAll(".po-pg").forEach(x => x.remove()); pages.forEach((pg, i) => pg.insertAdjacentHTML("beforeend", `<div class="pgno">صفحة ${i + 1} من ${N}</div>`)); }
  },
  verifyUrl(ref) { return location.href.replace(/[#?].*$/, "") + "#/v/" + encodeURIComponent(ref); },
  show(title, pagesHtml, opts) {
    opts = opts || {};
    const size = opts.size || "A5", file = (opts.file || title).replace(/[\\/:*?"<>|]+/g, "-");
    const base = location.href.replace(/[#?].*$/, "").replace(/[^/]*$/, "");
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><base href="${base}"><title>${esc(title)}</title><style>${Doc.fontsCss(base)}\n${Doc.css(size)}</style></head><body>${pagesHtml}</body></html>`;
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
    fr.onload = () => { Doc.stamp(fr.contentDocument, opts.ref).finally(() => setTimeout(fit, 150)); };
    fr.srcdoc = html;
    const close = () => { root.remove(); window.removeEventListener("resize", fit); };
    window.addEventListener("resize", fit);
    root.querySelector("[data-x]").onclick = close;
    root.querySelector("[data-pdf]").onclick = () => { const w = fr.contentWindow; w.document.body.style.zoom = 1; w.focus(); w.print(); setTimeout(fit, 500); };
    root.querySelector("[data-png]").onclick = async e => {
      const btn = e.currentTarget; btn.disabled = true;
      try {
        const win = fr.contentWindow, doc = fr.contentDocument;
        if (!win || !doc) throw new Error("iframe");
        await Doc.lib(win);
        doc.body.style.zoom = 1;
        if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
        const imgs = [...doc.querySelectorAll("img")].filter(im => !im.complete);
        if (imgs.length) await Promise.race([
          Promise.all(imgs.map(im => new Promise(r => { im.onload = r; im.onerror = r; }))),
          new Promise(r => setTimeout(r, 2000))
        ]);
        const pages = [...doc.querySelectorAll(".page")];
        for (let k = 0; k < pages.length; k++) {
          const c = await win.html2canvas(pages[k], { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, scrollX: 0, scrollY: 0, windowWidth: size === "A4" ? 900 : 640 });
          const blob = await new Promise(res => c.toBlob(res, "image/png"));
          const url = blob ? URL.createObjectURL(blob) : c.toDataURL("image/png");
          const a = document.createElement("a");
          a.download = file + (pages.length > 1 ? "-" + (k + 1) : "") + ".png";
          a.href = url;
          document.body.appendChild(a);
          a.click();
          a.remove();
          if (blob) setTimeout(() => URL.revokeObjectURL(url), 5000);
          if (k + 1 < pages.length) await new Promise(r => setTimeout(r, 150));
        }
        toast("تم حفظ الصورة ✅", "success");
      } catch (err) {
        console.error("PNG export failed:", err);
        toast("تعذر حفظ الصورة، استخدم «PDF / طباعة».", "danger");
      }
      finally { btn.disabled = false; fit(); }
    };
    return root;
  },
  lib(win) {
    win = win || window;
    if (win.html2canvas) return Promise.resolve();
    return win._h2c || (win._h2c = new Promise((res, rej) => {
      const s = win.document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      s.onload = res;
      s.onerror = () => { win._h2c = null; rej(new Error("lib")); };
      win.document.head.appendChild(s);
    }));
  }
};

// ---------------------------------------------------------------- صفحة التحقق العامة #/v/<رقم المستند> (بدون دخول)
const DocVerify = {
  async render(ref) {
    const app = document.getElementById("app") || document.body;
    const sp = document.getElementById("splash"); if (sp) sp.remove();
    const box = (icon, tone, title, body) => `<div class="min-h-screen grid place-items-center p-4 bg-slate-50"><div class="card w-full max-w-sm p-6 text-center">
      <div class="flex items-center justify-center gap-2 mb-3 pb-3 border-b border-slate-100"><img src="icons/logo.svg" alt="" class="w-9 h-9" onerror="this.remove()"><div class="text-right leading-tight"><b class="text-[14px] text-brand-900">${esc(Brand.get().platform)}</b><div class="text-[11.5px] text-slate-500">${esc(Brand.get().org)} · التحقق من المستندات</div></div></div><div class="text-[46px]">${icon}</div><h1 class="text-[19px] font-extrabold ${tone} mt-1">${title}</h1><div class="text-[12.5px] text-slate-500 num mt-1" dir="ltr">${esc(ref)}</div>
      <div class="mt-4 text-right">${body}</div><div class="text-[11px] text-slate-400 mt-3 num">وقت التحقق: ${esc(new Date().toLocaleString("ar-EG"))}</div><a href="./?" class="btn btn-outline w-full mt-3">فتح المنصة</a></div></div>`;
    app.innerHTML = box("⏳", "text-slate-700", "جاري التحقق…", "");
    let r; try { r = await call("VERIFY_DOC", { ref }); } catch (_) { r = { success: false, message: "تعذّر الاتصال — حاول تاني." }; }
    if (!r || !r.success) { app.innerHTML = box("⚠️", "text-amber-700", "تعذّر التحقق", `<p class="text-[13.5px] text-slate-600 text-center">${esc((r && r.message) || "")}</p>`); return; }
    if (!r.found) { app.innerHTML = box("❌", "text-rose-700", "مستند غير مسجّل", `<p class="text-[13.5px] text-slate-600 text-center">الرقم ده مش موجود في المنظومة. المستند ممكن يكون غير صحيح أو معدّل.</p>`); return; }
    const kv = (k, v) => v === undefined || v === null || v === "" ? "" : `<div class="flex justify-between gap-3 py-1.5 border-b border-slate-100 text-[13.5px]"><span class="text-slate-500">${esc(k)}</span><b class="text-slate-900">${esc(String(v))}</b></div>`;
    app.innerHTML = box("✅", "text-emerald-700", "مستند صحيح صادر من المنظومة", (r.fields || []).map(f => kv(f[0], f[1])).join("") + `<p class="text-[11.5px] text-slate-400 mt-3 text-center">البيانات المعروضة هي الحالية في المنظومة وقت المسح.</p>`);
  }
};
