# منظومة مبادرة الكتب الخارجية بالتقسيط

حجز الموظفين للكتب الخارجية بخصم وتقسيط، التوريد من المكتبة، التوزيع بأسبقية كل نسخة، التسليم، التحصيل، والتصفية النهائية.

## البنية

| المجلد | المحتوى | أين يعمل |
|---|---|---|
| `web/` | الواجهة (`index.html`) ورابط الخادم (`config.js`) | Vercel |
| `supabase/functions/books-api/` | الخادم: `index.ts` + `engine.js` + منطق العمل `logic.js` | Supabase Edge Functions |
| قاعدة البيانات | الجداول الـ 22 في `books.records` (schema مستقل في مشروع mynekaba) | Supabase Postgres |

الواجهة تتصل بالخادم عبر `POST {action, payload, token}`. التفاصيل في `supabase/README.md`.

## الاختبارات

```
cd test && npm install
node scenarios.test.js   # دورة موسم كاملة (61 فحصاً) على محرك Supabase
node web.smoke.js        # الواجهة كاملة في jsdom مع خادم محاكى
node ../supabase/live.test.mjs   # اختبار حي على الخادم
```
