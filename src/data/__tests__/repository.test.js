import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { createIdbAdapter } from '../idb/adapter.js';
import { createRepository, PermissionError, ForbiddenDeleteError } from '../repository.js';
import { C } from '../collections.js';

let n = 0;
const fresh = () => createRepository(createIdbAdapter({ name: `t${n++}` }));
const manager = { userId: 'u1', role: 'manager' };

describe('طبقة البيانات', () => {
  it('ينشئ ويقرأ ويسجّل في سجل المراجعة', async () => {
    const repo = fresh();
    const b = await repo.create(C.books, { code: 'X1', coverPrice: 100 }, manager);
    expect((await repo.get(C.books, b.id)).code).toBe('X1');
    const logs = await repo.list(C.auditLogs);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'create', userId: 'u1', collection: C.books });
  });

  it('يفرض الصلاحيات حسب الدور', async () => {
    const repo = fresh();
    await expect(repo.create(C.books, { code: 'A' }, { userId: 'u2', role: 'auditor' })).rejects.toBeInstanceOf(PermissionError);
    await expect(repo.create(C.books, { code: 'A' }, null)).rejects.toBeInstanceOf(PermissionError);
  });

  it('لا يحذف المستندات المالية', async () => {
    const repo = fresh();
    await expect(repo.remove(C.receipts, 'x')).rejects.toBeInstanceOf(ForbiddenDeleteError);
    await expect(repo.remove(C.supplierInvoices, 'x')).rejects.toBeInstanceOf(ForbiddenDeleteError);
  });

  it('يرفض تعديل مستند مقفل', async () => {
    const repo = fresh();
    const s = await repo.create(C.seasons, { name: 'م', locked: true }, manager);
    await expect(repo.update(C.seasons, s.id, { name: 'ب' }, manager)).rejects.toBeInstanceOf(PermissionError);
  });

  it('الترقيم التسلسلي متصل بلا فجوات', async () => {
    const repo = fresh();
    const nums = await Promise.all([1, 2, 3, 4].map(() => repo.nextNumber('receipt')));
    expect(nums.sort()).toEqual([1, 2, 3, 4]);
  });
});
