import { useEffect, useState } from 'react';
import { membersSource } from '../data';
import { ROLES } from '../domain/roles.js';
import { useSession } from './SessionContext.jsx';

export default function UserPicker() {
  const { session, setSession } = useSession();
  const [members, setMembers] = useState([]);
  useEffect(() => { membersSource.listMembers().then(setMembers); }, []);

  const pickMember = (employeeNo) => {
    const m = members.find((x) => x.employeeNo === employeeNo);
    setSession(m ? { employeeNo: m.employeeNo, name: m.name, role: session?.role ?? 'manager' } : null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">دخول تجريبي</span>
      <select className="rounded border border-white/30 bg-we-dark px-2 py-1 text-white"
        value={session?.employeeNo ?? ''} onChange={(e) => pickMember(e.target.value)}>
        <option value="">— اختر المستخدم —</option>
        {members.map((m) => (
          <option key={m.employeeNo} value={m.employeeNo} disabled={m.membershipStatus !== 'active'}>
            {m.name} ({m.employeeNo}){m.membershipStatus !== 'active' ? ' — موقوف' : ''}
          </option>
        ))}
      </select>
      <select className="rounded border border-white/30 bg-we-dark px-2 py-1 text-white" disabled={!session}
        value={session?.role ?? ''} onChange={(e) => setSession({ ...session, role: e.target.value })}>
        {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  );
}
