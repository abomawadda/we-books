-- تصفير بيانات التشغيل (نسخة SQL للتنفيذ اليدوي في Supabase؛ المكافئ لعملية RESET_OPERATIONAL_DATA في لوحة الإدارة).
-- تأخذ نسخة احتياطية كاملة أولًا ثم تحذف: المراحل والحجوزات والتوريدات والفواتير والأقساط والمدفوعات والمخزون والمصروفات
-- وسجل التدقيق وإغلاقات الخزينة، وتصفّر الترقيم (21_Doc_Counters). لا تمس: الإعدادات، الحسابات، الموظفين، المكتبات، الكتب والأسعار.
-- التشغيل: select books.reset_operational_data();   (الاسترجاع من النسخة: books.records_backup_reset_20261115)
create or replace function books.reset_operational_data() returns jsonb language plpgsql security definer set search_path = books, public as 332
declare n int; res jsonb;
begin
  execute 'create table if not exists books.records_backup_reset_20261115 as select now() as backed_up_at, r.* from books.records r';
  execute 'alter table books.records_backup_reset_20261115 enable row level security';
  execute 'revoke all on books.records_backup_reset_20261115 from public, anon, authenticated';
  with d as (delete from books.records where tbl in (
      '06_Phases','07_Reservations_Header','08_Reservations_Items','09_Reservation_Audit_Log','10_Purchase_Orders_Snapshot',
      '11_Supplier_Invoices_Header','12_Supplier_Invoices_Items','13_Inventory_Ledger','14_Delivery_And_Returns','15_Employee_Invoices',
      '16_Installment_Schedules','17_Employee_Payments','18_Supplier_Ledger_Payments','19_Initiative_Expenses','20_System_Audit_Trail',
      '21_Doc_Counters','22_Cash_Closings') returning tbl)
  select jsonb_object_agg(tbl, c) into res from (select tbl, count(*) c from d group by tbl) x;
  return coalesce(res, '{}'::jsonb);
end 332;
revoke all on function books.reset_operational_data() from public, anon, authenticated;
