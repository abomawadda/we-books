import { describe, it, expect } from 'vitest';
import { ceilMoney, ceilDiv, percentToBps } from '../money.js';

describe('ceilMoney', () => {
  it('يقرّب لأعلى جنيه', () => {
    expect(ceilMoney(123.15)).toBe(124);
    expect(ceilMoney(123.01)).toBe(124);
    expect(ceilMoney(123)).toBe(123);
  });
  it('يتجاهل ضوضاء الفاصلة العائمة', () => {
    expect(ceilMoney(0.1 * 3 * 10)).toBe(3);
    expect(ceilMoney(100 * 1.1)).toBe(110);
  });
});

describe('ceilDiv', () => {
  it('قسمة صحيحة لأعلى', () => {
    expect(ceilDiv(10, 5)).toBe(2);
    expect(ceilDiv(11, 5)).toBe(3);
    expect(ceilDiv(0, 5)).toBe(0);
  });
});

it('percentToBps', () => {
  expect(percentToBps('20%')).toBe(2000);
  expect(percentToBps(12.5)).toBe(1250);
  expect(percentToBps(0.07 * 100)).toBe(700);
});
