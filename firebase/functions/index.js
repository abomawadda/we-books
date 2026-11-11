// خادم المبادرة على Firebase: دالة callable واحدة "api" بنفس عقد call(action, payload) في الواجهة.
'use strict';
process.env.TZ = 'Africa/Cairo'; // كل التواريخ النصية بتوقيت القاهرة كما في Apps Script

const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { createRuntime } = require('./runtime');
const { firestoreStore } = require('./store');

admin.initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 20 });
const db = admin.firestore();
const rt = createRuntime();
const store = firestoreStore(db, { indexed: rt.EMP_INDEXED });

const READ_ONLY = new Set(['GET_PUBLIC_INIT_DATA', 'GET_EMPLOYEE_PORTAL_DATA', 'GET_ADMIN_DASHBOARD_DATA', 'GET_SETTLEMENT_REPORT']);
const ADMIN_SESSION_SEC = 12 * 3600; // جلسة الإدارة 12 ساعة؛ الموظف تبقى جلسته على الجهاز
const EXPIRED = { success: false, message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى.' };

exports.api = onCall({ memory: '512MiB', timeoutSeconds: 120, concurrency: 40, cors: true }, async req => {
  const { action, payload } = req.data || {};
  if (typeof action !== 'string') return { success: false, message: 'طلب غير صالح.' };
  if (action === 'LOGOUT') return { success: true };
  try {
    if (action === 'LOGIN_EMPLOYEE' || action === 'LOGIN_ADMIN') {
      const res = await rt.run(store, action, rt.apiFn(action, payload, null));
      if (!res || !res.success) return res;
      const u = res.user;
      const uid = u.userType === 'EMPLOYEE' ? 'emp_' + u.empId : 'adm_' + u.userId;
      res.firebaseToken = await admin.auth().createCustomToken(uid, { s: u, role: u.role });
      delete res.sessionToken;
      return res;
    }
    let session = null;
    if (action !== 'GET_PUBLIC_INIT_DATA') {
      const tok = req.auth && req.auth.token;
      if (!tok || !tok.s) return EXPIRED;
      session = tok.s;
      if (session.userType === 'ADMIN' && Date.now() / 1000 - tok.auth_time > ADMIN_SESSION_SEC) return EXPIRED;
    }
    return await rt.run(store, action, rt.apiFn(action, payload, session), { readOnly: READ_ONLY.has(action), scope: rt.scopeFor(action, payload, session) });
  } catch (err) {
    console.error(action, err);
    return { success: false, message: 'حدث خطأ في الخادم أثناء تنفيذ العملية. حاول مرة أخرى.' };
  }
});

// المهمة اليومية: إغلاق المراحل المنتهية وتحديث الأقساط المتأخرة
exports.daily = onSchedule({ schedule: '0 1 * * *', timeZone: 'Africa/Cairo' }, async () => {
  await rt.run(store, 'JOB', g => g.dailyMaintenanceJob());
});
