// التنفيذ الحالي على IndexedDB. أي محوّل بديل (Firestore) يجب أن يوفّر نفس الدوال.
import { openDB } from 'idb';
import { ALL_COLLECTIONS } from '../collections.js';

const DB_VERSION = 1;

export function createIdbAdapter({ name = 'we-books', idbFactory } = {}) {
  if (idbFactory) globalThis.indexedDB = idbFactory;
  const dbp = openDB(name, DB_VERSION, {
    upgrade(db) {
      for (const c of ALL_COLLECTIONS) if (!db.objectStoreNames.contains(c)) db.createObjectStore(c, { keyPath: 'id' });
    },
  });

  return {
    async get(col, id) { return (await dbp).get(col, id); },
    async getAll(col) { return (await dbp).getAll(col); },
    async put(col, doc) { await (await dbp).put(col, doc); return doc; },

    /** يكتب عدة مستندات في معاملة ذرية واحدة: writes = [{ col, doc }] */
    async putMany(writes) {
      const db = await dbp;
      const stores = [...new Set(writes.map((w) => w.col))];
      const tx = db.transaction(stores, 'readwrite');
      await Promise.all([...writes.map((w) => tx.objectStore(w.col).put(w.doc)), tx.done]);
    },

    /** زيادة عدّاد ذريًا وإرجاع القيمة الجديدة. */
    async increment(col, id) {
      const db = await dbp;
      const tx = db.transaction(col, 'readwrite');
      const cur = (await tx.store.get(id)) ?? { id, value: 0 };
      cur.value += 1;
      await tx.store.put(cur);
      await tx.done;
      return cur.value;
    },
  };
}
