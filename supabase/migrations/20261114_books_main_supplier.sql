-- كل الكتب تتبع المكتبة الرئيسية المسجلة (أول مكتبة في 04_Suppliers حسب ترتيب الإدخال ord).
-- تُشغَّل مرة واحدة لربط الكتب الحالية (ومنها كتب الدليل المحمّلة بـ Supplier_ID فارغ).
-- بعدها يتولى الخادم الربط تلقائياً: حفظ/تسعير/استيراد كتاب، وحفظ أو حذف مكتبة (logic.js: assignBooksToMainSupplier_).
-- آمنة للتكرار: لا تمس إلا الكتب المرتبطة بغير الرئيسية، ولا تفعل شيئاً إن لم تُسجَّل مكتبة.
with main as (
  select data->>'Supplier_ID' as sid from books.records where tbl = '04_Suppliers' order by ord limit 1
)
update books.records r
   set data = r.data || jsonb_build_object('Supplier_ID', main.sid)
  from main
 where r.tbl = '05_Books_Catalog'
   and coalesce(r.data->>'Supplier_ID', '') <> main.sid;
