import { useMemo, useState } from 'react';
import { C } from '../data';
import { useCollection } from '../hooks.js';
import { Alert, Card, Field, Input, PageHeader, Stat, Table, inputCls } from '../components/ui.jsx';
import { formatMoney, formatPercent, percentToBps } from '../domain/money.js';
import { employeePrice, simulateDiscount, unitCost, unitMargin } from '../domain/pricing.js';

export default function DiscountSimulatorPage() {
  const [books] = useCollection(C.books);
  const [seasons] = useCollection(C.seasons);
  const [seasonId, setSeasonId] = useState('');
  const [qtys, setQtys] = useState({});
  const [expenses, setExpenses] = useState('');
  const [proposed, setProposed] = useState('');

  const season = seasons.find((s) => s.id === seasonId) ?? seasons[0];
  const q = season?.quantityDiscountBps ?? 0;
  const D = proposed === '' ? null : percentToBps(proposed);
  const E = Math.ceil(Number(expenses) || 0);
  const available = books.filter((b) => b.available).sort((a, b) => a.code.localeCompare(b.code));

  const sim = useMemo(() => {
    const items = available
      .map((b) => ({ code: b.code, name: b.name, coverPrice: b.coverPrice, itemDiscountBps: b.itemDiscountBps, qty: Math.max(0, Math.floor(Number(qtys[b.id]) || 0)) }))
      .filter((i) => i.qty > 0);
    return simulateDiscount(items, q, E, D ?? 0);
  }, [available, qtys, q, E, D]);

  const fillAll = (n) => setQtys(Object.fromEntries(available.map((b) => [b.id, n])));
  const effectiveD = D ?? sim.maxDiscountBps;

  return (
    <>
      <PageHeader title="محاكاة نسبة الخصم" subtitle="احسب حد الخصم الآمن D قبل إعلانه على مزيج الكتب المتوقع" />
      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="الموسم (لخصم الكمية q)">
            <select className={inputCls} value={season?.id ?? ''} onChange={(e) => setSeasonId(e.target.value)}>
              {seasons.length === 0 && <option value="">لا توجد مواسم — q = 0</option>}
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.name} — q {formatPercent(s.quantityDiscountBps)}</option>)}
            </select>
          </Field>
          <Field label="المصروفات المتوقعة E (جنيه)" hint="شحن، تعبئة، نقل ومشال، عمال، أخرى">
            <Input type="number" min="0" value={expenses} onChange={(e) => setExpenses(e.target.value)} />
          </Field>
          <Field label="خصم مقترح للإعلان D %" hint="اتركه فارغًا لاستخدام الحد الآمن">
            <Input type="number" min="0" max="100" step="0.01" value={proposed} onChange={(e) => setProposed(e.target.value)} />
          </Field>
        </div>
      </Card>

      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="إجمالي بسعر الغلاف" value={formatMoney(sim.gross)} />
        <Stat label="تكلفة المكتبة (الصافي)" value={formatMoney(sim.net)} />
        <Stat label="المصروفات" value={formatMoney(E)} />
        <Stat label="حد الخصم الآمن D_max" value={formatPercent(sim.maxDiscountBps)} tone="good" />
        <Stat label={`إيراد بخصم ${formatPercent(sim.discountBps)}`} value={D === null ? '—' : formatMoney(sim.revenue)} />
        <Stat label="فائض / عجز" value={D === null ? '—' : formatMoney(sim.result)} tone={D === null ? null : sim.result >= 0 ? 'good' : 'bad'} />
      </div>

      {D !== null && sim.gross > 0 && (
        <div className="mb-6">
          {sim.safe
            ? <Alert kind="ok">الخصم {formatPercent(D)} آمن: فائض {formatMoney(sim.result)}.</Alert>
            : <Alert kind="error">الخصم {formatPercent(D)} يتجاوز الحد الآمن {formatPercent(sim.maxDiscountBps)}: عجز {formatMoney(-sim.result)} تتحمله الجهة الراعية.</Alert>}
        </div>
      )}

      {sim.lossBooks.length > 0 && D !== null && (
        <Card title={`كتب تباع بخسارة عند ${formatPercent(D)} (${sim.lossBooks.length})`} className="mb-6">
          <Table rows={sim.lossBooks} rowKey={(r) => r.code} columns={[
            { key: 'code', label: 'الكود' }, { key: 'name', label: 'الاسم' },
            { key: 'd', label: 'خصم الصنف', render: (r) => formatPercent(r.itemDiscountBps) },
            { key: 'm', label: 'خسارة النسخة', render: (r) => formatMoney(r.unitMargin) },
            { key: 'qty', label: 'الكمية' },
            { key: 't', label: 'إجمالي الخسارة', render: (r) => formatMoney(r.totalLoss) },
          ]} />
        </Card>
      )}

      <Card title="مزيج الكتب المتوقع">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span>تعبئة الكل بكمية:</span>
          {[0, 10, 50, 100].map((n) => <button key={n} className="rounded border px-2 py-0.5 hover:bg-we-light" onClick={() => fillAll(n)}>{n}</button>)}
        </div>
        <Table rows={available} empty="لا توجد كتب متاحة — أضفها من الكتالوج أو استوردها" columns={[
          { key: 'code', label: 'الكود' }, { key: 'name', label: 'الاسم' },
          { key: 'p', label: 'الغلاف P', render: (b) => formatMoney(b.coverPrice) },
          { key: 'd', label: 'd', render: (b) => formatPercent(b.itemDiscountBps) },
          { key: 'c', label: 'تكلفة النسخة', render: (b) => formatMoney(unitCost(b.coverPrice, b.itemDiscountBps, q)) },
          { key: 'e', label: `سعر الموظف @${formatPercent(effectiveD)}`, render: (b) => formatMoney(employeePrice(b.coverPrice, Math.max(0, effectiveD))) },
          { key: 'm', label: 'هامش النسخة', render: (b) => {
            const m = unitMargin(b.coverPrice, b.itemDiscountBps, q, Math.max(0, effectiveD));
            return <span className={m < 0 ? 'font-bold text-red-700' : ''}>{formatMoney(m)}</span>;
          } },
          { key: 'n', label: 'الكمية المتوقعة n', render: (b) => (
            <input type="number" min="0" className={`${inputCls} w-24 py-1`} value={qtys[b.id] ?? ''}
              onChange={(e) => setQtys({ ...qtys, [b.id]: e.target.value })} />
          ) },
        ]} />
      </Card>
    </>
  );
}
