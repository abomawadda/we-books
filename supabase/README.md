# خادم Supabase (الخادم الحالي)

- **الرابط:** `https://bulfwclnhbwpzqwnxjie.supabase.co/functions/v1/books-api` (مشروع mynekaba)
- **العقد:** `POST {action, payload, token}` ← JSON (الواجهة: `call()` في `web/js/core.js`).
- **منطق العمل:** `functions/books-api/logic.js`؛ الدالة تجلبه من GitHub مثبَّتاً على commit (`CODE_COMMIT` في `index.ts`).
  لتحديث المنطق: ادفع التعديل، ثم غيّر `CODE_COMMIT` وأعد نشر الدالة.
- **البيانات:** schema مستقل `books` (غير معروض عبر Data API، و RLS مفعّل بلا سياسات):
  - `books.records(tbl, id, ord, emp_id, data jsonb)` — الجداول الـ 22 (`01_Settings` … `22_Cash_Closings`).
  - `books.config` — مفتاح توقيع الجلسات (يُولَّد داخل قاعدة البيانات).
- **التزامن والأمان المالي:** كل عملية = transaction واحدة. الحجز يأخذ قفلاً على الموظف وحده (حجوزات الموظفين تتوازى)،
  وباقي عمليات الكتابة قفلاً عاماً (تسلسل كامل). إن فشلت العملية لا يُكتب شيء. الترقيم بلا فجوات.
- **الجلسات:** رمز موقّع HMAC؛ الإدارة 12 ساعة، الموظف 180 يوماً (تبقى على الجهاز).
- **التوقيت:** كل التواريخ بتوقيت القاهرة (مع الصيفي) رغم أن الخادم UTC.

## الاختبارات
```bash
cd test && node scenarios.test.js                  # الـ 61 سيناريو على محرك Supabase
node ../supabase/live.test.mjs                     # اختبار حي على الخادم (دخول، حجز متزامن، صلاحيات)
```

## المهمة اليومية
- `pg_cron` يشغّل `books.run_daily_job()` يومياً 23:00 UTC (1 صباحاً بالقاهرة شتاءً): تستدعي الدالة بالعملية `DAILY_JOB`
  ← `dailyMaintenanceJob` من logic.js (إغلاق المراحل المنتهية، وتحديث حالة الأقساط المتأخرة).
- محمية بمفتاح `cron_key` في `books.config` لا يغادر قاعدة البيانات. التشغيل يدوياً: `select books.run_daily_job();`
- النتيجة في `net._http_response`. ملف الإعداد: `supabase/migrations/books_daily_job.sql`.

## مزامنة الموظفين من MyNekaba
- المصدر: أعضاء MyNekaba الحقيقيون في Firestore (`nekaba2026` / مجموعة `employees`).
- `books-api` بالعملية `SYNC_MEMBERS` يقرأهم بمفتاح حساب خدمة **قراءة فقط** (سر الدالة `NEKABA_SA_JSON`، دور Cloud Datastore Viewer)
  ثم يستدعي `books.sync_employees_from_json` و`books.remove_demo_employees`.
- الحقول: `jobId`←الرقم الوظيفي، آخر 4 من `nationalId`، `phone` بعد التوحيد، `workplace`، `jobTitle`، `memberState`.
- بقرار المستخدم **الجميع مسموح لهم بالحجز** (`active_member_states`). إعدادات المبادرة لكل موظف لا تُمس.
- الموظفون التجريبيون 1001/1002/1003 يُزالون تلقائياً بعد أول مزامنة حقيقية (إن لم تكن لهم حركة).
- تعمل كل ليلة 22:30 UTC، ويدوياً من حساب Admin: `call("SYNC_MEMBERS")`، أو `select books.run_member_sync();`
- ملف الإعداد: `supabase/migrations/books_sync_from_firestore.sql`.

## المتبقي
- تغيير كلمات مرور الإدارة المؤقتة وحذف البيانات التجريبية قبل التشغيل الفعلي.
