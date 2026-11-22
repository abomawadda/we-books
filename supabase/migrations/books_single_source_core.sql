-- مصدر واحد لبيانات الموظفين = منصة النقابة (core) — 22 نوفمبر 2026
-- 1) سحب core ← books بلا مسح: الحقل الفارغ في core لا يمسح القيمة الموجودة في الكتب.
-- 2) المزامنة الليلية والزر اليدوي «مزامنة الأعضاء» يسحبان من core بدل MyNekaba/Firestore (بلا إعادة نشر books-api).
-- 3) تعديلات صفحة الموارد البشرية في الكتب وتعديل الموظف لبياناته تُرسل إلى core فوراً (مُشغّل على books.records).
-- لا تمس الحجوزات ولا الفواتير ولا أي جدول مالي. نسخة احتياطية قبل التطبيق: books.records_backup_employees_20261122

-- ───────── (أ) core: استقبال تعديل من منظومة خارجية ─────────
-- يطبّق فقط الحقول التي تغيّرت فعلاً؛ أبعاد الحركات تُسجَّل حركة بتاريخ اليوم (لا كتابة فوق التاريخ).
create or replace function core.apply_external_edit(p_job text, p_old jsonb, p_new jsonb, p_source text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid; k text; col text; v text; o text;
  personal constant jsonb := '{"Full_Name":"full_name","Mobile":"phone","Mobile2":"phone2","Email":"email","Address":"address",
    "Qualification":"qualification","Specialization":"specialization","Marital_Status":"marital_status","Insurance_No":"insurance_no",
    "National_ID":"national_id"}';
  dims constant jsonb := '{"Department":"workplace","Job_Title":"job_title","Grade_Title":"grade","Union_Org":"union_org","Member_State":"member_state"}';
begin
  p_job := nullif(trim(p_job), '');
  if p_job is null then return; end if;
  select id into v_id from core.persons where job_id = p_job;
  if v_id is null then return; end if;     -- غير الموجودين في core (تسجيل ذاتي/زائر) لا يُنقلون
  perform set_config('erp.actor', p_source, true);
  perform set_config('erp.reason', 'تعديل من ' || p_source, true);
  for k, col in select * from jsonb_each_text(personal) loop
    v := nullif(trim(p_new->>k), ''); o := nullif(trim(p_old->>k), '');
    if v is distinct from o and v is not null then
      if col in ('phone','phone2') and v !~ '^01[0-9]{9}$' then continue; end if;
      if col = 'national_id' and v !~ '^[23][0-9]{13}$' then continue; end if;
      if col = 'marital_status' and v not in ('أعزب','متزوج','مطلق','أرمل') then continue; end if;
      begin
        execute format('update core.persons set %I = $1 where id = $2', col) using v, v_id;
      exception when unique_violation or check_violation then null;  -- قيمة مكررة/غير صالحة: تُتجاهل ولا تُفشل حفظ الكتب
      end;
    end if;
  end loop;
  for k, col in select * from jsonb_each_text(dims) loop
    v := nullif(trim(p_new->>k), ''); o := nullif(trim(p_old->>k), '');
    if v is distinct from o and v is not null and v is distinct from core.state_at(v_id, col) then
      if col = 'union_org' and v not in ('النقابة العامة','نقابة مستقلة','غير منضم') then continue; end if;
      if col = 'member_state' and v not in ('نشط','موقوف','إجازة بدون أجر','نقل','معاش','استقالة','وفاة') then continue; end if;
      insert into core.person_movements(person_id, kind, field, from_value, to_value, effective_date, notes, created_by)
      values (v_id, 'تعديل من ' || p_source, col, core.state_at(v_id, col), v, current_date, 'تعديل من ' || p_source, p_source);
    end if;
  end loop;
end $$;
revoke all on function core.apply_external_edit(text, jsonb, jsonb, text) from public, anon, authenticated;

-- ───────── (ب) books: مُشغّل يرسل تعديلات الموظفين إلى core ─────────
create or replace function books.push_employee_to_core() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.tbl <> '03_Employees' or coalesce(current_setting('books.core_sync', true), '') = 'on' then return new; end if;
  perform core.apply_external_edit(new.emp_id, case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end, new.data, 'منظومة الكتب');
  return new;
end $$;
drop trigger if exists push_employee_to_core on books.records;
create trigger push_employee_to_core after insert or update on books.records
  for each row when (new.tbl = '03_Employees') execute function books.push_employee_to_core();

-- ───────── (ج) سحب core ← books بلا مسح ─────────
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
  perform set_config('books.core_sync', 'on', true);   -- لا يرتد التحديث إلى core عبر المُشغّل
  for p in
    select job_id, full_name, national_id, gender, birth_date, phone, phone2, email, address, qualification, specialization,
           marital_status, insurance_no, hire_date, retirement_date, monthly_dues, union_org, member_state, workplace, job_title, grade
    from core.person_current where coalesce(trim(job_id), '') <> ''
  loop
    tot := tot + 1;
    nid := regexp_replace(coalesce(p.national_id, ''), '\D', '', 'g');
    st := case when coalesce(nullif(trim(p.member_state), ''), 'نشط') = 'وفاة' then 'موقوف'
               when coalesce(nullif(trim(p.member_state), ''), 'نشط') = any(active) then 'ساري' else 'موقوف' end;
    -- القيم الفارغة في core تُحذف من التحديث (jsonb_strip_nulls + nullif) فلا تمسح ما في الكتب
    d := jsonb_strip_nulls(jsonb_build_object(
      'Emp_ID', trim(p.job_id),
      'Full_Name', nullif(p.full_name, ''),
      'National_ID', nullif(nid, ''),
      'National_ID_Last4', case when length(nid) >= 4 then right(nid, 4) end,
      'Mobile', nullif(p.phone, ''), 'Mobile2', nullif(p.phone2, ''), 'Email', nullif(p.email, ''), 'Address', nullif(p.address, ''),
      'Department', nullif(p.workplace, ''), 'Job_Title', nullif(p.job_title, ''), 'Grade_Title', nullif(p.grade, ''),
      'Union_Org', nullif(p.union_org, ''), 'Member_State', nullif(p.member_state, ''),
      'Hire_Date', to_char(p.hire_date, 'YYYY-MM-DD'), 'Retirement_Date', to_char(p.retirement_date, 'YYYY-MM-DD'),
      'Insurance_No', nullif(p.insurance_no, ''), 'Qualification', nullif(p.qualification, ''),
      'Specialization', nullif(p.specialization, ''), 'Marital_Status', nullif(p.marital_status, ''),
      'Gender', nullif(p.gender, ''), 'Birth_Date', to_char(p.birth_date, 'YYYY-MM-DD'),
      'Monthly_Dues', p.monthly_dues, 'Employment_Status', st));
    select id, data into cur from books.records where tbl = '03_Employees' and emp_id = trim(p.job_id) limit 1;
    if found then
      if cur.data is distinct from (cur.data || d) then
        update books.records set data = cur.data || d || jsonb_build_object('Updated_At', now_txt)
        where tbl = '03_Employees' and id = cur.id;
        u := u + 1;
      end if;
    else
      insert into books.records (tbl, id, ord, emp_id, data) values ('03_Employees',
        substr(replace(gen_random_uuid()::text, '-', ''), 1, 20), (extract(epoch from clock_timestamp()) * 1000000)::bigint, trim(p.job_id),
        d || jsonb_build_object('Installment_Allowed', true, 'Max_Credit_Limit', 0, 'Edit_Permitted', false, 'Notes', 'Supabase Core', 'Updated_At', now_txt));
      a := a + 1;
    end if;
  end loop;
  return query select a, u, tot;
end $$;
revoke all on function books.sync_employees_from_core() from public, anon, authenticated;

-- ───────── (د) المسار القديم (MyNekaba/Firestore) يُحوَّل إلى core ─────────
-- books-api (index.ts) ما زال يجلب من Firestore ويستدعي هذه الدالة: نتجاهل المدخل ونسحب من core.
create or replace function books.sync_employees_from_json(members jsonb)
returns table(added int, updated int, skipped int)
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  select * into r from books.sync_employees_from_core();
  return query select r.added, r.updated, 0;
end $$;
revoke all on function books.sync_employees_from_json(jsonb) from public, anon, authenticated;

-- المهمة الليلية: تسحب من core مباشرة وتسجّل SYNC_MEMBERS (يعتمد عليها فحص الصحة اليومي)
create or replace function books.run_member_sync() returns bigint
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  select * into r from books.sync_employees_from_core();
  insert into books.job_runs (job, ok, message)
  values ('SYNC_MEMBERS', true, 'مزامنة منصة النقابة (core): ' || r.total_in_core || ' — أُضيف ' || r.added || '، حُدِّث ' || r.updated);
  return r.updated + r.added;
exception when others then
  insert into books.job_runs (job, ok, message) values ('SYNC_MEMBERS', false, left(sqlerrm, 500));
  return -1;
end $$;
revoke all on function books.run_member_sync() from public, anon, authenticated;
