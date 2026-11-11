import { useState } from 'react';
import { repo, C } from '../data';
import { useSession } from '../session/SessionContext.jsx';
import { useAction, useCollection } from '../hooks.js';
import { Alert, Button, Card, Field, Input, PageHeader, Table, inputCls } from '../components/ui.jsx';
import { bpsToPercent, formatPercent, percentToBps } from '../domain/money.js';

const emptySupplier = { name: '', representative: '', phone: '', email: '', address: '', contractRef: '' };
const emptySeason = { name: '', supplierId: '', quantityDiscount: '', allowedReturn: '', settlementDate: '', status: 'draft' };
const STATUS = { draft: 'مسودة', active: 'نشط', closed: 'مغلق' };

export default function ContractPage() {
  const { actor } = useSession();
  const [suppliers, reloadSuppliers] = useCollection(C.suppliers);
  const [seasons, reloadSeasons] = useCollection(C.seasons);
  const [sup, setSup] = useState(emptySupplier);
  const [sea, setSea] = useState(emptySeason);
  const [msg, run] = useAction();

  const saveSupplier = async (e) => {
    e.preventDefault();
    const { id, ...data } = sup;
    const ok = await run(() => (id ? repo.update(C.suppliers, id, data, actor) : repo.create(C.suppliers, data, actor)), 'تم حفظ المكتبة');
    if (ok) { setSup(emptySupplier); reloadSuppliers(); }
  };

  const saveSeason = async (e) => {
    e.preventDefault();
    const data = {
      name: sea.name.trim(),
      supplierId: sea.supplierId,
      quantityDiscountBps: percentToBps(sea.quantityDiscount || 0),
      quantityDiscountRule: 'after_item_discounts_on_invoice_total',
      allowedReturnBps: percentToBps(sea.allowedReturn || 0),
      settlementDate: sea.settlementDate,
      status: sea.status,
    };
    const ok = await run(async () => {
      if (!data.name || !data.supplierId) throw new Error('اسم الموسم والمكتبة مطلوبان');
      return sea.id ? repo.update(C.seasons, sea.id, data, actor) : repo.create(C.seasons, data, actor);
    }, 'تم حفظ الموسم والعقد');
    if (ok) { setSea(emptySeason); reloadSeasons(); }
  };

  const supName = (id) => suppliers.find((s) => s.id === id)?.name ?? '—';
  const S = (k) => ({ value: sup[k], onChange: (e) => setSup({ ...sup, [k]: e.target.value }) });
  const E = (k) => ({ value: sea[k], onChange: (e) => setSea({ ...sea, [k]: e.target.value }) });

  return (
    <>
      <PageHeader title="العقد والمكتبة" subtitle="بيانات المكتبة المتعاقد معها وشروط عقد الموسم" />
      {msg && <div className="mb-4"><Alert kind={msg.kind}>{msg.text}</Alert></div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={sup.id ? 'تعديل المكتبة' : 'مكتبة جديدة'}>
          <form onSubmit={saveSupplier} className="grid gap-3 sm:grid-cols-2">
            <Field label="اسم المكتبة"><Input required {...S('name')} /></Field>
            <Field label="المندوب"><Input {...S('representative')} /></Field>
            <Field label="الموبايل"><Input dir="ltr" {...S('phone')} /></Field>
            <Field label="البريد"><Input dir="ltr" type="email" {...S('email')} /></Field>
            <Field label="العنوان"><Input {...S('address')} /></Field>
            <Field label="مرجع العقد" hint="صورة العقد تُرفع لاحقًا مع التخزين السحابي"><Input {...S('contractRef')} /></Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit">حفظ</Button>
              {sup.id && <Button type="button" variant="ghost" onClick={() => setSup(emptySupplier)}>إلغاء</Button>}
            </div>
          </form>
        </Card>

        <Card title={sea.id ? 'تعديل الموسم والعقد' : 'موسم جديد'}>
          <form onSubmit={saveSeason} className="grid gap-3 sm:grid-cols-2">
            <Field label="اسم الموسم"><Input required placeholder="2026 / 2027" {...E('name')} /></Field>
            <Field label="المكتبة">
              <select className={inputCls} required {...E('supplierId')}>
                <option value="">— اختر —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="خصم الكمية q %" hint="يُحسب على إجمالي الفاتورة بعد خصم جميع الأصناف">
              <Input type="number" min="0" max="100" step="0.01" {...E('quantityDiscount')} />
            </Field>
            <Field label="نسبة المرتجع المسموحة %"><Input type="number" min="0" max="100" step="0.01" {...E('allowedReturn')} /></Field>
            <Field label="تاريخ التصفية النهائية"><Input type="date" {...E('settlementDate')} /></Field>
            <Field label="الحالة">
              <select className={inputCls} {...E('status')}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit">حفظ</Button>
              {sea.id && <Button type="button" variant="ghost" onClick={() => setSea(emptySeason)}>إلغاء</Button>}
            </div>
          </form>
        </Card>
      </div>

      <div className="mt-6 grid gap-6">
        <Card title="المكتبات">
          <Table rows={suppliers} columns={[
            { key: 'name', label: 'الاسم' },
            { key: 'representative', label: 'المندوب' },
            { key: 'phone', label: 'الموبايل' },
            { key: 'contractRef', label: 'مرجع العقد' },
            { key: 'a', label: '', render: (r) => <Button variant="ghost" onClick={() => setSup({ ...emptySupplier, ...r })}>تعديل</Button> },
          ]} />
        </Card>
        <Card title="المواسم والعقود">
          <Table rows={seasons} columns={[
            { key: 'name', label: 'الموسم' },
            { key: 's', label: 'المكتبة', render: (r) => supName(r.supplierId) },
            { key: 'q', label: 'خصم الكمية', render: (r) => formatPercent(r.quantityDiscountBps) },
            { key: 'r', label: 'المرتجع المسموح', render: (r) => formatPercent(r.allowedReturnBps) },
            { key: 'settlementDate', label: 'التصفية' },
            { key: 'st', label: 'الحالة', render: (r) => STATUS[r.status] },
            { key: 'a', label: '', render: (r) => (
              <Button variant="ghost" onClick={() => setSea({
                id: r.id, name: r.name, supplierId: r.supplierId, status: r.status, settlementDate: r.settlementDate,
                quantityDiscount: bpsToPercent(r.quantityDiscountBps), allowedReturn: bpsToPercent(r.allowedReturnBps),
              })}>تعديل</Button>
            ) },
          ]} />
        </Card>
      </div>
    </>
  );
}
