// يولّد SQL للبيانات الأولية (نفس seedInitialData_ في Code.gs) لجدول books.records
import { createRuntime, memoryStore } from './functions/books-api/engine.js';
import { code, sha256 } from './test-mock.mjs';
const rt = createRuntime({ code, sha256 });
const st = memoryStore();
rt.runSync(st, 'INIT', g => { g.seedInitialData_(); return { success: true }; });
const rows = [];
for (const [tbl, m] of Object.entries(st.data)) for (const [id, v] of m) rows.push({ tbl, id, ord: v.ord, emp_id: v.data.Emp_ID ? String(v.data.Emp_ID) : null, data: v.data });
const j = JSON.stringify(rows).replace(/'/g, "''");
process.stdout.write(`insert into books.records (tbl,id,ord,emp_id,data) select tbl,id,ord,emp_id,data from jsonb_to_recordset('${j}'::jsonb) as x(tbl text,id text,ord bigint,emp_id text,data jsonb) on conflict do nothing;`);
