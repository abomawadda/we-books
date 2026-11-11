import { it, expect } from 'vitest';
import { parseCatalogRows } from '../catalogImport.js';

it('يحوّل الصفوف ويقرّب السعر لأعلى ويقبل صيغ الخصم', () => {
  const { items, errors } = parseCatalogRows([
    { 'الكود': 'M1', 'الاسم': 'الأضواء رياضيات', 'الصف': 'الأول الثانوي', 'سعر الغلاف': 123.15, 'خصم الصنف %': 20 },
    { 'الكود': 'M2', 'الاسم': 'المعاصر عربي', 'سعر الغلاف': 90, 'خصم الصنف %': 0.15 },
    { 'الكود': 'M3', 'الاسم': 'سلاح التلميذ', 'سعر الغلاف': 60, 'خصم الصنف %': '17.5%' },
  ]);
  expect(errors).toEqual([]);
  expect(items.map((x) => [x.code, x.coverPrice, x.itemDiscountBps])).toEqual([
    ['M1', 124, 2000], ['M2', 90, 1500], ['M3', 60, 1750],
  ]);
});

it('يرصد الأخطاء والتكرار ويتجاهل الصفوف الفارغة', () => {
  const { items, errors } = parseCatalogRows([
    { 'الكود': 'A', 'الاسم': 'ك', 'سعر الغلاف': 50 },
    { 'الكود': 'A', 'الاسم': 'ك2', 'سعر الغلاف': 50 },
    { 'الكود': '', 'الاسم': '' },
    { 'الكود': 'B', 'الاسم': 'ك3', 'سعر الغلاف': 'abc' },
  ]);
  expect(items).toHaveLength(1);
  expect(errors.map((e) => e.row)).toEqual([3, 5]);
});
