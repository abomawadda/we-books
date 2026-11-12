-- تقوية الأمان (طُبِّقت على مشروع mynekaba)
-- حدّ محاولات الدخول الخاطئة (يبقى بعد إعادة تشغيل الخادم): 5 محاولات ثم إيقاف 15 دقيقة
create table if not exists books.auth_fails (
  k text primary key, fails int not null default 0, locked_until timestamptz, updated_at timestamptz not null default now()
);
alter table books.auth_fails enable row level security;
revoke all on books.auth_fails from public, anon, authenticated;

-- نسخة منطق العمل المعتمدة داخل قاعدة البيانات (حتى لا يعتمد الخادم على GitHub وقت التشغيل)
create table if not exists books.logic (commit_sha text primary key, code text not null, saved_at timestamptz not null default now());
alter table books.logic enable row level security;
revoke all on books.logic from public, anon, authenticated;

-- تقرير الأعضاء الذين لم تُضفهم المزامنة لنقص بياناتهم
create table if not exists books.sync_skipped (run_at timestamptz not null, job_id text, name text, workplace text, missing text not null);
alter table books.sync_skipped enable row level security;
revoke all on books.sync_skipped from public, anon, authenticated;
