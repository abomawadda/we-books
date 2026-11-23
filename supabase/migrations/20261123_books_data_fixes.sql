-- إصلاحات بيانات الكتب (23 نوفمبر 2026 — بموافقة المستخدم، نُفّذت مباشرة على القاعدة)
-- 1) «وفاة» لا تسمح بالدخول/الحجز
update books.config set value = 'نشط,موقوف,إجازة بدون أجر,معاش,استقالة' where key = 'active_member_states';
-- 2) قائمة «تجاوزتهم المزامنة» من مزامنة MyNekaba القديمة (14 نوفمبر) — الـ224 موجودون الآن عبر المصدر الواحد core
delete from books.sync_skipped;
-- 3) جداول نسخ احتياطية قديمة (21–22 نوفمبر) بعد استقرار التشغيل
drop table if exists books.records_backup_employees_20261122;
drop table if exists books.records_backup_reset_20261121222325;
