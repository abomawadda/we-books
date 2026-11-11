// إعداد الخادم. غيّره هنا فقط.
// - API_URL: رابط نشر Apps Script (الخادم الحالي).
// - FIREBASE: عند ملئه تنتقل الواجهة تلقائياً إلى Cloud Functions (الدالة api) بدلاً من Apps Script.
//   انسخ القيم من Firebase Console ← Project settings ← Your apps ← Web app (هذه القيم عامة وليست أسراراً).
window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbzhHbydK9xxwh5mqR7Zjmz7bGknNysp60j0GWcmjAwk6oPYs4pMyfuETzybBrZ1wm2G3g/exec",
  FIREBASE: null
  // FIREBASE: { apiKey: "…", authDomain: "PROJECT.firebaseapp.com", projectId: "PROJECT", appId: "…", region: "europe-west1" }
};
