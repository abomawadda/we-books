import { useMemo, useState } from 'react';
import { repo, C } from '../data';
import { useSession } from '../session/SessionContext.jsx';
import { useAction, useCollection } from '../hooks.js';
import { Alert, Button, Card, Field, Input, PageHeader, Table } from '../components/ui.jsx';
import { bpsToPercent, ceilMoney, formatMoney, formatPercent, percentToBps } from '../domain/money.js';

const empty = { code: '', name: '', grade: '', subject: '', term: '', coverPrice: '', itemDiscount: '' };

export default function BooksPage() {
  const { actor } = useSession();
  const [books, reload] = useCollection(C.books);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState('');
  const [msg, run] = useAction();

  const rows = useMemo(() => {
    const s = q.trim();
    return books
      .filter((b) => !s || [b.code, b.name, b.grade, b.subject].some((x) => x?.includes(s)))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [books, q]);

  const save = async (e) => {
    e.preventDefault();
    const data = {
      code: form.code.trim(), name: form.name.trim(), grade: form.grade, subject: form.subject, term: form.term,
      coverPrice: ceilMoney(Number(form.coverPrice)), itemDiscountBps: percentToBps(form.itemDiscount || 0),
    };
    const ok = await run(async () => {
      if (editing) return repo.update(C.books, data.code, data, actor);
      if (await repo.get(C.books, data.code)) throw new Error('الكود موجود بالفعل');
      return repo.create(C.books, { ...data, id: data.code, available: true }, actor);
    }, 'تم حفظ الكتاب');
    if (ok) { setForm(empty); setEditing(false); reload(); }
  };

  const toggle = async (b) => {
    if (await run(() => repo.update(C.books, b.id, { available: !b.available }, actor), b.available ? 'تم إيقاف الإتاحة' : 'تمت الإتاحة')) reload();
  };

  const F = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <>
      <PageHeader title="كتالوج الكتب وقائمة الأسعار" subtitle={`${books.length} كتاب — الكتب لا تُحذف، بل تُوقَف إتاحتها للحجز`} />
      {msg && <div className="mb-4"><Alert kind={msg.kind}>{msg.text}</Alert></div>}
      <Card title={editing ? `تعديل ${form.code}` : 'إضافة كتاب'} className="mb-6">
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-4">
          <Field label="الكود"><Input required disabled={editing} {...F('code')} /></Field>
          <Field label="الاسم"><Input required {...F('name')} /></Field>
          <Field label="الصف"><Input {...F('grade')} /></Field>
          <Field label="المادة"><Input {...F('subject')} /></Field>
          <Field label="الترم"><Input {...F('term')} /></Field>
          <Field label="سعر الغلاف P (جنيه)" hint="يُقرَّب لأعلى جنيه"><Input required type="number" min="1" step="0.01" {...F('coverPrice')} /></Field>
          <Field label="خصم الصنف d %"><Input type="number" min="0" max="99.99" step="0.01" {...F('itemDiscount')} /></Field>
          <div className="flex items-end gap-2">
            <Button type="submit">حفظ</Button>
            {editing && <Button type="button" variant="ghost" onClick={() => { setForm(empty); setEditing(false); }}>إلغاء</Button>}
          </div>
        </form>
      </Card>
      <Card>
        <div className="mb-3 max-w-xs"><Input placeholder="بحث بالكود أو الاسم أو الصف" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Table rows={rows} rowClass={(b) => (b.available ? '' : 'text-gray-400')} columns={[
          { key: 'code', label: 'الكود' },
          { key: 'name', label: 'الاسم' },
          { key: 'grade', label: 'الصف' },
          { key: 'subject', label: 'المادة' },
          { key: 'term', label: 'الترم' },
          { key: 'p', label: 'سعر الغلاف', render: (b) => formatMoney(b.coverPrice) },
          { key: 'd', label: 'خصم الصنف', render: (b) => formatPercent(b.itemDiscountBps) },
          { key: 'av', label: 'متاح للحجز', render: (b) => (b.available ? 'نعم' : 'موقوف') },
          { key: 'a', label: '', render: (b) => (
            <div className="flex gap-1">
              <Button variant="ghost" onClick={() => { setEditing(true); setForm({ ...empty, ...b, itemDiscount: bpsToPercent(b.itemDiscountBps) }); }}>تعديل</Button>
              <Button variant="ghost" onClick={() => toggle(b)}>{b.available ? 'إيقاف' : 'إتاحة'}</Button>
            </div>
          ) },
        ]} />
      </Card>
    </>
  );
}
