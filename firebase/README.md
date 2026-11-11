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
firebase emulators:exec --only firestore --project demo-we-books "node test/load.test.js 200"
```

## خطوات التشغيل (تحتاج حسابك)
1. Firebase Console: أنشئ مشروعاً (Blaze)، فعّل Firestore (Native, `eur3` أو `europe-west1`) و Authentication، وأضف Web App.
2. ضع تنبيه ميزانية شهري صغيراً (Billing ← Budgets & alerts).
3. امنح حساب خدمة الدوال دور **Service Account Token Creator** على نفسه (لازم لـ `createCustomToken`).
4. `cp .firebaserc.example .firebaserc` (المشروع: `we-books-9d3a0`)، ثم `firebase deploy --only functions,firestore`.
5. الهجرة: `node scripts/migrate-from-sheet.js --dry` ثم بدون `--dry` (والكتابة في الشيت موقوفة).
6. في `web/config.js` اجعل `FIREBASE: window.FIREBASE_READY` (الإعدادات موجودة) وانشر الواجهة.

## المرحلة 2: ضغط يوم الحجز (منفّذة)
- `SUBMIT_OR_UPDATE_RESERVATION` يحمّل صفوف الموظف وحده من الموظفين والحجوزات والفواتير والأقساط.
- القراءة عبر **فهرس الموظف** `_emp_index/{Emp_ID}` (معرّفات مستنداته لكل جدول) ثم قراءة المستندات بمعرّفاتها — بلا استعلامات داخل الـ transaction، لأن الاستعلام يقفل نطاقاً يتعارض مع إضافات الآخرين (أثبتناه: 30 عملية باستعلام = 266 محاولة، وبالمعرّف = 30).
- الفهرس يُحدَّث تلقائياً مع كل كتابة (arrayUnion/arrayRemove)، وسكربت الهجرة يبنيه.
- `overwriteTableData` يكتب الفروق فقط ويحافظ على نفس المستند لنفس المفتاح.
- قائمة الجداول للحجز محمَّلة مسبقاً فلا يعيد كل طلب متزامن اكتشافها.
- **الأسبقية:** ختم بالملّي ثانية من ساعة خادم Google داخل الـ transaction. لم نضف عدّاداً تسلسلياً عاماً لأنه مستند واحد تتزاحم عليه كل الحجوزات فيعيد عنق الزجاجة نفسه.
- اختبار الحمل (`test/load.test.js`): **200 حجز متزامن في ~2.6 ث على المحاكي، 210 محاولة لـ 203 عملية**، بلا بنود مكررة أو ضائعة، وتعديل متزامن لنفس الموظف يُسلسَل صحيحاً.

## المتبقي
- حدّ محاولات الدخول الخاطئة في ذاكرة كل نسخة خادم فقط ← نقله إلى Firestore.
- إيقاف حساب إداري لا يُلغي جلسته الحالية حتى انتهاء الـ 12 ساعة (يمكن إضافة `revokeRefreshTokens`).
- تصدير ليلي من Firestore إلى الشيت كنسخة تقارير (Scheduled Function).
