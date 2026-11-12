/* ============================================================================
 * رسوم توضيحية خفيفة (SVG داخلي بألوان المنصة) لحالات الشاشات الفارغة والانتظار
 * ========================================================================== */
"use strict";
const ART_C = { p: "#552c83", p2: "#7c4bb6", l: "#ece3f7", l2: "#f6f2fb", g: "#f9b224", g2: "#fde08a", w: "#ffffff", s: "#cbd5e1" };
const Art = {
  wrap(inner, cls) { return `<svg viewBox="0 0 200 150" class="${cls || "w-44 h-auto"}" aria-hidden="true"><ellipse cx="100" cy="136" rx="74" ry="8" fill="${ART_C.l}"/>${inner}</svg>`; },
  /** تقويم وساعة: موعد قادم (فتح الحجز/التسليم) */
  calendar(cls) { const c = ART_C; return Art.wrap(`
    <rect x="38" y="30" width="96" height="94" rx="14" fill="${c.w}" stroke="${c.p2}" stroke-width="3"/>
    <rect x="38" y="30" width="96" height="26" rx="14" fill="${c.p}"/><rect x="38" y="44" width="96" height="12" fill="${c.p}"/>
    <rect x="58" y="20" width="8" height="20" rx="4" fill="${c.p2}"/><rect x="106" y="20" width="8" height="20" rx="4" fill="${c.p2}"/>
    ${[0, 1, 2].map(r => [0, 1, 2, 3].map(k => `<rect x="${50 + k * 19}" y="${66 + r * 17}" width="12" height="10" rx="3" fill="${r === 1 && k === 2 ? c.g : c.l}"/>`).join("")).join("")}
    <circle cx="140" cy="104" r="26" fill="${c.g}"/><circle cx="140" cy="104" r="20" fill="${c.w}"/>
    <path d="M140 92v13l9 6" stroke="${c.p}" stroke-width="4" stroke-linecap="round" fill="none"/>`, cls); },
  /** كتب مكدسة: الكتالوج/ابدأ الحجز */
  books(cls) { const c = ART_C; return Art.wrap(`
    <rect x="44" y="104" width="112" height="22" rx="6" fill="${c.p}"/><rect x="50" y="110" width="100" height="4" rx="2" fill="${c.p2}"/>
    <rect x="54" y="80" width="96" height="24" rx="6" fill="${c.g}"/><rect x="60" y="86" width="84" height="4" rx="2" fill="${c.g2}"/>
    <rect x="48" y="56" width="104" height="24" rx="6" fill="${c.p2}"/><rect x="54" y="62" width="92" height="4" rx="2" fill="${c.l}"/>
    <path d="M150 40l14-14M160 52l18-4M146 30l-2-14" stroke="${c.g}" stroke-width="4" stroke-linecap="round"/>`, cls); },
  /** طرد بعلامة صح: جاهز للتسليم */
  box(cls) { const c = ART_C; return Art.wrap(`
    <path d="M52 58l48-22 48 22v54l-48 22-48-22z" fill="${c.g2}" stroke="${c.g}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M52 58l48 22 48-22M100 80v54" stroke="${c.g}" stroke-width="3" fill="none"/>
    <path d="M74 47l48 22" stroke="${c.p2}" stroke-width="6"/>
    <circle cx="146" cy="44" r="20" fill="${c.p}"/><path d="M136 44l7 7 13-14" stroke="${c.w}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`, cls); },
  /** شاحنة: جاري التجهيز والشحن */
  truck(cls) { const c = ART_C; return Art.wrap(`
    <rect x="30" y="58" width="90" height="56" rx="8" fill="${c.p2}"/><rect x="40" y="68" width="34" height="20" rx="4" fill="${c.l}"/>
    <path d="M120 74h28l20 22v18h-48z" fill="${c.p}"/><rect x="132" y="80" width="18" height="14" rx="3" fill="${c.l}"/>
    <circle cx="62" cy="118" r="12" fill="${c.p}"/><circle cx="62" cy="118" r="5" fill="${c.g}"/><circle cx="146" cy="118" r="12" fill="${c.p}"/><circle cx="146" cy="118" r="5" fill="${c.g}"/>
    <path d="M14 76h12M8 90h18M16 104h10" stroke="${c.s}" stroke-width="4" stroke-linecap="round"/>`, cls); },
  /** سلة فارغة */
  cart(cls) { const c = ART_C; return Art.wrap(`
    <path d="M36 42h18l14 62h70l14-46H62" stroke="${c.p}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="${c.l2}"/>
    <circle cx="78" cy="120" r="9" fill="${c.p2}"/><circle cx="130" cy="120" r="9" fill="${c.p2}"/>
    <path d="M92 70l20 20M112 70l-20 20" stroke="${c.g}" stroke-width="5" stroke-linecap="round"/>`, cls); },
  /** احتفال: استلمت كل كتبك */
  party(cls) { const c = ART_C; return Art.wrap(`
    <path d="M60 126l26-80 54 54z" fill="${c.g}"/><path d="M70 96l28 28M78 72l42 42" stroke="${c.g2}" stroke-width="5"/>
    ${[[120, 34, c.p2], [150, 58, c.g], [140, 24, c.p], [164, 86, c.p2], [100, 26, c.g], [170, 40, c.p]].map(([x, y, f]) => `<circle cx="${x}" cy="${y}" r="5" fill="${f}"/>`).join("")}
    <path d="M110 50c10-14 22-14 30-6M128 74c14-4 24 2 28 12" stroke="${c.p2}" stroke-width="4" stroke-linecap="round" fill="none"/>`, cls); },
  /** جرس: الإشعارات */
  bell(cls) { const c = ART_C; return Art.wrap(`
    <path d="M100 30c-24 0-38 18-38 40v22l-10 14h96l-10-14V70c0-22-14-40-38-40z" fill="${c.p2}"/>
    <rect x="92" y="20" width="16" height="12" rx="6" fill="${c.p}"/><circle cx="100" cy="114" r="10" fill="${c.g}"/>
    <path d="M150 46c6 6 8 14 6 22M50 46c-6 6-8 14-6 22" stroke="${c.g}" stroke-width="4" stroke-linecap="round" fill="none"/>`, cls); },
  /** محفظة: المدفوعات */
  wallet(cls) { const c = ART_C; return Art.wrap(`
    <rect x="40" y="48" width="120" height="76" rx="14" fill="${c.p}"/><rect x="40" y="48" width="120" height="20" rx="10" fill="${c.p2}"/>
    <rect x="114" y="78" width="46" height="26" rx="8" fill="${c.l}"/><circle cx="128" cy="91" r="6" fill="${c.g}"/>
    <rect x="58" y="30" width="62" height="26" rx="6" fill="${c.g2}" transform="rotate(-8 89 43)"/>`, cls); },
  /** حالة فارغة بصورة توضيحية بدل الأيقونة */
  empty(art, title, sub, action) {
    return `<div class="flex flex-col items-center justify-center text-center py-8 px-6">${(Art[art] || Art.books)("w-40 sm:w-48 h-auto")}
      <div class="font-display font-bold text-slate-800 mt-3 text-[16px]">${esc(title)}</div>${sub ? `<div class="text-sm text-slate-500 mt-1 max-w-xs leading-relaxed">${esc(sub)}</div>` : ""}${action || ""}</div>`;
  }
};
