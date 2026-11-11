import { useCallback, useEffect, useState } from 'react';
import { repo } from './data';

/** قائمة مجموعة مع إعادة تحميل. */
export function useCollection(col) {
  const [rows, setRows] = useState([]);
  const reload = useCallback(() => repo.list(col).then(setRows), [col]);
  useEffect(() => { reload(); }, [reload]);
  return [rows, reload];
}

/** تشغيل عملية كتابة مع رسالة نجاح أو خطأ. */
export function useAction() {
  const [msg, setMsg] = useState(null);
  const run = async (fn, ok) => {
    try { await fn(); setMsg({ kind: 'ok', text: ok }); return true; }
    catch (e) { setMsg({ kind: 'error', text: e.message }); return false; }
  };
  return [msg, run, setMsg];
}
