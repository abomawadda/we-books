import UserPicker from '../session/UserPicker.jsx';

export default function Layout({ pages, current, onNavigate, children }) {
  return (
    <div className="min-h-screen">
      <header className="bg-we text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-white px-2 py-1 text-lg font-extrabold text-we">WE</span>
            <span className="font-bold">مبادرة الكتب الخارجية بالتقسيط</span>
          </div>
          <UserPicker />
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {pages.map((p) => (
            <button key={p.id} onClick={() => onNavigate(p.id)}
              className={`rounded-t-lg px-4 py-2 text-sm whitespace-nowrap ${current === p.id ? 'bg-gray-50 font-bold text-we' : 'text-white/80 hover:bg-white/10'}`}>
              {p.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
