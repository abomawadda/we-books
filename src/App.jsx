import { useEffect, useState } from 'react';
import Layout from './components/Layout.jsx';
import ContractPage from './pages/ContractPage.jsx';
import BooksPage from './pages/BooksPage.jsx';
import BooksImportPage from './pages/BooksImportPage.jsx';
import DiscountSimulatorPage from './pages/DiscountSimulatorPage.jsx';

const PAGES = [
  { id: 'contract', label: 'العقد والمكتبة', el: ContractPage },
  { id: 'books', label: 'كتالوج الكتب', el: BooksPage },
  { id: 'import', label: 'استيراد من Excel', el: BooksImportPage },
  { id: 'simulator', label: 'محاكاة الخصم', el: DiscountSimulatorPage },
];

const fromHash = () => PAGES.find((p) => `#${p.id}` === location.hash)?.id ?? PAGES[0].id;

export default function App() {
  const [page, setPage] = useState(fromHash);
  useEffect(() => {
    const h = () => setPage(fromHash());
    addEventListener('hashchange', h);
    return () => removeEventListener('hashchange', h);
  }, []);
  const Current = PAGES.find((p) => p.id === page).el;
  return (
    <Layout pages={PAGES} current={page} onNavigate={(id) => { location.hash = id; }}>
      <Current />
    </Layout>
  );
}
