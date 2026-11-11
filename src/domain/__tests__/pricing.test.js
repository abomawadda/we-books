import { describe, it, expect } from 'vitest';
import {
  unitCost, employeePrice, unitMargin, supplierInvoiceTotals, maxSafeDiscount, simulateDiscount,
} from '../pricing.js';

describe('التكلفة', () => {
  it('P(1-d)(1-q) مقرّبة لأعلى', () => {
    expect(unitCost(100, 2000, 500)).toBe(76);       // 100×0.8×0.95 = 76
    expect(unitCost(123, 1500, 500)).toBe(100);      // 99.3225 → 100
    expect(unitCost(50, 0, 0)).toBe(50);
  });

  it('خصم الكمية على إجمالي الفاتورة بعد خصم الأصناف', () => {
    const t = supplierInvoiceTotals([
      { coverPrice: 100, qty: 3, itemDiscountBps: 2000 },  // 240
      { coverPrice: 75, qty: 1, itemDiscountBps: 1000 },   // 67.5 → 68
    ], 500);
    expect(t.gross).toBe(375);
    expect(t.afterItems).toBe(308);
    expect(t.itemDiscount).toBe(67);
    expect(t.net).toBe(293);                // 308 × 0.95 = 292.6 → 293
    expect(t.quantityDiscount).toBe(15);
    expect(t.afterItems - t.quantityDiscount).toBe(t.net);
  });
});

describe('سعر الموظف', () => {
  it('P(1-D) مقرّب لأعلى', () => {
    expect(employeePrice(100, 2500)).toBe(75);
    expect(employeePrice(123, 2500)).toBe(93);       // 92.25 → 93
    expect(employeePrice(80, 0)).toBe(80);
  });
  it('الهامش سالب عندما خصم المكتبة أقل من D', () => {
    expect(unitMargin(100, 1000, 0, 2500)).toBe(-15); // 75 − 90
    expect(unitMargin(100, 3000, 0, 2500)).toBe(5);
  });
  it('يرفض المدخلات غير الصحيحة', () => {
    expect(() => employeePrice(10.5, 0)).toThrow();
    expect(() => employeePrice(10, 12000)).toThrow();
  });
});

describe('حد الخصم الآمن', () => {
  it('مثال المواصفات: 500,000 غلاف، d=20%، q=5%، E=15,000 → 21%', () => {
    const r = maxSafeDiscount([{ coverPrice: 100, qty: 5000, itemDiscountBps: 2000 }], 500, 15000);
    expect(r.gross).toBe(500000);
    expect(r.net).toBe(380000);
    expect(r.maxDiscountBps).toBe(2100);
  });

  it('إعلان 25% في نفس المثال = عجز 20,000', () => {
    const s = simulateDiscount([{ coverPrice: 100, qty: 5000, itemDiscountBps: 2000 }], 500, 15000, 2500);
    expect(s.revenue).toBe(375000);
    expect(s.result).toBe(-20000);
    expect(s.safe).toBe(false);
  });

  it('D الأقصى يغطي التكلفة دائمًا (لا عجز عند تطبيقه)', () => {
    const items = [
      { coverPrice: 137, qty: 41, itemDiscountBps: 1750 },
      { coverPrice: 89, qty: 120, itemDiscountBps: 2200 },
      { coverPrice: 210, qty: 7, itemDiscountBps: 900 },
    ];
    const { maxDiscountBps } = maxSafeDiscount(items, 400, 1234);
    const s = simulateDiscount(items, 400, 1234, maxDiscountBps);
    expect(s.result).toBeGreaterThanOrEqual(0);
    expect(s.safe).toBe(true);
  });

  it('يرصد الكتب المباعة بخسارة', () => {
    const s = simulateDiscount([
      { code: 'A', coverPrice: 100, qty: 10, itemDiscountBps: 3000 },
      { code: 'B', coverPrice: 100, qty: 4, itemDiscountBps: 1000 },
    ], 0, 0, 2500);
    expect(s.lossBooks.map((b) => b.code)).toEqual(['B']);
    expect(s.lossBooks[0].totalLoss).toBe(-60);
  });

  it('مزيج فارغ', () => {
    expect(maxSafeDiscount([], 500, 0).maxDiscountBps).toBe(0);
  });
});
