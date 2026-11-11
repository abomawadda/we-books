# خادم Firebase — المرحلة 1

## الفكرة
- `functions/runtime.js` يشغّل **`apps-script/Code.gs` نفسه بدون تعديل** داخل Node، ويستبدل `DB_Engine` (Sheets) بوحدة عمل فوق Firestore.
- كل عملية = **Firestore transaction واحدة**: تُحمَّل الجداول اللازمة ← يُنفَّذ المنطق في الذاكرة ← تُكتب النتائج ذرياً. إذا فشلت العملية لا يُكتب شيء.
- العدّادات (إيصالات/أذونات) داخل نفس الـ transaction ← ترقيم بلا فجوات. ختم الأسبقية من ساعة الخادم.
- الجداول الـ 22 = مجموعات Firestore بنفس الأسماء (`01_Settings` …). كل مستند فيه `_ord` لترتيب الإدراج.
- الدخول: الدالة تتحقق من البيانات وتُصدر **Custom Token** (claim `s` = بيانات الجلسة) ← `signInWithCustomToken` في المتصفح. جلسة الإدارة 12 ساعة؛ جلسة الموظف تبقى على الجهاز.
- قواعد Firestore: **منع كامل** للعميل؛ كل شيء عبر الدالة `api`.
- الواجهة: تتحول تلقائياً إلى Firebase عند ملء `FIREBASE` في `web/config.js` (التعديل في `core.js` فقط).

## الاختبارات
```bash
cd firebase/functions && npm i && npm test        # الـ 61 سيناريو على طبقة Firestore (مخزن ذاكرة)
```
```bash
cd firebase && firebase emulators:exec --only firestore --project demo-we-books "node test/emulator.test.js"
```

## خطوات التشغيل (تحتاج حسابك)
1. Firebase Console: أنشئ مشروعاً (Blaze)، فعّل Firestore (Native, `eur3` أو `europe-west1`) و Authentication، وأضف Web App.
2. ضع تنبيه ميزانية شهري صغيراً (Billing ← Budgets & alerts).
3. امنح حساب خدمة الدوال دور **Service Account Token Creator** على نفسه (لازم لـ `createCustomToken`).
4. `cp .firebaserc.example .firebaserc` وضع معرّف المشروع، ثم `firebase deploy --only functions,firestore`.
5. الهجرة: `node scripts/migrate-from-sheet.js --dry` ثم بدون `--dry` (والكتابة في الشيت موقوفة).
6. املأ `FIREBASE` في `web/config.js` وانشر الواجهة.

## المتبقي (المرحلة 2)
- **ضغط يوم الحجز:** الحجز حالياً يقرأ مجموعات كاملة داخل الـ transaction، فالحجوزات المتزامنة تتسلسل مع إعادة محاولات. الخطوة التالية: قراءة بيانات الموظف والكتب فقط في `SUBMIT_OR_UPDATE_RESERVATION` + عدّاد تسلسلي للأسبقية، ثم اختبار حمل.
- حدّ محاولات الدخول الخاطئة في ذاكرة كل نسخة خادم فقط ← نقله إلى Firestore.
- إيقاف حساب إداري لا يُلغي جلسته الحالية حتى انتهاء الـ 12 ساعة (يمكن إضافة `revokeRefreshTokens`).
- تصدير ليلي من Firestore إلى الشيت كنسخة تقارير (Scheduled Function).
