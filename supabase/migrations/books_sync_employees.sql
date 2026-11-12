-- مزامنة موظفي المبادرة من أعضاء النقابة (public.members في MyNekaba) — قراءة فقط من بيانات النقابة.
-- طُبِّقت على مشروع mynekaba. التشغيل يدوياً: select * from books.sync_employees_from_members();
-- member_state في MyNekaba: نشط / موقوف / إجازة بدون أجر / معاش / استقالة / وفاة (الفارغ = نشط)
insert into books.config (key, value) values ('active_member_states', 'نشط')
on conflict (key) do update set value = excluded.value;

create or replace function books.sync_employees_from_members()
returns table(added int, updated int, skipped int)
language plpgsql security definer set search_path = '' as $$
declare
  active text[] := string_to_array((select value from books.config where key = 'active_member_states'), ',');
  now_txt text := to_char(now() at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI:SS');
  a int := 0; u int := 0; s int := 0;
  m record; cur record; st text; d jsonb; mob text;
begin
  perform pg_advisory_xact_lock(7001); -- نفس القفل العام لخادم المبادرة
  for m in select * from public.members loop
    mob := regexp_replace(coalesce(m.phone, ''), '\D', '', 'g');
    if mob like '0020%' then mob := substr(mob, 3); end if;
    if mob like '20%' and length(mob) = 12 then mob := '0' || substr(mob, 3); end if;
    if length(mob) = 10 and mob like '1%' then mob := '0' || mob; end if;
    if coalesce(trim(m.job_id), '') = '' or length(coalesce(m.national_id, '')) < 4 or mob = '' then
      s := s + 1; continue;
    end if;
    st := case when coalesce(nullif(trim(m.member_state), ''), 'نشط') = any(active) then 'ساري' else 'موقوف' end;
    d := jsonb_build_object(
      'Emp_ID', trim(m.job_id), 'Full_Name', coalesce(m.name, ''), 'National_ID_Last4', right(m.national_id, 4),
      'Mobile', mob, 'Department', coalesce(m.workplace, ''), 'Job_Title', coalesce(m.job_title, ''),
      'Employment_Status', st, 'Updated_At', now_txt);
    select id, data into cur from books.records where tbl = '03_Employees' and emp_id = trim(m.job_id) limit 1;
    if found then
      -- تحديث بيانات النقابة مع الإبقاء على إعدادات المبادرة (التقسيط، الحد الائتماني، الملاحظات)
      if (cur.data - 'Updated_At') is distinct from ((cur.data || d) - 'Updated_At') then
        update books.records set data = cur.data || d where tbl = '03_Employees' and id = cur.id;
        u := u + 1;
      end if;
    else
      insert into books.records (tbl, id, ord, emp_id, data) values (
        '03_Employees', substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),
        (extract(epoch from clock_timestamp()) * 1000000)::bigint, trim(m.job_id),
        d || jsonb_build_object('Installment_Allowed', true, 'Max_Credit_Limit', 0, 'Notes', 'MyNekaba'));
      a := a + 1;
    end if;
  end loop;
  return query select a, u, s;
end $$;
revoke all on function books.sync_employees_from_members() from public, anon, authenticated;

-- مزامنة ليلية قبل المهمة اليومية (22:30 UTC = 12:30 صباحاً بالقاهرة شتاءً)
select cron.schedule('books-sync-employees', '30 22 * * *', 'select books.sync_employees_from_members()');
