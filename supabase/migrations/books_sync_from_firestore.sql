-- مزامنة الموظفين من أعضاء MyNekaba الحقيقيين (Firestore nekaba2026 / employees).
-- books-api (العملية SYNC_MEMBERS) يقرأ الأعضاء بمفتاح قراءة فقط (سر NEKABA_SA_JSON) ثم يستدعي هذه الدوال.
-- طُبِّقت على مشروع mynekaba.
create or replace function books.sync_employees_from_json(members jsonb)
returns table(added int, updated int, skipped int)
language plpgsql security definer set search_path = '' as $$
declare
  active text[] := string_to_array((select value from books.config where key = 'active_member_states'), ',');
  now_txt text := to_char(now() at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI:SS');
  a int := 0; u int := 0; s int := 0;
  m jsonb; cur record; st text; d jsonb; mob text; jid text; nid text;
begin
  perform pg_advisory_xact_lock(7001);
  for m in select * from jsonb_array_elements(coalesce(members, '[]'::jsonb)) loop
    jid := trim(coalesce(m->>'jobId', ''));
    nid := regexp_replace(translate(coalesce(m->>'nationalId', ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g');
    mob := regexp_replace(translate(coalesce(m->>'phone', ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g');
    if mob like '0020%' then mob := substr(mob, 3); end if;
    if mob like '20%' and length(mob) = 12 then mob := '0' || substr(mob, 3); end if;
    if length(mob) = 10 and mob like '1%' then mob := '0' || mob; end if;
    if jid = '' or length(nid) < 4 or mob = '' then s := s + 1; continue; end if;
    st := case when coalesce(nullif(trim(m->>'memberState'), ''), 'نشط') = any(active) then 'ساري' else 'موقوف' end;
    d := jsonb_build_object(
      'Emp_ID', jid, 'Full_Name', coalesce(m->>'name', ''), 'National_ID_Last4', right(nid, 4),
      'Mobile', mob, 'Department', coalesce(m->>'workplace', ''), 'Job_Title', coalesce(m->>'jobTitle', ''),
      'Employment_Status', st, 'Updated_At', now_txt);
    select id, data into cur from books.records where tbl = '03_Employees' and emp_id = jid limit 1;
    if found then
      if (cur.data - 'Updated_At') is distinct from ((cur.data || d) - 'Updated_At') then
        update books.records set data = cur.data || d where tbl = '03_Employees' and id = cur.id;
        u := u + 1;
      end if;
    else
      insert into books.records (tbl, id, ord, emp_id, data) values (
        '03_Employees', substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),
        (extract(epoch from clock_timestamp()) * 1000000)::bigint, jid,
        d || jsonb_build_object('Installment_Allowed', true, 'Max_Credit_Limit', 0, 'Notes', 'MyNekaba'));
      a := a + 1;
    end if;
  end loop;
  return query select a, u, s;
end $$;
revoke all on function books.sync_employees_from_json(jsonb) from public, anon, authenticated;

-- إزالة التجريبيين بعد وصول أعضاء حقيقيين (إن لم تكن لهم حركة)
create or replace function books.remove_demo_employees() returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0;
begin
  if not exists (select 1 from books.records where tbl = '03_Employees' and data->>'Notes' = 'MyNekaba') then return 0; end if;
  with gone as (
    delete from books.records e
     where e.tbl = '03_Employees' and e.emp_id in ('1001','1002','1003')
       and e.data->>'Notes' = 'بيانات تجريبية'
       and not exists (select 1 from books.records o where o.emp_id = e.emp_id and o.tbl <> '03_Employees')
    returning 1)
  select count(*) into n from gone;
  return n;
end $$;
revoke all on function books.remove_demo_employees() from public, anon, authenticated;

-- الجدولة الليلية: books-api ← SYNC_MEMBERS (22:30 UTC)
create or replace function books.run_member_sync() returns bigint
language sql security definer set search_path = '' as $$
  select net.http_post(
    url := 'https://bulfwclnhbwpzqwnxjie.supabase.co/functions/v1/books-api',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('action', 'SYNC_MEMBERS', 'payload',
      jsonb_build_object('key', (select value from books.config where key = 'cron_key'))),
    timeout_milliseconds := 120000);
$$;
revoke all on function books.run_member_sync() from public, anon, authenticated;
select cron.schedule('books-sync-employees', '30 22 * * *', 'select books.run_member_sync()');
