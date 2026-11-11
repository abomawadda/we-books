-- المهمة اليومية لمنظومة الكتب (طُبِّقت على مشروع mynekaba)
create extension if not exists pg_cron;
create extension if not exists pg_net;

insert into books.config (key, value)
values ('cron_key', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

create or replace function books.run_daily_job() returns bigint
language sql security definer set search_path = '' as $$
  select net.http_post(
    url := 'https://bulfwclnhbwpzqwnxjie.supabase.co/functions/v1/books-api',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('action', 'DAILY_JOB', 'payload',
      jsonb_build_object('key', (select value from books.config where key = 'cron_key'))),
    timeout_milliseconds := 60000
  );
$$;
revoke all on function books.run_daily_job() from public, anon, authenticated;

-- 23:00 UTC = 1 صباحاً بتوقيت القاهرة شتاءً (2 صباحاً صيفاً)
select cron.schedule('books-daily-job', '0 23 * * *', 'select books.run_daily_job()');
