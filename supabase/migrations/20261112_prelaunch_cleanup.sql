-- تنظيف ما قبل التشغيل (نُفّذ مرة واحدة 2026-11-12 بطلب المستخدم):
-- نسخة احتياطية كاملة في books.records_backup_prelaunch، ثم حذف الحركات التجريبية والكتب BK-* والمراحل وتصفير الترقيم.
-- لا يمس: الإعدادات، الحسابات، الموظفين، الكتب الحقيقية، المكتبة (أُزيل «تجريبي» من اسمها).
create table if not exists books.records_backup_prelaunch as select now() as backed_up_at, r.* from books.records r;
alter table books.records_backup_prelaunch enable row level security;
revoke all on books.records_backup_prelaunch from public, anon, authenticated;
-- الدالة books.prelaunch_cleanup() — انظر سجل الهجرات في Supabase (pre_launch_cleanup).
