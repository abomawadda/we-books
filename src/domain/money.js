// قاعدة ملزمة: كل المبالغ أعداد صحيحة بالجنيه، وأي ناتج كسري يُقرَّب لأعلى (123.15 → 124).
// النِّسب تُخزَّن بنقاط الأساس كأعداد صحيحة: 10000 = 100%، 2000 = 20%.

export const BPS = 10000;

/** تقريب لأعلى جنيه صحيح، مع تحمّل أخطاء الفاصلة العائمة (123.0000000001 → 123). */
export function ceilMoney(x) {
  if (!Number.isFinite(x)) throw new TypeError('مبلغ غير صالح');
  const r = Math.round(x);
  return Math.abs(x - r) < 1e-9 ? r : Math.ceil(x);
}

/** قسمة صحيحة مع التقريب لأعلى (للأعداد الموجبة). */
export function ceilDiv(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || b <= 0) throw new TypeError('قسمة غير صالحة');
  return a >= 0 ? Math.floor((a + b - 1) / b) : -Math.floor(-a / b);
}

export function assertMoney(v, name = 'المبلغ') {
  if (!Number.isInteger(v) || v < 0) throw new TypeError(`${name} يجب أن يكون عددًا صحيحًا غير سالب`);
  return v;
}

export function assertBps(v, name = 'النسبة') {
  if (!Number.isInteger(v) || v < 0 || v > BPS) throw new TypeError(`${name} يجب أن تكون بين 0% و100%`);
  return v;
}

/** "12.5" أو 12.5 (نسبة مئوية) → 1250 نقطة أساس. */
export function percentToBps(p) {
  const n = typeof p === 'string' ? Number(p.replace('%', '').trim()) : p;
  if (!Number.isFinite(n)) throw new TypeError('نسبة غير صالحة');
  return Math.round(n * 100);
}

export const bpsToPercent = (bps) => bps / 100;

const nf = new Intl.NumberFormat('ar-EG');
// الإشارة السالبة تُعزل لتظهر صحيحة داخل نص RTL.
export const formatMoney = (v) => (v < 0 ? `\u2068−${nf.format(-v)}\u2069 ج.م` : `${nf.format(v)} ج.م`);
export const formatPercent = (bps) => `${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(bps / 100)}٪`;
