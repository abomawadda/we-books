// معادلات المواصفات (قسم «حساب المكتبة والمصروفات والنموذج المالي»).
// P سعر الغلاف (جنيه صحيح)، d خصم الصنف، q خصم الكمية، D خصم الموظف — كلها بنقاط الأساس.
// قاعدة العقد: خصم الكمية يُحسب على إجمالي الفاتورة بعد خصم الأصناف.
import { BPS, ceilDiv, assertMoney, assertBps } from './money.js';

/** صافي سطر بعد خصم الصنف = ⌈P × n × (1−d)⌉ */
export function lineNetAfterItemDiscount(P, n, d) {
  assertMoney(P, 'سعر الغلاف'); assertBps(d, 'خصم الصنف');
  if (!Number.isInteger(n) || n < 0) throw new TypeError('الكمية يجب أن تكون عددًا صحيحًا');
  return ceilDiv(P * n * (BPS - d), BPS);
}

/**
 * تكلفة فاتورة المكتبة.
 * lines: [{ coverPrice, qty, itemDiscountBps }]
 * إجمالي بعد خصم الأصناف = Σ ⌈P n (1−d)⌉، ثم الصافي = ⌈الإجمالي × (1−q)⌉.
 */
export function supplierInvoiceTotals(lines, q) {
  assertBps(q, 'خصم الكمية');
  let gross = 0;
  let afterItems = 0;
  for (const l of lines) {
    gross += l.coverPrice * l.qty;
    afterItems += lineNetAfterItemDiscount(l.coverPrice, l.qty, l.itemDiscountBps);
  }
  const net = ceilDiv(afterItems * (BPS - q), BPS);
  return { gross, itemDiscount: gross - afterItems, afterItems, quantityDiscount: afterItems - net, net };
}

/** تكلفة النسخة الواحدة للتحليل = ⌈P (1−d)(1−q)⌉ */
export function unitCost(P, d, q) {
  assertMoney(P, 'سعر الغلاف'); assertBps(d, 'خصم الصنف'); assertBps(q, 'خصم الكمية');
  return ceilDiv(P * (BPS - d) * (BPS - q), BPS * BPS);
}

/** سعر الموظف = ⌈P (1−D)⌉ */
export function employeePrice(P, D) {
  assertMoney(P, 'سعر الغلاف'); assertBps(D, 'خصم الموظف');
  return ceilDiv(P * (BPS - D), BPS);
}

/** هامش النسخة = سعر الموظف − التكلفة (قد يكون سالبًا). */
export function unitMargin(P, d, q, D) {
  return employeePrice(P, D) - unitCost(P, d, q);
}

/**
 * حد الخصم الآمن: D_max = 1 − (تكلفة الفاتورة + E) / Σ P n
 * يُعاد بنقاط الأساس مقرّبًا لأسفل (الجانب الآمن)، وقد يكون سالبًا إن كانت التكلفة أعلى من الغلاف.
 * items: [{ coverPrice, qty, itemDiscountBps }]
 */
export function maxSafeDiscount(items, q, expenses = 0) {
  assertMoney(expenses, 'المصروفات');
  const t = supplierInvoiceTotals(items, q);
  if (t.gross === 0) return { ...t, expenses, totalCost: expenses, maxDiscountBps: 0 };
  const totalCost = t.net + expenses;
  const maxDiscountBps = Math.floor(((t.gross - totalCost) * BPS) / t.gross);
  return { ...t, expenses, totalCost, maxDiscountBps };
}

/** محاكاة إعلان خصم D: الإيراد، الفائض/العجز، والكتب المباعة بخسارة. */
export function simulateDiscount(items, q, expenses, D) {
  const base = maxSafeDiscount(items, q, expenses);
  let revenue = 0;
  const lossBooks = [];
  for (const it of items) {
    revenue += employeePrice(it.coverPrice, D) * it.qty;
    const margin = unitMargin(it.coverPrice, it.itemDiscountBps, q, D);
    if (margin < 0) lossBooks.push({ ...it, unitMargin: margin, totalLoss: margin * it.qty });
  }
  return {
    ...base,
    discountBps: D,
    revenue,
    employeeSavings: base.gross - revenue,
    result: revenue - base.net - expenses, // موجب = فائض، سالب = عجز
    safe: D <= base.maxDiscountBps,
    lossBooks,
  };
}
