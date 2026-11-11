// مخزن Firestore: كل عملية = transaction واحدة (قراءة الجداول اللازمة ← تنفيذ ← كتابة)
'use strict';
const strip = d => { const o = Object.assign({}, d); delete o._ord; return o; };

function firestoreStore(db) {
  return {
    transact(fn, { readOnly = false } = {}) {
      return db.runTransaction(async t => fn({
        load: async name => (await t.get(db.collection(name))).docs
          .map(d => ({ id: d.id, ord: d.get('_ord') || 0, data: strip(d.data()) }))
          .sort((a, b) => a.ord - b.ord),
        commit: writes => writes.forEach(w => {
          const ref = db.collection(w.table).doc(w.id);
          if (w.del) t.delete(ref); else t.set(ref, Object.assign({}, w.data, { _ord: w.ord }));
        })
      }), readOnly ? { readOnly: true } : { maxAttempts: 15 });
    }
  };
}
module.exports = { firestoreStore };
