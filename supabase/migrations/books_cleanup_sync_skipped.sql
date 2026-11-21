-- تنظيف books.sync_skipped والاحتفاظ بآخر تشغيل فقط لمنع التراكم اليومي
-- يُنفَّذ على مشروع mynekaba في Supabase SQL Editor

create or replace function books.cleanup_sync_skipped() returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0;
begin
  with gone as (
    delete from books.sync_skipped
    where run_at < (select max(run_at) from books.sync_skipped)
    returning 1
  )
  select count(*) into n from gone;
  return n;
end $$;

revoke all on function books.cleanup_sync_skipped() from public, anon, authenticated;

-- تنظيف فوري للمتراكم الآن
select books.cleanup_sync_skipped() as deleted_old_rows;

-- جدولة يومية بعد مزامنة الأعضاء بـ 15 دقيقة (22:45 UTC)
select cron.schedule('books-cleanup-sync-skipped', '45 22 * * *', 'select books.cleanup_sync_skipped()');
