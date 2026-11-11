export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-we">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      {title && <h2 className="mb-4 text-lg font-bold">{title}</h2>}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-we focus:outline-none focus:ring-2 focus:ring-we/20 disabled:bg-gray-100';

export function Input(props) { return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />; }

export function Button({ variant = 'primary', className = '', ...p }) {
  const v = {
    primary: 'bg-we text-white hover:bg-we-dark',
    secondary: 'border border-we text-we hover:bg-we-light',
    ghost: 'text-gray-600 hover:bg-gray-100',
  }[variant];
  return <button {...p} className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`} />;
}

export function Alert({ kind = 'info', children }) {
  const c = { info: 'bg-we-light text-we-dark', error: 'bg-red-50 text-red-700', ok: 'bg-green-50 text-green-700', warn: 'bg-amber-50 text-amber-800' }[kind];
  return <div className={`rounded-lg px-4 py-3 text-sm ${c}`}>{children}</div>;
}

export function Table({ columns, rows, empty = 'لا توجد بيانات', rowKey = (r) => r.id, rowClass }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-we-light text-we-dark">
          <tr>{columns.map((c) => <th key={c.key} className="px-3 py-2 text-start font-bold whitespace-nowrap">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-gray-400">{empty}</td></tr>}
          {rows.map((r, i) => (
            <tr key={rowKey(r, i)} className={`border-t border-gray-100 ${rowClass?.(r) ?? ''}`}>
              {columns.map((c) => <td key={c.key} className="px-3 py-2 whitespace-nowrap">{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Stat({ label, value, tone }) {
  const t = { good: 'text-green-700', bad: 'text-red-700' }[tone] ?? 'text-gray-900';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${t}`}>{value}</div>
    </div>
  );
}
