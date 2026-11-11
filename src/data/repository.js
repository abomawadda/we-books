// الواجهة الثابتة للبيانات. الشاشات لا تعرف شيئًا عن IndexedDB أو Firestore.
import { C, NO_DELETE } from './collections.js';
import { canWrite } from '../domain/roles.js';

export class PermissionError extends Error {}
export class ForbiddenDeleteError extends Error {}

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function createRepository(adapter, { now = () => new Date().toISOString() } = {}) {
  function guard(actor, col) {
    if (!actor?.userId || !actor?.role) throw new PermissionError('يجب اختيار المستخدم والدور أولًا');
    if (!canWrite(actor.role, col)) throw new PermissionError('هذا الدور لا يملك صلاحية التعديل هنا');
  }
  const audit = (actor, action, col, docId, before, after) => ({
    col: C.auditLogs,
    doc: { id: newId(), at: now(), userId: actor.userId, role: actor.role, action, collection: col, docId, before: before ?? null, after: after ?? null },
  });

  return {
    get: (col, id) => adapter.get(col, id),

    async list(col, filter) {
      const all = await adapter.getAll(col);
      return filter ? all.filter(filter) : all;
    },

    async create(col, data, actor) {
      guard(actor, col);
      const doc = { ...data, id: data.id ?? newId(), createdAt: now(), createdBy: actor.userId, updatedAt: now() };
      await adapter.putMany([{ col, doc }, audit(actor, 'create', col, doc.id, null, doc)]);
      return doc;
    },

    async update(col, id, patch, actor) {
      guard(actor, col);
      const before = await adapter.get(col, id);
      if (!before) throw new Error('المستند غير موجود');
      if (before.locked) throw new PermissionError('المستند مقفل ولا يُعدَّل؛ استخدم مستندًا عكسيًا');
      const after = { ...before, ...patch, id, updatedAt: now(), updatedBy: actor.userId };
      await adapter.putMany([{ col, doc: after }, audit(actor, 'update', col, id, before, after)]);
      return after;
    },

    /** إنشاء/تحديث عدة مستندات ذريًا (مثل استيراد الكتالوج). items = [{ id?, ...data }] */
    async upsertMany(col, items, actor) {
      guard(actor, col);
      const writes = [];
      for (const data of items) {
        const before = data.id ? await adapter.get(col, data.id) : null;
        const doc = before
          ? { ...before, ...data, updatedAt: now(), updatedBy: actor.userId }
          : { ...data, id: data.id ?? newId(), createdAt: now(), createdBy: actor.userId, updatedAt: now() };
        writes.push({ col, doc }, audit(actor, before ? 'update' : 'create', col, doc.id, before, doc));
      }
      await adapter.putMany(writes);
      return writes.filter((w) => w.col === col).map((w) => w.doc);
    },

    async remove(col) {
      if (NO_DELETE.has(col)) throw new ForbiddenDeleteError('لا يُحذف هذا المستند؛ الإلغاء يكون بمستند عكسي أو بالإيقاف');
      throw new ForbiddenDeleteError('الحذف غير مدعوم');
    },

    /** ترقيم تسلسلي بلا فجوات لنوع مستند. */
    nextNumber: (type) => adapter.increment(C.counters, type),
  };
}
