import { useState } from 'react';
import * as XLSX from 'xlsx';
import { repo, C } from '../data';
import { useSession } from '../session/SessionContext.jsx';
import { useAction } from '../hooks.js';
import { Alert, Button, Card, PageHeader, Table } from '../components/ui.jsx';
import { parseCatalogRows, TEMPLATE_HEADERS } from '../domain/catalogImport.js';
import { formatMoney, formatPercent } from '../domain/money.js';

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ['MATH-1S-T1', 'الأضواء رياضيات', 'الأول الثانوي', 'رياضيات', 'الأول', 150, 20]]);
  ws['!views'] = [{ RTL: true }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الكتب');
  XLSX.writeFile(wb, 'قالب-كتالوج-الكتب.xlsx');
}

export default function BooksImportPage() {
  const { actor } = useSession();
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState('');
  const [msg, run, setMsg] = useAction();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    setFileName(file.name);
    const wb = XLSX.read(await file.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const res = parseCatalogRows(rows);
    const existing = new Set((await repo.list(C.books)).map((b) => b.id));
    res.items = res.items.map((it) => ({ ...it, isUpdate: existing.has(it.id) }));
    setParsed(res);
    e.target.value = '';
  };

  const confirm = async () => {
    const items = parsed.items.map(({ isUpdate, ...it }) => (isUpdate ? (({ available, ...rest }) => rest)(it) : it));
    const ok = await run(() => repo.upsertMany(C.books, items, actor), `تم استيراد ${items.length} كتاب`);
    if (ok) setParsed(null);
  };

  const newCount = parsed?.items.filter((i) => !i.isUpdate).length ?? 0;

  return (
    <>
      <PageHeader title="استيراد كتالوج الكتب من Excel" subtitle="الكتب الموجودة تُحدَّث بالكود، والجديدة تُضاف. لا يُحذف أي كتاب."
        actions={<Button variant="secondary" onClick={downloadTemplate}>تنزيل القالب</Button>} />
      {msg && <div className="mb-4"><Alert kind={msg.kind}>{msg.text}</Alert></div>}
      <Card className="mb-6">
        <p className="mb-3 text-sm text-gray-600">الأعمدة: {TEMPLATE_HEADERS.join(' · ')}. الأسعار تُقرَّب لأعلى جنيه. الخصم يُقبل 20 أو 20% أو 0.2.</p>
        <label className="inline-block cursor-pointer rounded-lg bg-we px-4 py-2 text-sm font-medium text-white hover:bg-we-dark">
          اختيار ملف Excel
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
        </label>
        {fileName && <span className="ms-3 text-sm text-gray-500">{fileName}</span>}
      </Card>

      {parsed && (
        <div className="grid gap-6">
          {parsed.errors.length > 0 && (
            <Card title={`صفوف مرفوضة (${parsed.errors.length})`}>
              <Table rows={parsed.errors} rowKey={(r) => r.row} columns={[
                { key: 'row', label: 'الصف' }, { key: 'code', label: 'الكود' }, { key: 'message', label: 'السبب' },
              ]} />
            </Card>
          )}
          <Card title={`معاينة: ${newCount} جديد · ${parsed.items.length - newCount} تحديث`}>
            <Table rows={parsed.items} columns={[
              { key: 'k', label: '', render: (r) => (r.isUpdate ? <span className="text-amber-700">تحديث</span> : <span className="text-green-700">جديد</span>) },
              { key: 'code', label: 'الكود' }, { key: 'name', label: 'الاسم' }, { key: 'grade', label: 'الصف' },
              { key: 'subject', label: 'المادة' }, { key: 'term', label: 'الترم' },
              { key: 'p', label: 'سعر الغلاف', render: (r) => formatMoney(r.coverPrice) },
              { key: 'd', label: 'خصم الصنف', render: (r) => formatPercent(r.itemDiscountBps) },
            ]} />
            <div className="mt-4 flex gap-2">
              <Button onClick={confirm} disabled={!parsed.items.length}>تأكيد الاستيراد</Button>
              <Button variant="ghost" onClick={() => setParsed(null)}>إلغاء</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
