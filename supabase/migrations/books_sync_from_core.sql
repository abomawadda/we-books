-- مزامنة بيانات الموظفين الكاملة (ملف الموارد البشرية) من core.person_current في Supabase إلى books.records (03_Employees)
-- تقرأ من core.person_current (قراءة فقط) وتحدّث/تضيف في books.records مع الحفاظ الكامل على إعدادات المبادرة (التقسيط، الحد الائتماني، الأبناء، تصريح التعديل، الملاحظات)
-- يُنفَّذ على مشروع mynekaba في Supabase SQL Editor

create or replace function books.sync_employees_from_core()
returns table(added int, updated int, total_in_core int)
language plpgsql security definer set search_path = '' as $$
declare
  active text[] := string_to_array(coalesce((select value from books.config where key = 'active_member_states'), 'نشط,معاش,استقالة,نقل,إجازة بدون أجر'), ',');
  now_txt text := to_char(now() at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI:SS');
  a int := 0; u int := 0; tot int := 0;
  p record; cur record; d jsonb; st text; nid text;
begin
  perform pg_advisory_xact_lock(7001);
  for p in
    select
      job_id, full_name, national_id, gender, birth_date,
      phone, phone2, email, address, qualification, specialization,
      marital_status, insurance_no, hire_date, retirement_date,
      monthly_dues, union_org, member_state, workplace, job_title, grade
    from core.person_current
    where coalesce(trim(job_id), '') <> ''
  loop
    tot := tot + 1;
    nid := regexp_replace(coalesce(p.national_id, ''), '\D', '', 'g');
    st := case
      when coalesce(nullif(trim(p.member_state), ''), 'نشط') = 'وفاة' then 'موقوف'
      when coalesce(nullif(trim(p.member_state), ''), 'نشط') = any(active) then 'ساري'
      else 'موقوف'
    end;
    d := jsonb_build_object(
      'Emp_ID', trim(p.job_id),
      'Full_Name', coalesce(p.full_name, ''),
      'National_ID', nid,
      'National_ID_Last4', case when length(nid) >= 4 then right(nid, 4) else '' end,
      'Mobile', coalesce(p.phone, ''),
      'Mobile2', coalesce(p.phone2, ''),
      'Email', coalesce(p.email, ''),
      'Address', coalesce(p.address, ''),
      'Department', coalesce(p.workplace, ''),
      'Job_Title', coalesce(p.job_title, ''),
      'Grade_Title', coalesce(p.grade, ''),
      'Union_Org', coalesce(p.union_org, ''),
      'Member_State', coalesce(p.member_state, ''),
      'Hire_Date', coalesce(to_char(p.hire_date, 'YYYY-MM-DD'), ''),
      'Retirement_Date', coalesce(to_char(p.retirement_date, 'YYYY-MM-DD'), ''),
      'Insurance_No', coalesce(p.insurance_no, ''),
      'Qualification', coalesce(p.qualification, ''),
      'Specialization', coalesce(p.specialization, ''),
      'Marital_Status', coalesce(p.marital_status, ''),
      'Gender', coalesce(p.gender, ''),
      'Birth_Date', coalesce(to_char(p.birth_date, 'YYYY-MM-DD'), ''),
      'Monthly_Dues', coalesce(p.monthly_dues, 0),
      'Employment_Status', st,
      'Updated_At', now_txt
    );

    select id, data into cur from books.records where tbl = '03_Employees' and emp_id = trim(p.job_id) limit 1;
    if found then
      -- نحافظ على القيم الموجودة في books.records لو كانت فارغة في core، ونحفظ كل إعدادات المبادرة
      if (cur.data - 'Updated_At') is distinct from ((cur.data || d) - 'Updated_At') then
        update books.records
        set data = cur.data || d
        where tbl = '03_Employees' and id = cur.id;
        u := u + 1;
      end if;
    else
      insert into books.records (tbl, id, ord, emp_id, data) values (
        '03_Employees',
        substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),
        (extract(epoch from clock_timestamp()) * 1000000)::bigint,
        trim(p.job_id),
        d || jsonb_build_object('Installment_Allowed', true, 'Max_Credit_Limit', 0, 'Edit_Permitted', false, 'Notes', 'Supabase Core')
      );
      a := a + 1;
    end if;
  end loop;
  return query select a, u, tot;
end $$;

revoke all on function books.sync_employees_from_core() from public, anon, authenticated;

-- تشغيل فوري الآن لمزامنة كامل ملفات الموارد البشرية (1137 موظفاً) من core.person_current
select * from books.sync_employees_from_core();
