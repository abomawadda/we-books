-- المتابعة والنسخ الاحتياطي (طُبِّقت على mynekaba)
create table if not exists books.job_runs (
  id bigserial primary key, job text not null, ok boolean not null, message text, at timestamptz not null default now()
);
create index if not exists job_runs_job_at on books.job_runs (job, at desc);
alter table books.job_runs enable row level security;
revoke all on books.job_runs from public, anon, authenticated;

create table if not exists books.daily_snapshot (
  day date primary key, rows int not null, data jsonb not null, taken_at timestamptz not null default now()
);
alter table books.daily_snapshot enable row level security;
revoke all on books.daily_snapshot from public, anon, authenticated;

-- نسخة يومية لكل books.records، تُحفظ 14 يوماً
create or replace function books.take_snapshot() returns int
language plpgsql security definer set search_path = '' as $$
declare n int; d date := (now() at time zone 'Africa/Cairo')::date; gone int;
begin
  insert into books.daily_snapshot (day, rows, data)
  select d, count(*), coalesce(jsonb_agg(jsonb_build_object('tbl', tbl, 'id', id, 'ord', ord, 'emp_id', emp_id, 'data', data)), '[]'::jsonb)
  from books.records
  on conflict (day) do update set rows = excluded.rows, data = excluded.data, taken_at = now();
  select rows into n from books.daily_snapshot where day = d;
  with old as (delete from books.daily_snapshot where day < d - 13 returning 1) select count(*) into gone from old;
  insert into books.job_runs (job, ok, message) values ('SNAPSHOT', true, n || ' سجل');
  return n;
exception when others then
  insert into books.job_runs (job, ok, message) values ('SNAPSHOT', false, sqlerrm);
  return -1;
end $$;
revoke all on function books.take_snapshot() from public, anon, authenticated;

-- استرجاع جدول (أو الكل) من نسخة يوم: select books.restore_from_snapshot('2026-11-12', '08_Reservations_Items');
create or replace function books.restore_from_snapshot(p_day date, p_tbl text default null) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform pg_advisory_xact_lock(7001);
  if not exists (select 1 from books.daily_snapshot where day = p_day) then raise exception 'لا توجد نسخة بتاريخ %', p_day; end if;
  delete from books.records where p_tbl is null or tbl = p_tbl;
  insert into books.records (tbl, id, ord, emp_id, data)
  select x->>'tbl', x->>'id', (x->>'ord')::bigint, x->>'emp_id', x->'data'
  from books.daily_snapshot s, jsonb_array_elements(s.data) x
  where s.day = p_day and (p_tbl is null or x->>'tbl' = p_tbl);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function books.restore_from_snapshot(date, text) from public, anon, authenticated;

select cron.schedule('books-daily-snapshot', '45 23 * * *', 'select books.take_snapshot()');
