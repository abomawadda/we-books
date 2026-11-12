-- أدوات اختبار الحمل (طُبِّقت على mynekaba): موظفون مؤقتون LT0001.. ومرحلة PH-LT، ثم إزالتها كلها
-- الاستخدام: select books.seed_load_test(500);  ← أنشئ المرحلة PH-LT (Open) ← node supabase/loadtest/ramp.mjs 300 5
--            ثم: select books.purge_load_test();
create or replace function books.seed_load_test(n int) returns int
language plpgsql security definer set search_path = '' as $$
begin
  insert into books.records (tbl, id, ord, emp_id, data)
  select '03_Employees', 'lt' || lpad(g::text, 6, '0'), (extract(epoch from clock_timestamp()) * 1000000)::bigint + g, 'LT' || lpad(g::text, 4, '0'),
         jsonb_build_object('Emp_ID', 'LT' || lpad(g::text, 4, '0'), 'Full_Name', 'موظف اختبار ' || g, 'National_ID_Last4', '1234',
           'Mobile', '0100' || lpad(g::text, 7, '0'), 'Department', 'اختبار حمل', 'Job_Title', '', 'Employment_Status', 'ساري',
           'Installment_Allowed', true, 'Max_Credit_Limit', 0, 'Notes', 'LOAD_TEST', 'Updated_At', '')
  from generate_series(1, n) g
  on conflict do nothing;
  return n;
end $$;
create or replace function books.purge_load_test() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform pg_advisory_xact_lock(7001);
  with gone as (
    delete from books.records where emp_id like 'LT%'
       or (tbl = '20_System_Audit_Trail' and data->>'User_ID' like 'LT%')
       or (tbl = '06_Phases' and data->>'Phase_ID' = 'PH-LT')
    returning 1)
  select count(*) into n from gone;
  update books.auth_fails set fails = 0, locked_until = null where k like 'EMP:LT%';
  return n;
end $$;
revoke all on function books.seed_load_test(int) from public, anon, authenticated;
revoke all on function books.purge_load_test() from public, anon, authenticated;
