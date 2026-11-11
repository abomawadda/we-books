// إعداد الخادم. غيّره هنا فقط.
// - API_URL: رابط نشر Apps Script (الخادم الحالي).
// - FIREBASE: عند ملئه تنتقل الواجهة تلقائياً إلى Cloud Functions (الدالة api) بدلاً من Apps Script.
//   انسخ القيم من Firebase Console ← Project settings ← Your apps ← Web app (هذه القيم عامة وليست أسراراً).
window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbzhHbydK9xxwh5mqR7Zjmz7bGknNysp60j0GWcmjAwk6oPYs4pMyfuETzybBrZ1wm2G3g/exec",
  // يبقى null حتى نشر الدوال (firebase deploy)، ثم يُستبدل بـ FIREBASE_READY
  FIREBASE: null
};
// إعدادات مشروع we-books-9d3a0 (قيم عامة لتطبيق الويب، ليست أسراراً؛ الحماية في قواعد Firestore والدالة api)
window.FIREBASE_READY = {
  apiKey: "AIzaSyA_BsheQXqb5G2R1-sbPepc0iVK6GjvZCc",
  authDomain: "we-books-9d3a0.firebaseapp.com",
  projectId: "we-books-9d3a0",
  storageBucket: "we-books-9d3a0.firebasestorage.app",
  messagingSenderId: "87013398050",
  appId: "1:87013398050:web:52539567a1d6eaf52adc7b",
  region: "europe-west1"
};
