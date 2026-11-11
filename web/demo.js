/* نسخة عرض فقط: بيانات تجريبية محلية بدون خادم، والعمليات معطلة */
(function () {
  let D = null;
  const load = () => D ? Promise.resolve(D) : fetch("demo.json").then(r => r.json()).then(j => (D = j));
  window.call = async function (action) {
    busy(true); const d = await load(); await new Promise(r => setTimeout(r, 250)); busy(false);
    if (action === "GET_PUBLIC_INIT_DATA") return { success: true, settings: { INITIATIVE_TITLE: "مبادرة الكتب الخارجية المدرسية للعاملين" } };
    if (action === "LOGIN_ADMIN") return { success: true, sessionToken: "demo", user: { userType: "ADMIN", role: "Admin", fullName: "مدير المنظومة", username: "demo" } };
    if (action === "LOGIN_EMPLOYEE") return { success: false, message: "نسخة العرض متاحة للوحة الإدارة فقط" };
    if (action === "GET_ADMIN_DASHBOARD_DATA") return d.adm;
    if (action === "GET_SETTLEMENT_REPORT") return d.settlement;
    if (action === "LOGOUT") return { success: true };
    return { success: false, message: "نسخة عرض: العمليات معطلة" };
  };
})();
