-- تحميل دليل الكتب: p = [[code,grade,stage,types,publisher,subject,part],...]
-- الكتب التجريبية القديمة (BK-...) لا تُحذف لارتباطها بحركات قديمة، بل تُوقف (Discontinued) فتختفي من الحجز.
create or replace function books.load_catalog(p jsonb, pubs text, subs text, parts text) returns int
language plpgsql security definer set search_path = books, pg_temp as $$
declare n int := 0; r jsonb; t text[]; nm text;
  en text[] := array['إنجليزي','فرنساوي','ألماني','ماث','ساينس','أي سي تي','ديسكفري'];
  base bigint := (extract(epoch from now())*1000)::bigint * 1000;
begin
  perform pg_advisory_xact_lock(7001);
  update records set data = data || '{"Book_Status":"Discontinued"}'
   where tbl = '05_Books_Catalog' and data->>'Book_ID' like 'BK-%';
  for r in select * from jsonb_array_elements(p) loop
    t := string_to_array(r->>3, '،');
    nm := (r->>4) || ' — ' || (r->>5)
       || case when array_length(t,1) = 1 and t[1] = 'لغات' and not (r->>5 = any(en)) then ' لغات' else '' end
       || case when coalesce(r->>6,'') <> '' then ' (' || (r->>6) || ')' else '' end;
    insert into records (tbl, id, ord, emp_id, data) values ('05_Books_Catalog', 'cat_' || (r->>0), base + n, null,
      jsonb_build_object('Book_ID', r->>0, 'Book_Name', nm, 'Stage', r->>2, 'Grade', r->>1, 'Subject', r->>5,
        'Publisher', r->>4, 'School_Types', r->>3, 'Book_Part', coalesce(r->>6,''), 'Supplier_ID', '', 'Cover_Price', '',
        'Supplier_Discount_Pct', '', 'Volume_Discount_Share_Pct', '', 'Emp_Discount_Pct', '', 'Initial_Purchase_Price', '',
        'Standard_Net_Cost', '', 'Emp_Selling_Price', '', 'Book_Status', 'Pricing'))
    on conflict (tbl, id) do nothing;
    n := n + 1;
  end loop;
  -- إعدادات القوائم المنسدلة
  insert into records (tbl, id, ord, emp_id, data)
  select '01_Settings', 'set_' || k, base + 100000 + i, null, jsonb_build_object('Setting_Key', k, 'Setting_Value', v,
    'Data_Type', 'STRING', 'Description', d, 'Updated_At', to_char(now() at time zone 'Africa/Cairo','YYYY-MM-DD HH24:MI:SS'), 'Updated_By', 'SYSTEM')
  from (values (1,'BOOK_PUBLISHERS',pubs,'قائمة الناشرين في نموذج الكتاب (مفصولة بفاصلة)'),
               (2,'BOOK_SUBJECTS',subs,'قائمة المواد في نموذج الكتاب (مفصولة بفاصلة)'),
               (3,'BOOK_PARTS',parts,'أجزاء الكتاب: شرح، أسئلة، تدريبات... (مفصولة بفاصلة)')) x(i,k,v,d)
  where not exists (select 1 from records s where s.tbl = '01_Settings' and s.data->>'Setting_Key' = x.k and s.id <> 'set_' || x.k)
  on conflict (tbl, id) do update set data = excluded.data;
  return n;
end $$;
revoke all on function books.load_catalog(jsonb,text,text,text) from public, anon, authenticated;
