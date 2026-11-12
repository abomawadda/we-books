# مبادرة الكتب الخارجية بالتقسيط — دليل العمل لـ Claude Code

**تحدّث مع المستخدم بالعربية دائماً.** المستخدم يعمل غالباً من الموبايل، فقلّل خطوات النسخ واللصق اليدوية ونفّذ بنفسك ما تستطيع.

## الوضع الحالي (نوفمبر 2026)
- **الرابط الحي:** https://we-books-rose.vercel.app — من فرع `main` (مشروع Vercel `we-books`).
- **الواجهة (v3):** `web/` ملفات ثابتة بدون إطار عمل: `index.html` + `js/{core,app,employee,admin,reports,icons}.js` + `app.css`.
  - CSS يُبنى بـ Tailwind من `ui/`: `cd ui && npm i && node build.js` (يولّد `web/app.css` و`web/js/icons.js` والخطوط).
  - كل اتصال بالخادم يمر عبر دالة واحدة `call(action, payload)` في `web/js/core.js` (POST JSON: `{action, payload, token}`).
- **الخادم الحالي: Supabase** — Edge Function `books-api` في مشروع mynekaba (`bulfwclnhbwpzqwnxjie`)، schema مستقل `books`. التفاصيل في `supabase/README.md`.
  - منطق العمل = `supabase/functions/books-api/logic.js` (أصله Apps Script، أُزيلت منه أجزاء جوجل)، يشغّله `engine.js` فوق Postgres.
  - النشر والإعداد يتمان عبر أدوات Supabase المتصلة بالجلسة (بلا طرفية من المستخدم).
- أُزيل كل ما يخص جوجل (Apps Script والشيت) من المستودع بطلب المستخدم (نوفمبر 2026).
- **الاختبارات:** `cd test && npm i && node scenarios.test.js` (61 فحصاً على محرك Supabase)، و `node web.smoke.js` (الواجهة في jsdom)، و `node ../supabase/live.test.mjs` (اختبار حي).
- فرع `ui-demo`: نسخة عرض بلوحة الإدارة ببيانات تجريبية (لا تُدمج). فرع `main-react-backup`: نسخة React القديمة.

## قرار الخادم
جُرِّب Firebase وتُرك بسبب تعقيد النشر من الموبايل؛ اعتمد المستخدم **Supabase** (نوفمبر 2026).
المبادئ باقية: كل العمليات المالية على الخادم داخل transactions، ونفس عقد `call(action, payload)`، ونفس أسماء العمليات، وترقيم بلا فجوات.

## مصدر بيانات الموظفين
أعضاء النقابة من مشروع MyNekaba (منظومة النقابة). المبادرة منظومة مستقلة تستورد بيانات الموظفين فقط.

## بيانات تجريبية (للتطوير فقط — تُحذف قبل التشغيل)
- إدارة: admin / coord / finance / store — أُعطيت كلمات مرور عشوائية جديدة للمستخدم (نوفمبر 2026)، ويُطلب تغييرها عند أول دخول.
- الموظفون الحقيقيون يأتون من مزامنة MyNekaba (907 موظفاً)، وحُذف التجريبيون 1001/1002/1003.

## قواعد العمل
- لا تكتب في `main` مباشرة إلا بطلب المستخدم؛ اعمل على فرع ثم ادمج.
- رسائل الـ commit بالعربية.
- لا تضعف حماية Vercel أو أمان قاعدة البيانات (schema `books` غير معروض، و RLS مفعّل).
