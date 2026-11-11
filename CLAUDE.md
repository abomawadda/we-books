# مبادرة الكتب الخارجية بالتقسيط — دليل العمل لـ Claude Code

**تحدّث مع المستخدم بالعربية دائماً.** المستخدم يعمل غالباً من الموبايل، فقلّل خطوات النسخ واللصق اليدوية ونفّذ بنفسك ما تستطيع.

## الوضع الحالي (نوفمبر 2026)
- **الرابط الحي:** https://we-books-rose.vercel.app — من فرع `main` (مشروع Vercel `we-books`).
- **الواجهة (v3):** `web/` ملفات ثابتة بدون إطار عمل: `index.html` + `js/{core,app,employee,admin,reports,icons}.js` + `app.css`.
  - CSS يُبنى بـ Tailwind من `ui/`: `cd ui && npm i && node build.js` (يولّد `web/app.css` و`web/js/icons.js` والخطوط).
  - كل اتصال بالخادم يمر عبر دالة واحدة `call(action, payload)` في `web/js/core.js` (POST JSON: `{action, payload, token}`).
- **الخادم الحالي: Supabase** — Edge Function `books-api` في مشروع mynekaba (`bulfwclnhbwpzqwnxjie`)، schema مستقل `books`. التفاصيل في `supabase/README.md`.
  - منطق العمل = `apps-script/Code.gs` بلا تعديل، يشغّله `supabase/functions/books-api/engine.js` فوق Postgres.
  - النشر والإعداد يتمان عبر أدوات Supabase المتصلة بالجلسة (بلا طرفية من المستخدم).
- الخادم السابق: Google Apps Script + Google Sheet (`1gvbF2BhoHMeektLSEFZFqFMWjUQPvEZuQsXdGuVJGiM`) — متاح للرجوع بتغيير `web/config.js`.
- **الاختبارات:** `cd test && npm i && node scenarios.test.js` (61 فحصاً لمنطق الخادم)، و `node ../supabase/run-scenarios.mjs` (نفسها على محرك Supabase)، و `node web.smoke.js` (الواجهة في jsdom)، و `node ../supabase/live.test.mjs` (اختبار حي).
- فرع `ui-demo`: نسخة عرض بلوحة الإدارة ببيانات تجريبية (لا تُدمج). فرع `main-react-backup`: نسخة React القديمة.

## قرار الخادم
جُرِّب Firebase وتُرك بسبب تعقيد النشر من الموبايل؛ اعتمد المستخدم **Supabase** (نوفمبر 2026).
المبادئ باقية: كل العمليات المالية على الخادم داخل transactions، ونفس عقد `call(action, payload)`، ونفس أسماء العمليات، وترقيم بلا فجوات.

## مصدر بيانات الموظفين
أعضاء النقابة من مشروع MyNekaba (منظومة النقابة). المبادرة منظومة مستقلة تستورد بيانات الموظفين فقط.

## بيانات تجريبية (للتطوير فقط — تُحذف قبل التشغيل)
- إدارة: admin / coord / finance / store بكلمات مرور مؤقتة تُغيَّر عند أول دخول.
- موظفون: 1001 (4512, 01012345678)، 1002 (8834, 01122334455)، 1003 (0921, 01233445566).

## قواعد العمل
- لا تكتب في `main` مباشرة إلا بطلب المستخدم؛ اعمل على فرع ثم ادمج.
- رسائل الـ commit بالعربية.
- لا تضعف حماية Vercel أو قواعد Firestore الأمنية.
