# مبادرة الكتب الخارجية بالتقسيط — دليل العمل لـ Claude Code

**تحدّث مع المستخدم بالعربية دائماً.** المستخدم يعمل غالباً من الموبايل، فقلّل خطوات النسخ واللصق اليدوية ونفّذ بنفسك ما تستطيع.

## الوضع الحالي (نوفمبر 2026)
- **الرابط الحي:** https://we-books-rose.vercel.app — من فرع `main` (مشروع Vercel `we-books`).
- **الواجهة (v3):** `web/` ملفات ثابتة بدون إطار عمل: `index.html` + `js/{core,app,employee,admin,reports,icons}.js` + `app.css`.
  - CSS يُبنى بـ Tailwind من `ui/`: `cd ui && npm i && node build.js` (يولّد `web/app.css` و`web/js/icons.js` والخطوط).
  - كل اتصال بالخادم يمر عبر دالة واحدة `call(action, payload)` في `web/js/core.js` (POST JSON: `{action, payload, token}`).
- **الخادم الحالي:** Google Apps Script (`apps-script/Code.gs`، الإصدار 2.3.0) + Google Sheet بـ 22 جدولاً.
  - Sheet ID: `1gvbF2BhoHMeektLSEFZFqFMWjUQPvEZuQsXdGuVJGiM`
  - مشروع Apps Script يحتوي محمِّلاً صغيراً (`apps-script/loader/Code.gs`) يقرأ أحدث ملف `we-books-server.js` من Drive المستخدم. التحديث = رفع ملف جديد بنفس الاسم (يُبنى بـ `node test/build-bundle.js apps-script/Code.gs out/server.bundle.js`).
- **الاختبارات:** `cd test && npm i && node scenarios.test.js` (61 فحصاً لمنطق الخادم) و `node web.smoke.js` (الواجهة كاملة في jsdom مع خادم محاكى).
- فرع `ui-demo`: نسخة عرض بلوحة الإدارة ببيانات تجريبية (لا تُدمج). فرع `main-react-backup`: نسخة React القديمة.

## القرار التالي: الانتقال إلى Firebase (معتمد من المستخدم)
السبب: كثرة العمليات وضغط يوم فتح الحجز (الأسبقية بالثانية)، وبطء Apps Script (~10 ث) وقيود التزامن.
خطة Blaze مفعّلة ومربوطة بكارت — ضع تنبيه ميزانية شهري صغيراً.

**المبادئ:**
1. تسجيل الدخول بنفس البيانات بلا تعقيد:
   - الموظف: الرقم الوظيفي + آخر 4 من الرقم القومي + الموبايل ← Cloud Function تتحقق وتُصدر Custom Token ← `signInWithCustomToken`، والجلسة تبقى على الجهاز.
   - الإدارة: اسم مستخدم + كلمة مرور (أدوار: Admin, Coordinator, Finance, Warehouse) كـ custom claims.
2. **كل العمليات المالية والمخزنية على الخادم** (Cloud Functions callable، داخل Firestore transactions). العميل يقرأ فقط ما تسمح به Security Rules (الموظف يقرأ بياناته فقط).
3. الأسبقية = `FieldValue.serverTimestamp()` + عدّاد تسلسلي داخل transaction (لا تعتمد على ساعة الجهاز).
4. أبقِ عقد `call(action, payload)` كما هو: الواجهة لا تتغير إلا في `core.js` (استبدال fetch بـ `httpsCallable('api')`). نفس أسماء العمليات (LOGIN_EMPLOYEE, SUBMIT_OR_UPDATE_RESERVATION, RUN_ALLOCATION_ENGINE, ...).
5. انقل منطق `OperationsEngine` من `apps-script/Code.gs` كما هو قدر الإمكان (نفس JavaScript)، واستبدل طبقة `DB_Engine` (Sheets) بطبقة Firestore. شغّل `scenarios.test.js` على الطبقة الجديدة (Firestore Emulator).
6. ترقيم المستندات بلا فجوات (إيصالات، أذونات) عبر عدّادات في transaction.
7. هجرة البيانات: سكربت يقرأ الـ 22 جدولاً من الشيت ويكتبها في Firestore. ويبقى الشيت نسخة تقارير تُحدَّث ليلاً (Scheduled Function).
8. الاستضافة: يمكن البقاء على Vercel للواجهة، أو Firebase Hosting.

## مصدر بيانات الموظفين
أعضاء النقابة من مشروع MyNekaba (منظومة النقابة). المبادرة منظومة مستقلة تستورد بيانات الموظفين فقط.

## بيانات تجريبية (للتطوير فقط — تُحذف قبل التشغيل)
- إدارة: admin / coord / finance / store بكلمات مرور مؤقتة تُغيَّر عند أول دخول.
- موظفون: 1001 (4512, 01012345678)، 1002 (8834, 01122334455)، 1003 (0921, 01233445566).

## قواعد العمل
- لا تكتب في `main` مباشرة إلا بطلب المستخدم؛ اعمل على فرع ثم ادمج.
- رسائل الـ commit بالعربية.
- لا تضعف حماية Vercel أو قواعد Firestore الأمنية.
