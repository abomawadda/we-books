-- حفظ حالة العضوية (Member_State) أثناء مزامنة MyNekaba لفرز بوابة المصرية للاتصالات عن بوابة المعاشات (معاش / استقالة) ومنع الوفاة
create or replace function books.sync_employees_from_json(members jsonb)
returns table(added int, updated int, skipped int)
language plpgsql security definer set search_path = '' as $$
declare
  active text[] := string_to_array((select value from books.config where key = 'active_member_states'), ',');
  now_txt text := to_char(now() at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI:SS');
  a int := 0; u int := 0; s int := 0;
  m jsonb; cur record; st text; ms text; d jsonb; mob text; jid text; nid text;
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
    ms := coalesce(nullif(trim(m->>'memberState'), ''), 'نشط');
    st := case when ms <> 'وفاة' and ms = any(active) then 'ساري' else 'موقوف' end;
    d := jsonb_build_object(
      'Emp_ID', jid, 'Full_Name', coalesce(m->>'name', ''), 'National_ID_Last4', right(nid, 4),
      'Mobile', mob, 'Department', coalesce(m->>'workplace', ''), 'Job_Title', coalesce(m->>'jobTitle', ''),
      'Member_State', ms, 'Employment_Status', st, 'Updated_At', now_txt);
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
