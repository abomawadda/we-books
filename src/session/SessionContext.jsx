// اختيار المستخدم ودوره مؤقتًا بدل تسجيل الدخول.
import { createContext, useContext, useEffect, useState } from 'react';

const KEY = 'we-books.session';
const Ctx = createContext(null);

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? null; } catch { return null; }
}

export function SessionProvider({ children }) {
  const [session, setSession] = useState(load);
  useEffect(() => {
    try { session ? localStorage.setItem(KEY, JSON.stringify(session)) : localStorage.removeItem(KEY); } catch { /* تجاهل */ }
  }, [session]);
  const actor = session ? { userId: session.employeeNo, role: session.role, name: session.name } : null;
  return <Ctx.Provider value={{ session, setSession, actor }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
