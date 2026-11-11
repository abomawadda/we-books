// مخزن Firestore: كل عملية = transaction واحدة (قراءة الجداول اللازمة ← تنفيذ ← كتابة)
//
// فهرس الموظف (_emp_index/{Emp_ID}): لكل جدول من الجداول المفهرسة قائمة بمعرّفات مستندات الموظف.
// العمليات ذات النطاق المحدود (الحجز) تقرأ الفهرس ثم المستندات بمعرّفاتها، بلا أي استعلام،
// فلا تتعارض transactions الموظفين المختلفين (الاستعلامات داخل transaction تقفل نطاقاً
// يتعارض مع الإضافات في نفس المجموعة). الفهرس يُحدَّث مع كل كتابة بـ arrayUnion/arrayRemove.
'use strict';
const { FieldValue } = require('firebase-admin/firestore');
const strip = d => { const o = Object.assign({}, d); delete o._ord; return o; };
const INDEX = '_emp_index';

function firestoreStore(db, { indexed = [] } = {}) {
  const isIdx = new Set(indexed);
  const toRec = d => ({ id: d.id, ord: d.get('_ord') || 0, data: strip(d.data()) });
  return {
    transact(fn, { readOnly = false } = {}) {
      return db.runTransaction(async t => { global.__wbTries = (global.__wbTries || 0) + 1; return fn({
        load: async (name, f) => {
          let docs;
          if (f && isIdx.has(name) && f.field === 'Emp_ID') {
            const ix = await t.get(db.collection(INDEX).doc(String(f.value)));
            const ids = (ix.exists && ix.get(name)) || [];
            docs = ids.length ? (await t.getAll(...ids.map(id => db.collection(name).doc(id)))).filter(d => d.exists) : [];
          } else {
            docs = (await t.get(f ? db.collection(name).where(f.field, '==', f.value) : db.collection(name))).docs;
          }
          return docs.map(toRec).sort((a, b) => a.ord - b.ord);
        },
        commit: writes => {
          const add = new Map(), rem = new Map(); // empId -> {table: [ids]}
          const push = (m, emp, table, id) => { if (!emp) return; const k = String(emp); const o = m.get(k) || {}; (o[table] = o[table] || []).push(id); m.set(k, o); };
          writes.forEach(w => {
            const ref = db.collection(w.table).doc(w.id);
            if (w.del) { t.delete(ref); if (isIdx.has(w.table)) push(rem, w.prev && w.prev.Emp_ID, w.table, w.id); }
            else { t.set(ref, Object.assign({}, w.data, { _ord: w.ord })); if (isIdx.has(w.table)) push(add, w.data.Emp_ID, w.table, w.id); }
          });
          // arrayUnion و arrayRemove لنفس الحقل لا يجتمعان في كتابة واحدة: الحذف أولاً ثم الإضافة
          rem.forEach((o, emp) => { const u = {}; Object.keys(o).forEach(tb => { u[tb] = FieldValue.arrayRemove(...o[tb]); }); t.set(db.collection(INDEX).doc(emp), u, { merge: true }); });
          add.forEach((o, emp) => { const u = {}; Object.keys(o).forEach(tb => { u[tb] = FieldValue.arrayUnion(...o[tb]); }); t.set(db.collection(INDEX).doc(emp), u, { merge: true }); });
        }
      }); }, readOnly ? { readOnly: true } : { maxAttempts: 15 });
    }
  };
}
module.exports = { firestoreStore, INDEX };
