/* ============================================================================
 * قسم الكتب المتقدم: قوائم الأسعار التاريخية + المقارنة + المراحل والصفوف والشُّعب والمقررات
 * يُحمَّل ضمن حزمة الإدارة ADMIN_BUNDLE ويعمل داخل تبويبات صفحة #/a/books الحالية.
 * ============================================================================ */

(function () {
  const BP = {
    selListId: "",
    fStage: "",
    fGrade: "",
    fTrack: "",
    fPriced: "",        // "" | "priced" | "unpriced"
    q: "",
    dirty: {},          // { "bookId|track": { bookId, track, coverPrice, supplierDiscountPct, empDiscountPct } }
    // مقارنة فترتين
    cmpOpen: false,
    cmpA: "",
    cmpB: "",
    cmpDir: "all",
    cmpRes: null,
    // المراحل والشعب والمقررات
    trkStage: "",
    trkGrade: "2 ثانوي",
    currYear: "2026/2027",
    currTerm: "الترم الأول",
    currDirty: {}       // { bookId: ["علمي علوم", ...] }
  };

  const statusMeta = s => ({
    Draft: { lbl: "مسودة", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
    Approved: { lbl: "معتمدة", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
    Archived: { lbl: "مؤرشفة", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
    Superseded: { lbl: "نسخة سابقة", cls: "bg-slate-100 text-slate-500 ring-slate-200" }
  }[s] || { lbl: s || "—", cls: "bg-slate-100 text-slate-600 ring-slate-200" });

  const statusBadge = s => {
    const m = statusMeta(s);
    return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${m.cls}">${m.lbl}</span>`;
  };

  const priceLists = () => (A().priceLists || []).slice().sort((a, b) => String(b.Created_At || "").localeCompare(String(a.Created_At || "")));
  const priceItemsOf = (plId, includeSuperseded) => (A().priceItems || []).filter(i => i.Price_List_ID === plId && (includeSuperseded || i.Status !== "Superseded"));
  const stagesArr = () => ((A().catalog || {}).stages || ["رياض الأطفال", "المرحلة الابتدائية", "المرحلة الإعدادية", "المرحلة الثانوية"]);
  const tracksReg = () => ((A().catalog || {}).tracksRegistry || []);

  // ============================================================================
  // التبويب 2: قوائم الأسعار التاريخية والمقارنة
  // ============================================================================
  function renderPricing() {
    const d = A(), lists = priceLists();
    if (!BP.selListId && lists.length) BP.selListId = lists[0].Price_List_ID;
    if (BP.selListId && !lists.some(l => l.Price_List_ID === BP.selListId)) BP.selListId = lists[0] ? lists[0].Price_List_ID : "";
    const cur = lists.find(l => l.Price_List_ID === BP.selListId) || null;
    const canEdit = can("SAVE_PRICE_LIST") || can("SAVE_BOOK");

    const headBar = `
      <div class="card card-pad mb-3.5">
        <div class="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
          <div>
            <h2 class="font-bold text-slate-900 text-base flex items-center gap-2">${ic("calendar", "text-brand-600")} قوائم الأسعار التاريخية (حسب العام الدراسي والترم)</h2>
            <p class="text-xs text-slate-500 mt-0.5">لكل عام دراسي وترمين سجل تسعير مستقل تماماً — تغيير السعر الحالي لا يمس أي فاتورة أو فترة سابقة.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            ${lists.length >= 2 ? `<button type="button" class="btn ${BP.cmpOpen ? "btn-gold" : "btn-outline"} btn-sm" data-act="bpToggleCmp">${ic("scale")} ${BP.cmpOpen ? "إغلاق المقارنة" : "مقارنة فترتين"}</button>` : ""}
            ${canEdit ? `<button type="button" class="btn btn-primary btn-sm" data-act="bpNewList">${ic("plus")} قائمة أسعار جديدة / نسخ من فترة</button>` : ""}
          </div>
        </div>
        ${lists.length ? `
          <div class="flex gap-2 overflow-x-auto pt-3 pb-1">
            ${lists.map(l => {
              const active = l.Price_List_ID === BP.selListId;
              const cnt = priceItemsOf(l.Price_List_ID, false).length;
              return `<button type="button" class="shrink-0 text-right rounded-2xl px-3.5 py-2.5 ring-1 transition min-w-[195px] ${active ? "bg-brand-50/80 ring-brand-500 shadow-xs" : "bg-white ring-slate-200 hover:bg-slate-50"}" data-act="bpSelList" data-id="${esc(l.Price_List_ID)}">
                <div class="flex items-center justify-between gap-2 mb-1">
                  <b class="text-xs text-slate-900">${esc(l.Academic_Year)} · ${esc(l.Term)}</b>
                  ${statusBadge(l.Status)}
                </div>
                <div class="text-[11px] text-slate-500 truncate">${esc(l.Title)}</div>
                <div class="text-[11px] text-slate-400 mt-1 num">${fmt(cnt)} سعر · إصدار ${fmt(l.Version || 1)}</div>
              </button>`;
            }).join("")}
          </div>` : `
          <div class="py-8 text-center">
            <div class="text-slate-700 font-bold text-sm mb-1">لا توجد قوائم أسعار تاريخية مسجلة بعد</div>
            <p class="text-xs text-slate-500 mb-3">أنشئ أول قائمة أسعار للترم الحالي (مع إمكانية نسخ أسعار الكتالوج الحالي بضغطة واحدة) لبدء الأرشفة التاريخية للأسعار.</p>
            ${canEdit ? `<button type="button" class="btn btn-primary btn-sm" data-act="bpNewList">${ic("plus")} إنشاء أول قائمة أسعار</button>` : ""}
          </div>`}
      </div>`;

    const cmpHtml = BP.cmpOpen ? renderComparePanel(lists) : "";
    if (!cur) return headBar + cmpHtml;

    const isDraft = cur.Status === "Draft";
    const isApproved = cur.Status === "Approved";
    const items = priceItemsOf(cur.Price_List_ID, false);
    const supersededCnt = (A().priceItems || []).filter(i => i.Price_List_ID === cur.Price_List_ID && i.Status === "Superseded").length;
    const booksMap = {}; (d.books || []).forEach(b => { booksMap[b.Book_ID] = b; });

    // خريطة السعر المرجعي السابق (من القائمة المرجعية Copied_From_ID أو الكتالوج الحالي) للعرض واكتشاف الانحرافات
    const refPrices = {};
    const refListId = cur.Copied_From_ID || (lists.find(l => l.Price_List_ID !== cur.Price_List_ID && l.Status === "Approved") || {}).Price_List_ID || "";
    if (refListId) {
      priceItemsOf(refListId, false).forEach(p => { refPrices[p.Book_ID + "|" + (p.Track || "")] = n(p.Cover_Price); });
    }

    // دمج كتب الكتالوج مع أسعار القائمة المختارة في وضع المسودة لإتاحة تسعير أي كتاب بسهولة
    let rows = items.map(it => ({ it, bk: booksMap[it.Book_ID] || { Book_ID: it.Book_ID, Book_Name: it.Book_ID, Stage: it.Stage, Grade: it.Grade } }));
    const existingGeneral = new Set(items.filter(i => !i.Track).map(i => i.Book_ID));
    let activeCatalogTotal = 0, pricedCatalogCount = 0;
    (d.books || []).forEach(bk => {
      if (bk.Book_Status !== "Discontinued") {
        activeCatalogTotal++;
        if (existingGeneral.has(bk.Book_ID)) pricedCatalogCount++;
        else if (isDraft) rows.push({ it: null, bk });
      }
    });
    const unpricedCount = Math.max(0, activeCatalogTotal - pricedCatalogCount);
    const progressPct = activeCatalogTotal ? Math.round((pricedCatalogCount / activeCatalogTotal) * 100) : 0;

    // فلترة ذكية
    const qNorm = typeof normArSearch === "function" ? normArSearch(BP.q) : String(BP.q || "").toLowerCase();
    const tokens = qNorm ? qNorm.split(" ").filter(Boolean) : [];
    const filtered = rows.filter(({ it, bk }) => {
      if (BP.fStage && (bk.Stage || (it && it.Stage)) !== BP.fStage) return false;
      if (BP.fGrade && (bk.Grade || (it && it.Grade)) !== BP.fGrade) return false;
      const trk = it ? (it.Track || "") : "";
      if (BP.fTrack === "__general" && trk) return false;
      if (BP.fTrack && BP.fTrack !== "__general" && trk !== BP.fTrack) return false;
      if (isDraft && BP.fPriced === "priced" && !it) return false;
      if (isDraft && BP.fPriced === "unpriced" && it) return false;
      if (tokens.length) {
        const hay = (typeof normArSearch === "function" ? normArSearch : s => String(s || "").toLowerCase())(
          [bk.Book_ID, bk.Book_Name, bk.Publisher, bk.Subject, bk.Grade, bk.Stage, trk, cur.Academic_Year, cur.Term].join(" ")
        );
        if (!tokens.every(t => hay.includes(t))) return false;
      }
      return true;
    });

    const grades = (d.catalog && d.catalog.grades || []).filter(g => !BP.fStage || g.stage === BP.fStage);
    const tracksInList = [...new Set(items.map(i => i.Track).filter(Boolean).concat(tracksReg().map(t => t.name)))].sort((a, b) => a.localeCompare(b, "ar"));
    const dirtyKeys = Object.keys(BP.dirty);

    const progressBar = isDraft && activeCatalogTotal ? `
      <div class="rounded-2xl bg-slate-50 ring-1 ring-slate-200/80 px-3.5 py-2.5 mb-3">
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
          <span class="font-bold text-slate-800">تقدّم تسعير الكتالوج الثابت: <span class="num text-brand-700">${fmt(pricedCatalogCount)}</span> من <span class="num">${fmt(activeCatalogTotal)}</span> كتاب (<span class="num">${progressPct}%</span>)</span>
          <span class="text-[11px] ${unpricedCount ? "text-amber-700 font-semibold" : "text-emerald-700 font-bold"}">${unpricedCount ? `متبقي ${fmt(unpricedCount)} كتاب بانتظار السعر` : "تم تسعير كل الكتب النشطة ✓"}</span>
        </div>
        <div class="h-2 rounded-full bg-slate-200 overflow-hidden"><div class="h-full bg-brand-600 transition-all" style="width:${progressPct}%"></div></div>
      </div>` : "";

    const statusBanner = isApproved
      ? `<div class="rounded-2xl bg-emerald-50/80 ring-1 ring-emerald-200 px-3.5 py-2.5 mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
          <span>${ic("shield-check", "inline -mt-0.5 text-emerald-700")} <b>قائمة معتمدة ومحمية</b> — اعتمدها ${esc(cur.Approved_By || "—")} بتاريخ ${esc(String(cur.Approved_At || "").slice(0, 16))}. ممنوع التعديل العشوائي؛ أي تغيير يتم عبر «تعديل موثّق» يحفظ النسخة السابقة.</span>
          ${supersededCnt ? `<button type="button" class="btn btn-outline btn-xs" data-act="bpHistory" data-id="${esc(cur.Price_List_ID)}">${ic("history")} سجل النسخ السابقة (${fmt(supersededCnt)})</button>` : ""}
        </div>`
      : cur.Status === "Archived"
        ? `<div class="rounded-2xl bg-slate-100 ring-1 ring-slate-200 px-3.5 py-2.5 mb-3 text-xs text-slate-700">${ic("archive", "inline -mt-0.5")} <b>قائمة مؤرشفة (للقراءة فقط)</b> — أُرشفت بتاريخ ${esc(String(cur.Archived_At || "").slice(0, 16))} وتظل متاحة دائماً للمراجعة والمقارنة.</div>`
        : `<div class="rounded-2xl bg-amber-50/80 ring-1 ring-amber-200 px-3.5 py-2.5 mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
            <span>${ic("pencil", "inline -mt-0.5 text-amber-700")} <b>مسودة قيد الإعداد</b> — أدخل الأسعار الجديدة أمام الكتب الثابتة ثم اضغط «حفظ الأسعار» وراجعها قبل الاعتماد النهائي.</span>
            ${canEdit ? `<button type="button" class="btn btn-outline btn-xs" data-act="bpAddTrackPrice" data-id="${esc(cur.Price_List_ID)}">${ic("plus")} إضافة سعر خاص بشعبة</button>` : ""}
          </div>`;

    const dirtyBar = dirtyKeys.length ? `
      <div class="mb-3 rounded-2xl bg-brand-50 ring-1 ring-brand-300 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span class="font-bold text-brand-900">لديك ${fmt(dirtyKeys.length)} سعر معدّل غير محفوظ في المسودة</span>
        <div class="flex items-center gap-2">
          <button type="button" class="btn btn-primary btn-xs" data-act="bpSaveDirty">${ic("check")} حفظ الأسعار (${fmt(dirtyKeys.length)})</button>
          <button type="button" class="btn btn-outline btn-xs" data-act="bpDiscardDirty">${ic("x")} تراجع</button>
        </div>
      </div>` : "";

    const shown = filtered.slice(0, 100);
    const tblRows = shown.map(({ it, bk }) => {
      const trk = it ? (it.Track || "") : "";
      const scopeKey = bk.Book_ID + "|" + trk;
      const dr = BP.dirty[scopeKey];
      const cover = dr ? dr.coverPrice : (it ? it.Cover_Price : "");
      const disc = dr ? dr.supplierDiscountPct : (it ? it.Supplier_Discount_Pct : bk.Supplier_Discount_Pct);
      const empDisc = dr ? dr.empDiscountPct : (it ? it.Emp_Discount_Pct : (bk.Emp_Discount_Pct !== "" && bk.Emp_Discount_Pct !== undefined ? bk.Emp_Discount_Pct : d.settingsMap.UNIFIED_EMP_DISCOUNT_PCT));
      const p = cover ? bookPrice({ coverPrice: cover, supplierDiscountPct: disc, empDiscountPct: empDisc }) : { cost: 0, emp: 0, margin: 0 };
      const refCover = refPrices[scopeKey] || refPrices[bk.Book_ID + "|"] || n(bk.Cover_Price) || 0;
      const pctDiff = (isDraft && cover && refCover > 0) ? Math.round(((n(cover) - refCover) / refCover) * 100) : 0;
      const hasWarn = isDraft && cover && refCover > 0 && (pctDiff > 40 || pctDiff < -20);
      return `<tr class="${dr ? "bg-amber-50/50" : ""}">
        <td class="num font-bold text-xs text-slate-700 whitespace-nowrap">${esc(bk.Book_ID)}</td>
        <td>
          <div class="font-bold text-xs text-slate-900">${esc(bk.Book_Name)}</div>
          <div class="text-[11px] text-slate-500">${esc([bk.Grade, bk.Publisher, bk.Subject].filter(Boolean).join(" · "))}</div>
        </td>
        <td class="whitespace-nowrap">${trk ? `<span class="rounded-md bg-sky-50 text-sky-800 ring-1 ring-sky-200 px-1.5 py-0.5 text-[11px] font-bold">${esc(trk)}</span>` : `<span class="text-[11px] text-slate-400">سعر عام</span>`}</td>
        <td class="num text-center">${isDraft && canEdit
          ? `<div class="inline-flex flex-col items-center gap-0.5">
              <input type="number" step="any" inputmode="decimal" class="tbl-inp !w-24 ${hasWarn ? "!border-rose-400 !bg-rose-50/40" : ""}" data-bp-in="${esc(scopeKey)}" data-f="coverPrice" value="${esc(cover)}" placeholder="أدخل السعر">
              ${refCover > 0 ? `<span class="text-[10px] ${hasWarn ? "text-rose-600 font-bold" : "text-slate-400"}">السابق: ${fmt(refCover)}${hasWarn ? ` (${pctDiff > 0 ? "+" : ""}${pctDiff}%)` : ""}</span>` : ""}
            </div>`
          : `<b class="text-slate-800">${cover ? fmt(cover) : "—"}</b>`}</td>
        <td class="num text-center">${isDraft && canEdit
          ? `<input type="number" step="any" inputmode="decimal" class="tbl-inp !w-16" data-bp-in="${esc(scopeKey)}" data-f="supplierDiscountPct" value="${esc(disc)}" placeholder="%">`
          : `${fmt(disc)}%`}</td>
        <td class="num text-center text-slate-700">${cover ? fmt(p.cost) : "—"}</td>
        <td class="num text-center"><b class="text-brand-800">${cover ? fmt(p.emp) : "—"}</b></td>
        <td class="num text-center"><span class="${p.margin < 0 ? "text-rose-600 font-bold" : "text-emerald-700 font-semibold"}">${cover ? fmt(p.margin) : "—"}</span></td>
        <td class="text-center whitespace-nowrap">
          ${it ? `<span class="text-[10.5px] text-slate-400 num">v${fmt(it.Version || 1)}</span>` : `<span class="text-[10.5px] text-amber-600 font-semibold">بانتظار السعر</span>`}
          ${isApproved && canEdit && it ? `<button type="button" class="btn btn-outline btn-xs mr-1" data-act="bpRevise" data-id="${esc(scopeKey)}" title="تعديل موثّق مع حفظ النسخة السابقة">${ic("pencil", "!w-3 !h-3")} تعديل موثّق</button>` : ""}
        </td>
      </tr>`;
    }).join("");

    return headBar + cmpHtml + `
      <section class="card card-pad">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-slate-900 text-sm">${esc(cur.Title)}</h3>
              ${statusBadge(cur.Status)}
            </div>
            <div class="text-[11.5px] text-slate-500 mt-0.5">${esc(cur.Academic_Year)} · ${esc(cur.Term)} · ${fmt(items.length)} سعر مسجل${cur.Notes ? " · " + esc(cur.Notes) : ""}</div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            ${isDraft && canEdit ? `<button type="button" class="btn btn-primary btn-sm" data-act="bpApprove" data-id="${esc(cur.Price_List_ID)}">${ic("circle-check")} اعتماد القائمة</button>` : ""}
            ${cur.Status !== "Archived" && canEdit ? `<button type="button" class="btn btn-outline btn-sm" data-act="bpArchive" data-id="${esc(cur.Price_List_ID)}">${ic("archive")} أرشفة</button>` : ""}
          </div>
        </div>
        ${statusBanner}
        ${progressBar}
        ${dirtyBar}
        <div class="flex flex-wrap items-center gap-2 mb-3">
          ${searchBox("bpQ", BP.q, "بحث في القائمة بالاسم أو الكود أو المادة…")}
          <select class="input !h-9 !w-auto !text-xs" data-change="bpFilter" data-k="fStage">
            <option value="">كل المراحل</option>
            ${stagesArr().map(s => `<option value="${esc(s)}" ${BP.fStage === s ? "selected" : ""}>${esc(s)}</option>`).join("")}
          </select>
          <select class="input !h-9 !w-auto !text-xs" data-change="bpFilter" data-k="fGrade">
            <option value="">كل الصفوف</option>
            ${grades.map(g => `<option value="${esc(g.label)}" ${BP.fGrade === g.label ? "selected" : ""}>${esc(g.label)}</option>`).join("")}
          </select>
          <select class="input !h-9 !w-auto !text-xs" data-change="bpFilter" data-k="fTrack">
            <option value="">كل الشُّعب</option>
            <option value="__general" ${BP.fTrack === "__general" ? "selected" : ""}>سعر عام فقط</option>
            ${tracksInList.map(t => `<option value="${esc(t)}" ${BP.fTrack === t ? "selected" : ""}>${esc(t)}</option>`).join("")}
          </select>
          ${isDraft ? `<select class="input !h-9 !w-auto !text-xs" data-change="bpFilter" data-k="fPriced">
            <option value="">كل الكتب (${fmt(rows.length)})</option>
            <option value="unpriced" ${BP.fPriced === "unpriced" ? "selected" : ""}>بانتظار السعر فقط (${fmt(unpricedCount)})</option>
            <option value="priced" ${BP.fPriced === "priced" ? "selected" : ""}>المسعّرة فقط (${fmt(items.length)})</option>
          </select>` : ""}
          <span class="text-xs text-slate-400 num mr-auto">النتائج: <b>${fmt(filtered.length)}</b>${filtered.length > 100 ? " (أول 100)" : ""}</span>
        </div>
        ${shown.length ? `
          <div class="overflow-x-auto rounded-xl ring-1 ring-slate-200/80">
            <table class="tbl w-full text-right text-xs">
              <thead><tr><th>الكود</th><th>الكتاب · الصف · الناشر</th><th>الشعبة</th><th class="text-center">قبل الخصم</th><th class="text-center">خصم%</th><th class="text-center">التكلفة</th><th class="text-center">للموظف</th><th class="text-center">الهامش</th><th class="text-center">الإصدار / إجراء</th></tr></thead>
              <tbody class="divide-y divide-slate-100">${tblRows}</tbody>
            </table>
          </div>` : UI.empty("calendar", "لا توجد أسعار مطابقة للفلتر", "جرّب تغيير المرحلة أو الصف أو البحث.")}
      </section>`;
  }

  function renderComparePanel(lists) {
    if (!BP.cmpA && lists[1]) BP.cmpA = lists[1].Price_List_ID;
    if (!BP.cmpB && lists[0]) BP.cmpB = lists[0].Price_List_ID;
    const r = BP.cmpRes;
    const rows = r && r.rows ? r.rows.filter(x => BP.cmpDir === "all" || x.direction === BP.cmpDir) : [];
    return `
      <section class="card card-pad mb-3.5 bg-slate-50/60">
        <div class="flex flex-wrap items-end gap-2.5 mb-3">
          <div class="flex-1 min-w-[180px]">
            <label class="label !text-xs">الفترة الأساسية (الأقدم)</label>
            <select class="input !h-9 !text-xs" data-change="bpCmpSel" data-k="cmpA">
              ${lists.map(l => `<option value="${esc(l.Price_List_ID)}" ${BP.cmpA === l.Price_List_ID ? "selected" : ""}>${esc(l.Academic_Year)} — ${esc(l.Term)} (${esc(statusMeta(l.Status).lbl)})</option>`).join("")}
            </select>
          </div>
          <div class="flex-1 min-w-[180px]">
            <label class="label !text-xs">الفترة المقارنة (الأحدث)</label>
            <select class="input !h-9 !text-xs" data-change="bpCmpSel" data-k="cmpB">
              ${lists.map(l => `<option value="${esc(l.Price_List_ID)}" ${BP.cmpB === l.Price_List_ID ? "selected" : ""}>${esc(l.Academic_Year)} — ${esc(l.Term)} (${esc(statusMeta(l.Status).lbl)})</option>`).join("")}
            </select>
          </div>
          <button type="button" class="btn btn-primary btn-sm" data-act="bpRunCmp">${ic("scale")} اعرض المقارنة</button>
        </div>
        ${r && r.summary ? `
          <div class="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-3 text-center">
            <button type="button" class="rounded-xl p-2 ring-1 ${BP.cmpDir === "all" ? "bg-brand-50 ring-brand-400" : "bg-white ring-slate-200"}" data-act="bpCmpDir" data-id="all"><div class="text-[11px] text-slate-500">الإجمالي</div><b class="num text-sm">${fmt(r.summary.total)}</b></button>
            <button type="button" class="rounded-xl p-2 ring-1 ${BP.cmpDir === "increased" ? "bg-rose-50 ring-rose-400" : "bg-white ring-slate-200"}" data-act="bpCmpDir" data-id="increased"><div class="text-[11px] text-rose-600">زادت أسعارها</div><b class="num text-sm text-rose-700">${fmt(r.summary.increased)}</b></button>
            <button type="button" class="rounded-xl p-2 ring-1 ${BP.cmpDir === "decreased" ? "bg-emerald-50 ring-emerald-400" : "bg-white ring-slate-200"}" data-act="bpCmpDir" data-id="decreased"><div class="text-[11px] text-emerald-600">انخفضت</div><b class="num text-sm text-emerald-700">${fmt(r.summary.decreased)}</b></button>
            <button type="button" class="rounded-xl p-2 ring-1 ${BP.cmpDir === "unchanged" ? "bg-slate-100 ring-slate-400" : "bg-white ring-slate-200"}" data-act="bpCmpDir" data-id="unchanged"><div class="text-[11px] text-slate-500">لم تتغير</div><b class="num text-sm">${fmt(r.summary.unchanged)}</b></button>
            <button type="button" class="rounded-xl p-2 ring-1 ${BP.cmpDir === "added" ? "bg-sky-50 ring-sky-400" : "bg-white ring-slate-200"}" data-act="bpCmpDir" data-id="added"><div class="text-[11px] text-sky-600">جديدة</div><b class="num text-sm text-sky-700">${fmt(r.summary.added)}</b></button>
            <div class="rounded-xl p-2 bg-white ring-1 ring-slate-200"><div class="text-[11px] text-slate-500">متوسط التغير</div><b class="num text-sm ${r.summary.avgPctChange > 0 ? "text-rose-700" : "text-emerald-700"}">${r.summary.avgPctChange > 0 ? "+" : ""}${fmt(r.summary.avgPctChange)}%</b></div>
          </div>
          <div class="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200 max-h-80 overflow-y-auto">
            <table class="tbl w-full text-right text-xs">
              <thead><tr><th>الكود</th><th>الكتاب</th><th>الشعبة</th><th class="text-center">السعر السابق</th><th class="text-center">السعر الجديد</th><th class="text-center">الفرق</th><th class="text-center">النسبة %</th></tr></thead>
              <tbody class="divide-y divide-slate-100">${rows.slice(0, 120).map(x => `<tr>
                <td class="num font-bold">${esc(x.bookId)}</td>
                <td><b>${esc(x.bookName)}</b> <span class="text-slate-400">${esc(x.grade)}</span></td>
                <td>${x.track ? esc(x.track) : "عام"}</td>
                <td class="num text-center">${x.coverA !== null ? fmt(x.coverA) : "—"}</td>
                <td class="num text-center font-bold">${x.coverB !== null ? fmt(x.coverB) : "—"}</td>
                <td class="num text-center font-bold ${x.diff > 0 ? "text-rose-600" : x.diff < 0 ? "text-emerald-700" : "text-slate-400"}">${x.diff > 0 ? "+" : ""}${fmt(x.diff)}</td>
                <td class="num text-center font-bold ${x.pctChange > 0 ? "text-rose-600" : x.pctChange < 0 ? "text-emerald-700" : "text-slate-400"}">${x.direction === "added" ? "جديد" : x.direction === "removed" ? "محذوف" : ((x.pctChange > 0 ? "+" : "") + fmt(x.pctChange) + "%")}</td>
              </tr>`).join("")}</tbody>
            </table>
          </div>` : `<div class="text-xs text-slate-500">اختر فترتين واضغط «اعرض المقارنة» لرؤية الفروق ونسب التغير.</div>`}
      </section>`;
  }

  // ============================================================================
  // التبويب 3: المراحل والصفوف وشُعب الثانوية العامة والمقررات حسب الفترة
  // ============================================================================
  function renderTracks() {
    const d = A(), stages = stagesArr(), grades = (d.catalog && d.catalog.grades) || [];
    const reg = tracksReg();
    const canEdit = can("SAVE_BOOK");
    if (!grades.some(g => g.label === BP.trkGrade) && grades.length) {
      BP.trkGrade = (grades.find(g => /ثانوي/.test(g.label)) || grades[0]).label;
    }
    const gradeTracks = reg.filter(t => t.grade === BP.trkGrade);
    const activeTrackNames = gradeTracks.filter(t => t.isActive).map(t => t.name);
    const gradeBooks = (d.books || []).filter(b => b.Grade === BP.trkGrade && b.Book_Status !== "Discontinued");

    // قراءة مقررات الفترة المختارة (مع fallback لحقل Tracks بالكتالوج لو لم يُحفظ مقرر لهذه الفترة بعد)
    const currRows = (d.trackCurriculum || []).filter(c => c.Academic_Year === BP.currYear && c.Term === BP.currTerm && c.Grade === BP.trkGrade);
    const currByBook = {};
    currRows.forEach(c => {
      currByBook[c.Book_ID] = currByBook[c.Book_ID] || [];
      if (c.Track_Name) currByBook[c.Book_ID].push(c.Track_Name);
    });
    const bookCurr = b => {
      if (BP.currDirty[b.Book_ID]) return BP.currDirty[b.Book_ID];
      if (currByBook[b.Book_ID]) return currByBook[b.Book_ID];
      return String(b.Tracks || "").split(/[،,]/).map(s => s.trim()).filter(Boolean);
    };

    const bySub = {};
    gradeBooks.forEach(b => { (bySub[b.Subject || "—"] = bySub[b.Subject || "—"] || []).push(b); });
    const dirtyCnt = Object.keys(BP.currDirty).length;

    return `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3.5 mb-3.5">
        <section class="card card-pad">
          <div class="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100">
            <h3 class="font-bold text-slate-900 text-sm">${ic("layers", "inline -mt-0.5 text-brand-600")} المراحل الدراسية (${fmt(stages.length)})</h3>
            ${canEdit ? `<button type="button" class="btn btn-outline btn-xs" data-act="bpAddStage">${ic("plus")} مرحلة</button>` : ""}
          </div>
          <div class="space-y-1.5">
            ${stages.map(st => {
              const gCnt = grades.filter(g => g.stage === st).length;
              return `<div class="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                <div><b class="text-slate-800">${esc(st)}</b> <span class="text-slate-400 num">(${fmt(gCnt)} صف)</span></div>
                ${canEdit && gCnt === 0 ? `<button type="button" class="text-rose-600 hover:underline font-semibold" data-act="bpDelStage" data-id="${esc(st)}">حذف</button>` : ""}
              </div>`;
            }).join("")}
          </div>
          <p class="text-[11px] text-slate-400 mt-2.5">لإضافة أو حذف صفوف دراسية داخل أي مرحلة استخدم زر «القوائم ← الصفوف» بالأعلى.</p>
        </section>

        <section class="card card-pad lg:col-span-2">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100">
            <div>
              <h3 class="font-bold text-slate-900 text-sm">${ic("graduation-cap", "inline -mt-0.5 text-brand-600")} سجل شُعب وتخصصات ${esc(BP.trkGrade)}</h3>
              <p class="text-[11px] text-slate-500">يدعم شعب الثانوية العامة والبكالوريا وأي تخصصات مستقبلية دون تعديل الكود.</p>
            </div>
            ${canEdit ? `<button type="button" class="btn btn-primary btn-xs" data-act="bpTrackForm">${ic("plus")} إضافة شعبة جديدة</button>` : ""}
          </div>
          <div class="flex gap-1.5 overflow-x-auto pb-2 mb-2.5">
            ${grades.map(g => {
              const cnt = reg.filter(t => t.grade === g.label && t.isActive).length;
              return `<button type="button" class="chip shrink-0" data-act="bpTrkGrade" data-id="${esc(g.label)}" aria-pressed="${g.label === BP.trkGrade}">${esc(g.label)}${cnt ? ` <span class="num opacity-70">(${cnt})</span>` : ""}</button>`;
            }).join("")}
          </div>
          ${gradeTracks.length ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              ${gradeTracks.map(t => `
                <div class="rounded-xl ring-1 p-2.5 flex items-center justify-between gap-2 ${t.isActive ? "bg-white ring-slate-200" : "bg-slate-50 ring-slate-200 opacity-65"}">
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <b class="text-xs text-slate-900 truncate">${esc(t.name)}</b>
                      <span class="rounded-full px-1.5 py-0 text-[10px] font-bold ${t.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}">${t.isActive ? "مفعّلة" : "موقوفة"}</span>
                    </div>
                    ${t.notes ? `<div class="text-[11px] text-slate-500 truncate mt-0.5">${esc(t.notes)}</div>` : ""}
                  </div>
                  ${canEdit ? `<div class="flex items-center gap-1 shrink-0">
                    <button type="button" class="btn btn-ghost btn-xs" data-act="bpTrackToggle" data-id="${esc(t.id)}" title="${t.isActive ? "إيقاف" : "تفعيل"}">${t.isActive ? "إيقاف" : "تفعيل"}</button>
                    <button type="button" class="btn btn-ghost btn-xs" data-act="bpTrackForm" data-id="${esc(t.id)}">${ic("pencil", "!w-3.5 !h-3.5")}</button>
                    <button type="button" class="btn btn-ghost btn-xs text-rose-600" data-act="bpTrackDel" data-id="${esc(t.id)}">${ic("trash-2", "!w-3.5 !h-3.5")}</button>
                  </div>` : ""}
                </div>`).join("")}
            </div>` : `<div class="text-xs text-slate-500 py-4 text-center bg-slate-50 rounded-xl">الصف «${esc(BP.trkGrade)}» ليس له شُعب مخصصة حالياً — كل كتبه مشتركة للجميع.</div>`}
        </section>
      </div>

      <section class="card card-pad">
        <div class="flex flex-wrap items-center justify-between gap-2.5 pb-3 mb-3 border-b border-slate-100">
          <div>
            <h3 class="font-bold text-slate-900 text-sm">${ic("book-open", "inline -mt-0.5 text-brand-600")} الكتب المقررة لكل شعبة — ${esc(BP.trkGrade)}</h3>
            <p class="text-[11.5px] text-slate-500">اختر العام والترم لربط الكتب بالشُّعب دون تكرار سجل الكتاب الأساسي ودون المساس بمقررات الأعوام السابقة. الكتاب بلا شعبة محددة = <b>مشترك</b>.</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <input type="text" class="input !h-9 !w-28 !text-xs num text-center font-bold" value="${esc(BP.currYear)}" data-change="bpCurrPeriod" data-k="currYear" placeholder="2026/2027">
            <select class="input !h-9 !w-auto !text-xs" data-change="bpCurrPeriod" data-k="currTerm">
              <option value="الترم الأول" ${BP.currTerm === "الترم الأول" ? "selected" : ""}>الترم الأول</option>
              <option value="الترم الثاني" ${BP.currTerm === "الترم الثاني" ? "selected" : ""}>الترم الثاني</option>
            </select>
            ${canEdit && dirtyCnt ? `<button type="button" class="btn btn-primary btn-sm" data-act="bpSaveCurr">${ic("check")} حفظ مقررات الفترة (${fmt(dirtyCnt)})</button>` : ""}
          </div>
        </div>
        ${!activeTrackNames.length
          ? UI.empty("graduation-cap", "أضف شُعبة نشطة أولاً لهذا الصف", "بعد إضافة الشُّعب بالأعلى ستظهر هنا لتوزيع الكتب عليها.")
          : !gradeBooks.length
            ? UI.empty("library-big", "لا توجد كتب مسجلة لهذا الصف", "أضف كتباً للصف من تبويب الكتالوج أولاً.")
            : Object.keys(bySub).sort((a, b) => a.localeCompare(b, "ar")).map(sub => {
                const list = bySub[sub];
                return `<div class="rounded-2xl ring-1 ring-slate-200 bg-white mb-2.5 overflow-hidden">
                  <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <b class="text-xs text-slate-900">${esc(sub)} <span class="text-slate-400 font-normal num">(${fmt(list.length)} كتاب)</span></b>
                    ${canEdit ? `<select class="input !h-8 !w-auto !text-xs" data-change="bpCurrSubAll" data-sub="${esc(sub)}">
                      <option value="">طبّق على كل كتب المادة…</option>
                      <option value="__all">مشترك (كل الشُّعب)</option>
                      ${activeTrackNames.map(t => `<option value="${esc(t)}">${esc(t)} فقط</option>`).join("")}
                    </select>` : ""}
                  </div>
                  <ul class="divide-y divide-slate-100">
                    ${list.map(b => {
                      const curT = bookCurr(b);
                      const isShared = !curT.length || curT.length > 1;
                      return `<li class="px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                        <div class="text-xs">
                          <b class="text-slate-800">${esc(b.Book_Name)}</b>
                          <span class="text-[11px] text-slate-400 num mr-1">${esc(b.Book_ID)}</span>
                          ${BP.currDirty[b.Book_ID] ? `<span class="text-amber-600 font-bold text-[11px]">• معدّل</span>` : ""}
                        </div>
                        <div class="flex flex-wrap items-center gap-1">
                          ${activeTrackNames.map(t => {
                            const active = curT.includes(t);
                            return `<button type="button" class="rounded-full px-2.5 h-7 text-[11px] font-bold ring-1 transition ${active ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}" data-act="bpCurrToggle" data-id="${esc(b.Book_ID)}|${esc(t)}">${esc(t)}</button>`;
                          }).join("")}
                          <span class="rounded-full px-2 h-7 inline-flex items-center text-[10.5px] font-bold ${isShared ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"}">${!curT.length ? "مشترك (الكل)" : curT.length > 1 ? "مشترك (" + curT.length + ")" : "مخصص"}</span>
                        </div>
                      </li>`;
                    }).join("")}
                  </ul>
                </div>`;
              }).join("")}
      </section>`;
  }

  // ============================================================================
  // أحداث وتفاعلات التبويبين (قوائم الأسعار + المراحل والشعب)
  // ============================================================================
  on("bpSelList", id => { BP.selListId = id; BP.dirty = {}; Router.render(); });
  on("bpToggleCmp", () => { BP.cmpOpen = !BP.cmpOpen; Router.render(); });
  on("bpCmpSel", (v, el) => { BP[el.dataset.k] = v; });
  on("bpCmpDir", d => { BP.cmpDir = d; Router.render(); });
  on("bpRunCmp", async () => {
    if (!BP.cmpA || !BP.cmpB || BP.cmpA === BP.cmpB) return toast("اختر قائمتي أسعار مختلفتين للمقارنة", "warning");
    const r = await call("COMPARE_PRICE_LISTS", { listAId: BP.cmpA, listBId: BP.cmpB }, { block: true });
    if (!r.success) return toast(r.message || "تعذرت المقارنة", "danger");
    BP.cmpRes = r;
    Router.render();
  });

  on("bpQ", v => { BP.q = v.trim(); Router.render(); });
  on("bpFilter", (v, el) => {
    BP[el.dataset.k] = v;
    if (el.dataset.k === "fStage") BP.fGrade = "";
    Router.render();
  });

  document.addEventListener("input", ev => {
    const inp = ev.target.closest("[data-bp-in]");
    if (!inp) return;
    const key = inp.dataset.bpIn, f = inp.dataset.f;
    const [bookId, track] = key.split("|");
    const items = priceItemsOf(BP.selListId, false);
    const ex = items.find(i => i.Book_ID === bookId && (i.Track || "") === (track || ""));
    const bk = (A().books || []).find(b => b.Book_ID === bookId) || {};
    const cur = BP.dirty[key] || {
      bookId, track: track || "",
      coverPrice: ex ? ex.Cover_Price : "",
      supplierDiscountPct: ex ? ex.Supplier_Discount_Pct : bk.Supplier_Discount_Pct,
      empDiscountPct: ex ? ex.Emp_Discount_Pct : (bk.Emp_Discount_Pct !== "" && bk.Emp_Discount_Pct !== undefined ? bk.Emp_Discount_Pct : A().settingsMap.UNIFIED_EMP_DISCOUNT_PCT)
    };
    cur[f] = inp.value;
    BP.dirty[key] = cur;
  });

  on("bpDiscardDirty", () => { BP.dirty = {}; Router.render(); });
  on("bpSaveDirty", async () => {
    const items = Object.values(BP.dirty).filter(x => n(x.coverPrice) > 0);
    if (!items.length) return toast("أدخل سعراً أكبر من صفر قبل الحفظ", "warning");
    const r = await call("SAVE_PRICE_ITEMS", { priceListId: BP.selListId, items }, { block: true });
    toast(r.message, r.success ? "success" : "danger");
    if (r.success) { BP.dirty = {}; await Admin.load(); Router.render(); }
  });

  on("bpNewList", async () => {
    const lists = priceLists();
    const latestRef = (lists.find(l => l.Status === "Approved") || lists[0] || {}).Price_List_ID || "";
    const v = await UI.form({
      title: "إنشاء قائمة أسعار لتيرم جديد",
      intro: "تُنشأ كمسودة مستقلة للفترة المختارة مع الاحتفاظ بالكتالوج الثابت للكتب دون تكرار، ودون المساس بأسعار أو فواتير أي تيرم سابق.",
      fields: [
        { name: "academicYear", label: "العام الدراسي", value: "2026/2027", placeholder: "مثلاً: 2026/2027", required: true },
        { name: "term", label: "الترم الدراسي", type: "select", value: "الترم الأول", options: [["الترم الأول", "الترم الأول"], ["الترم الثاني", "الترم الثاني"]] },
        { name: "title", label: "عنوان القائمة (اختياري)", placeholder: "مثال: قائمة أسعار الترم الثاني 2026/2027" },
        { name: "source", label: "طريقة بدء التسعير", type: "select", value: "__blank",
          options: [
            ["__blank", "بدء تيرم جديد بالكتالوج الثابت بلا أسعار (موصى به — تسعير جديد مع عرض السعر السابق كمرجع)"],
            ["__catalog", "نسخ الأسعار من الكتالوج الحالي"],
            ["__empty", "قائمة فارغة بلا مرجع"]
          ].concat(lists.map(l => [l.Price_List_ID, `نسخ الأسعار من: ${l.Academic_Year} — ${l.Term} (${statusMeta(l.Status).lbl})`])) },
        { name: "pctAdjust", label: "نسبة تعديل تلقائية % (للنسخ فقط — تجاهلها في وضع البدء بلا أسعار)", type: "number", value: "0" },
        { name: "notes", label: "ملاحظات", placeholder: "اختياري" }
      ],
      ok: "إنشاء المسودة"
    });
    if (!v) return;
    const isBlank = v.source === "__blank";
    const payload = {
      academicYear: v.academicYear, term: v.term, title: v.title, notes: v.notes,
      pctAdjust: isBlank ? 0 : (n(v.pctAdjust) || 0),
      blankPrices: isBlank,
      copyFromListId: isBlank ? latestRef : (v.source && !v.source.startsWith("__") ? v.source : ""),
      copyFromCatalog: v.source === "__catalog"
    };
    const r = await call("SAVE_PRICE_LIST", payload, { block: true });
    toast(r.message, r.success ? "success" : "danger");
    if (r.success) {
      BP.selListId = r.priceList ? r.priceList.Price_List_ID : "";
      BP.fPriced = isBlank ? "unpriced" : "";
      BP.dirty = {};
      await Admin.load();
      Router.render();
    }
  });

  on("bpAddTrackPrice", async plId => {
    const books = (A().books || []).filter(b => b.Book_Status !== "Discontinued");
    const trks = tracksReg().filter(t => t.isActive);
    if (!trks.length) return toast("أضف شُعبة نشطة أولاً من تبويب «المراحل والصفوف والشُّعب»", "warning");
    const v = await UI.form({
      title: "إضافة سعر خاص بشعبة",
      intro: "يسمح بتخصيص سعر مختلف لكتاب معين داخل شعبة محددة دون تكرار سجل الكتاب.",
      fields: [
        { name: "bookId", label: "الكتاب", type: "select", options: books.map(b => [b.Book_ID, `${b.Book_ID} — ${b.Book_Name} (${b.Grade})`]), required: true },
        { name: "track", label: "الشعبة", type: "select", options: trks.map(t => [t.name, `${t.name} (${t.grade})`]), required: true },
        { name: "coverPrice", label: "السعر قبل الخصم (ج.م)", type: "number", required: true },
        { name: "supplierDiscountPct", label: "خصم المكتبة % (اختياري)", type: "number" }
      ],
      ok: "حفظ السعر"
    });
    if (!v) return;
    const r = await call("SAVE_PRICE_ITEMS", { priceListId: plId, items: [{ bookId: v.bookId, track: v.track, coverPrice: n(v.coverPrice), supplierDiscountPct: v.supplierDiscountPct }] }, { block: true });
    toast(r.message, r.success ? "success" : "danger");
    if (r.success) { await Admin.load(); Router.render(); }
  });

  on("bpApprove", async plId => {
    const pl = priceLists().find(l => l.Price_List_ID === plId);
    if (!pl) return;
    const v = await UI.form({
      title: "اعتماد قائمة الأسعار",
      intro: `اعتماد «${pl.Title}» سيثبّت الأسعار كقائمة معتمدة ومحمية من التعديل العشوائي، ولن يمس أي فاتورة أو حجز سابق نهائياً.`,
      fields: [
        { name: "syncToCatalog", label: "تحديث أسعار العرض بالكتالوج للفترة الحالية (لا يؤثر على الفواتير السابقة)", type: "select", value: "yes", options: [["yes", "نعم — اجعلها أسعار الفترة الحالية"], ["no", "لا — اعتمدها كقائمة تاريخية فقط"]] },
        { name: "resetUnpricedToPricing", label: "الكتب غير المسعّرة في هذه القائمة (عند التحديث للكتالوج)", type: "select", value: "yes", options: [["yes", "تعليقها بحالة «جاري التسعير» لمنع حجزها بسعر التيرم السابق (موصى به)"], ["no", "تركها بحالتها الحالية في الكتالوج"]] }
      ],
      ok: "اعتماد القائمة"
    });
    if (!v) return;
    const r = await call("TRANSITION_PRICE_LIST", {
      priceListId: plId, toStatus: "Approved",
      syncToCatalog: v.syncToCatalog === "yes",
      resetUnpricedToPricing: v.syncToCatalog === "yes" && v.resetUnpricedToPricing === "yes"
    }, { block: true });
    toast(r.message, r.success ? "success" : "danger");
    if (r.success) { await Admin.load(); Router.render(); }
  });

  on("bpArchive", async plId => {
    const ok = await UI.confirm({ title: "أرشفة قائمة الأسعار", message: "ستتحول القائمة إلى «مؤرشفة» للقراءة والمقارنة فقط ولن تقبل أي تعديل. هل تريد المتابعة؟", ok: "أرشفة القائمة" });
    if (!ok) return;
    const r = await call("TRANSITION_PRICE_LIST", { priceListId: plId, toStatus: "Archived" }, { block: true });
    toast(r.message, r.success ? "success" : "danger");
    if (r.success) { await Admin.load(); Router.render(); }
  });

  on("bpRevise", async scopeKey => {
    const [bookId, track] = scopeKey.split("|");
    const ex = priceItemsOf(BP.selListId, false).find(i => i.Book_ID === bookId && (i.Track || "") === (track || ""));
    if (!ex) return;
    const v = await UI.form({
      title: "تعديل موثّق لسعر معتمد",
      intro: "سيتم الاحتفاظ بالنسخة الحالية في السجل التاريخي بحالة «نسخة سابقة» وإنشاء نسخة جديدة بإصدار أعلى دون تعديل أي فاتورة صادرة.",
      fields: [
        { name: "coverPrice", label: "السعر الجديد قبل الخصم (ج.م)", type: "number", value: String(ex.Cover_Price), required: true },
        { name: "supplierDiscountPct", label: "خصم المكتبة %", type: "number", value: String(ex.Supplier_Discount_Pct) },
        { name: "reason", label: "سبب التعديل (إلزامي للتدقيق)", placeholder: "مثال: تعديل سعر دار النشر الرسمي", required: true }
      ],
      ok: "توثيق وحفظ النسخة الجديدة"
    });
    if (!v) return;
    const r = await call("REVISE_APPROVED_PRICE", { priceListId: BP.selListId, bookId, track: track || "", coverPrice: n(v.coverPrice), supplierDiscountPct: v.supplierDiscountPct, reason: v.reason }, { block: true });
    toast(r.message, r.success ? "success" : "danger");
    if (r.success) { await Admin.load(); Router.render(); }
  });

  on("bpHistory", plId => {
    const all = (A().priceItems || []).filter(i => i.Price_List_ID === plId && (i.Status === "Superseded" || n(i.Version) > 1))
      .sort((a, b) => String(b.Created_At || "").localeCompare(String(a.Created_At || "")));
    const html = all.length ? `<div class="overflow-x-auto"><table class="tbl w-full text-right text-xs">
      <thead><tr><th>الكتاب</th><th>الشعبة</th><th>الإصدار</th><th>الحالة</th><th>قبل الخصم</th><th>للموظف</th><th>السبب</th><th>التاريخ / بواسطة</th></tr></thead>
      <tbody class="divide-y divide-slate-100">${all.map(i => `<tr>
        <td class="num font-bold">${esc(i.Book_ID)}</td><td>${i.Track ? esc(i.Track) : "عام"}</td>
        <td class="num">v${fmt(i.Version)}</td><td>${statusBadge(i.Status)}</td>
        <td class="num font-bold">${fmt(i.Cover_Price)}</td><td class="num">${fmt(i.Emp_Selling_Price)}</td>
        <td>${esc(i.Change_Reason || "—")}</td><td class="text-[11px] text-slate-500">${esc(String(i.Created_At || "").slice(0, 16))} · ${esc(i.Created_By || "")}</td>
      </tr>`).join("")}</tbody></table></div>` : UI.empty("history", "لا توجد تعديلات سابقة", "");
    UI.open(html, { title: "سجل تعديلات الأسعار الموثّقة", sub: "جميع النسخ السابقة محفوظة للمراجعة والتدقيق", wide: true });
  });

  // أحداث المراحل والشعب والمقررات
  on("bpTrkGrade", g => { BP.trkGrade = g; BP.currDirty = {}; Router.render(); });
  on("bpCurrPeriod", (v, el) => { BP[el.dataset.k] = v.trim(); BP.currDirty = {}; Router.render(); });
  on("bpAddStage", async () => {
    const name = await UI.prompt({ title: "إضافة مرحلة دراسية جديدة", sub: "تُضاف فوراً لجميع القوائم والفلاتر دون تعديل الكود.", required: true });
    if (!name) return;
    const next = stagesArr().concat([name.trim()]);
    const r = await call("SAVE_STAGES_LIST", { stages: next }, { block: true });
    toast(r.message, r.success ? "success" : "danger");
    if (r.success) { await Admin.load(); Router.render(); }
  });
  on("bpDelStage", async st => {
    const ok = await UI.confirm({ title: "حذف مرحلة", message: `حذف المرحلة «${st}» من القائمة؟`, ok: "حذف", tone: "danger" });
    if (!ok) return;
    const next = stagesArr().filter(x => x !== st);
    const r = await call("SAVE_STAGES_LIST", { stages: next }, { block: true });
    toast(r.message, r.success ? "success" : "danger");
    if (r.success) { await Admin.load(); Router.render(); }
  });
  on("bpTrackForm", async id => {
    const ex = id ? tracksReg().find(t => t.id === id) : null;
    const grades = (A().catalog && A().catalog.grades) || [];
    const v = await UI.form({
      title: ex ? "تعديل شعبة دراسية" : "إضافة شعبة / تخصص جديد",
      intro: "يمكنك إضافة أي شعبة جديدة للثانوية العامة أو البكالوريا أو أي صف آخر.",
      fields: [
        { name: "name", label: "اسم الشعبة / التخصص", value: ex ? ex.name : "", placeholder: "مثال: علمي علوم، بكالوريا — طب وعلوم حياة", required: true },
        { name: "grade", label: "الصف الدراسي", type: "select", value: ex ? ex.grade : BP.trkGrade, options: grades.map(g => [g.label, `${g.label} (${g.stage})`]), required: true },
        { name: "notes", label: "وصف أو ملاحظات (اختياري)", value: ex ? ex.notes : "" }
      ],
      ok: ex ? "حفظ التعديل" : "إضافة الشعبة"
    });
    if (!v) return;
    const r = await call("SAVE_TRACKS_REGISTRY", { op: "upsert", id: ex ? ex.id : "", name: v.name, grade: v.grade, notes: v.notes }, { block: true });
    toast(r.message, r.success ? "success" : "danger");
    if (r.success) { BP.trkGrade = v.grade; await Admin.load(); Router.render(); }
  });
  on("bpTrackToggle", async id => {
    const ex = tracksReg().find(t => t.id === id);
    if (!ex) return;
    const r = await call("SAVE_TRACKS_REGISTRY", { op: "upsert", id: ex.id, name: ex.name, grade: ex.grade, notes: ex.notes, isActive: !ex.isActive }, { block: true });
    toast(r.message, r.success ? "success" : "danger");
    if (r.success) { await Admin.load(); Router.render(); }
  });
  on("bpTrackDel", async id => {
    const ex = tracksReg().find(t => t.id === id);
    if (!ex) return;
    const ok = await UI.confirm({ title: "حذف شعبة", message: `حذف الشعبة «${ex.name}» من الصف ${ex.grade}؟ لن تُحذف سجلات المقررات التاريخية للأعوام السابقة.`, ok: "حذف", tone: "danger" });
    if (!ok) return;
    const r = await call("SAVE_TRACKS_REGISTRY", { op: "delete", id }, { block: true });
    toast(r.message, r.success ? "success" : "danger");
    if (r.success) { await Admin.load(); Router.render(); }
  });
  on("bpCurrToggle", pair => {
    const [bid, trk] = pair.split("|");
    const bk = (A().books || []).find(b => b.Book_ID === bid);
    if (!bk) return;
    const curRows = (A().trackCurriculum || []).filter(c => c.Academic_Year === BP.currYear && c.Term === BP.currTerm && c.Book_ID === bid);
    const base = curRows.length ? curRows.map(c => c.Track_Name).filter(Boolean) : String(bk.Tracks || "").split(/[،,]/).map(s => s.trim()).filter(Boolean);
    const arr = (BP.currDirty[bid] || base).slice();
    const i = arr.indexOf(trk);
    if (i >= 0) arr.splice(i, 1); else arr.push(trk);
    BP.currDirty[bid] = arr;
    Router.render();
  });
  on("bpCurrSubAll", (v, el) => {
    if (!v) return;
    const sub = el.dataset.sub;
    (A().books || []).filter(b => b.Grade === BP.trkGrade && (b.Subject || "—") === sub && b.Book_Status !== "Discontinued")
      .forEach(b => { BP.currDirty[b.Book_ID] = v === "__all" ? [] : [v]; });
    Router.render();
  });
  on("bpSaveCurr", async () => {
    const rows = Object.keys(BP.currDirty).map(bookId => ({ bookId, tracks: BP.currDirty[bookId] }));
    if (!rows.length) return toast("لا توجد تعديلات للحفظ", "info");
    const r = await call("SAVE_TRACK_CURRICULUM", { academicYear: BP.currYear, term: BP.currTerm, rows, syncToCatalog: true }, { block: true });
    toast(r.message, r.success ? "success" : "danger");
    if (r.success) { BP.currDirty = {}; await Admin.load(); Router.render(); }
  });

  window.BooksPro = { state: BP, renderPricing, renderTracks };
})();
