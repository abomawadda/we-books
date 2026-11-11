// تحويل صفوف Excel إلى كتب مع التحقق. منطق خالص قابل للاختبار.
import { ceilMoney, percentToBps } from './money.js';

export const TEMPLATE_HEADERS = ['الكود', 'الاسم', 'الصف', 'المادة', 'الترم', 'سعر الغلاف', 'خصم الصنف %'];

const ALIASES = {
  code: ['الكود', 'كود', 'code'],
  name: ['الاسم', 'اسم الكتاب', 'name'],
  grade: ['الصف', 'grade'],
  subject: ['المادة', 'subject'],
  term: ['الترم', 'term'],
  coverPrice: ['سعر الغلاف', 'السعر', 'price'],
  itemDiscount: ['خصم الصنف %', 'خصم الصنف', 'الخصم', 'discount'],
};

const norm = (s) => String(s ?? '').trim().toLowerCase();

function pick(row, field) {
  const keys = Object.keys(row);
  for (const a of ALIASES[field]) {
    const k = keys.find((x) => norm(x) === norm(a));
    if (k !== undefined) return row[k];
  }
  return undefined;
}

/** خصم الصنف قد يأتي 20 أو "20%" أو 0.2 (تنسيق نسبة في Excel). */
function parseDiscount(v) {
  if (v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace('%', '').trim());
  if (!Number.isFinite(n)) return NaN;
  return percentToBps(n > 0 && n < 1 ? n * 100 : n);
}

/**
 * rows: كائنات من sheet_to_json.
 * يعيد { items, errors } — items جاهزة للحفظ (id = الكود)، errors = [{ row, message }].
 */
export function parseCatalogRows(rows) {
  const items = [];
  const errors = [];
  const seen = new Set();
  rows.forEach((row, i) => {
    const line = i + 2; // الصف 1 عناوين
    const code = String(pick(row, 'code') ?? '').trim();
    const name = String(pick(row, 'name') ?? '').trim();
    if (!code && !name) return; // صف فارغ
    const priceRaw = Number(pick(row, 'coverPrice'));
    const d = parseDiscount(pick(row, 'itemDiscount'));
    const errs = [];
    if (!code) errs.push('الكود مفقود');
    else if (seen.has(code)) errs.push('كود مكرر في الملف');
    if (!name) errs.push('الاسم مفقود');
    if (!Number.isFinite(priceRaw) || priceRaw <= 0) errs.push('سعر الغلاف غير صالح');
    if (!Number.isFinite(d) || d < 0 || d >= 10000) errs.push('خصم الصنف غير صالح');
    if (errs.length) { errors.push({ row: line, code, message: errs.join('، ') }); return; }
    seen.add(code);
    items.push({
      id: code,
      code,
      name,
      grade: String(pick(row, 'grade') ?? '').trim(),
      subject: String(pick(row, 'subject') ?? '').trim(),
      term: String(pick(row, 'term') ?? '').trim(),
      coverPrice: ceilMoney(priceRaw),
      itemDiscountBps: d,
      available: true,
    });
  });
  return { items, errors };
}
