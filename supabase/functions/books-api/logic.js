/**
 * ============================================================================
 * منظومة مبادرة الكتب الخارجية المدرسية بالتخفيض والتقسيط — منطق العمل (الإصدار 2.3.0)
 * يعمل على Supabase: يحمّله ويشغّله engine.js فوق Postgres (schema books).
 * كان أصله Google Apps Script؛ أُزيلت كل الأجزاء الخاصة بجوجل وبقي المنطق كما هو.
 * ============================================================================
 */

const SYSTEM_CONFIG = {
  APP_TITLE: "منظومة إدارة مبادرة الكتب المدرسية بالتخفيض والتقسيط",
  VERSION: "2.3.0",
  LOCK_TIMEOUT_MS: 25000,
  SESSION_TTL_SEC: 21600, // 6 ساعات
  LOGIN_MAX_FAILS: 5,
  LOGIN_LOCK_SEC: 900,    // 15 دقيقة
  SHEETS: {
    SETTINGS: "01_Settings",
    USERS: "02_Users_Roles",
    EMPLOYEES: "03_Employees",
    SUPPLIERS: "04_Suppliers",
    BOOKS: "05_Books_Catalog",
    PHASES: "06_Phases",
    RES_HEADER: "07_Reservations_Header",
    RES_ITEMS: "08_Reservations_Items",
    RES_AUDIT: "09_Reservation_Audit_Log",
    PO_SNAPSHOT: "10_Purchase_Orders_Snapshot",
    SUP_INV_HEADER: "11_Supplier_Invoices_Header",
    SUP_INV_ITEMS: "12_Supplier_Invoices_Items",
    INVENTORY: "13_Inventory_Ledger",
    DELIVERY_RETURNS: "14_Delivery_And_Returns",
    EMP_INVOICES: "15_Employee_Invoices",
    INSTALLMENTS: "16_Installment_Schedules",
    EMP_PAYMENTS: "17_Employee_Payments",
    SUP_LEDGER: "18_Supplier_Ledger_Payments",
    EXPENSES: "19_Initiative_Expenses",
    AUDIT_TRAIL: "20_System_Audit_Trail",
    COUNTERS: "21_Doc_Counters",
    CASH_CLOSINGS: "22_Cash_Closings"
  },
  ROLES: ["Admin", "Coordinator", "Finance", "Warehouse"],
  PHASE_STATUSES: ["Draft", "Open", "Closed", "Ordered", "Receiving", "Delivering", "Completed"],
  BOOKABLE_BOOK_STATUSES: ["Available", "Not_Yet_Printed"],
  // كتالوج الكتب: الصفوف بأكوادها (المرحلة تُشتق من الصف)، وأنواع المدارس. الناشرون والمواد وأجزاء الكتاب
  // قوائم قابلة للتعديل من الإعدادات (BOOK_PUBLISHERS / BOOK_SUBJECTS / BOOK_PARTS) مفصولة بفاصلة.
  CATALOG: {
    GRADES: [
      { code: "TAS", label: "تأسيس", stage: "رياض الأطفال" },
      { code: "KG1", label: "كي جي 1", stage: "رياض الأطفال" },
      { code: "KG2", label: "كي جي 2", stage: "رياض الأطفال" },
      { code: "P1", label: "1 ابتدائي", stage: "المرحلة الابتدائية" },
      { code: "P2", label: "2 ابتدائي", stage: "المرحلة الابتدائية" },
      { code: "P3", label: "3 ابتدائي", stage: "المرحلة الابتدائية" },
      { code: "P4", label: "4 ابتدائي", stage: "المرحلة الابتدائية" },
      { code: "P5", label: "5 ابتدائي", stage: "المرحلة الابتدائية" },
      { code: "P6", label: "6 ابتدائي", stage: "المرحلة الابتدائية" },
      { code: "M1", label: "1 إعدادي", stage: "المرحلة الإعدادية" },
      { code: "M2", label: "2 إعدادي", stage: "المرحلة الإعدادية" },
      { code: "M3", label: "3 إعدادي", stage: "المرحلة الإعدادية" },
      { code: "S1", label: "1 ثانوي", stage: "المرحلة الثانوية" },
      { code: "S2", label: "2 ثانوي", stage: "المرحلة الثانوية" },
      { code: "S3", label: "3 ثانوي", stage: "المرحلة الثانوية" }
    ],
    SCHOOL_TYPES: ["حكومي", "لغات", "أزهر"]
  },
  EXPENSE_CATEGORIES: ["مصاريف شحن ونقل", "مصاريف تحميل وتنزيل ومشال", "مصاريف تعبئة وتغليف", "أجور عمال ومكافآت تنظيم", "أخرى"]
};

// أعمدة تُخزَّن كنص حتى لا تضيع الأصفار اليسرى (أكواد، موبايل، رقم قومي)
const TEXT_COLUMNS = ["Emp_ID", "National_ID_Last4", "Mobile", "Phone", "Book_ID", "Supplier_ID",
  "Phase_ID", "Res_ID", "Res_Item_ID", "Transaction_Ref", "Receipt_No", "Supplier_Invoice_No",
  "Document_Ref", "Reference_ID", "Reference_Doc_ID", "Printed_Receipt_No", "Party_ID", "Username",
  // التواريخ تُخزَّن كنص ثابت الصيغة حتى لا يحوّلها الشيت ويضيع جزء الملّي ثانية في ختم الأسبقية
  "Priority_Timestamp", "Priority_Timestamp_Applied", "Action_Timestamp", "Created_At", "Last_Modified_At",
  "Trans_Timestamp", "Trans_Date", "Payment_Date", "Frozen_At", "Issue_Date", "Due_Date", "Invoice_Date",
  "Start_DateTime", "End_DateTime", "Expense_Date", "Timestamp", "Closing_Date", "Approved_At", "Updated_At",
  "Last_Login", "Plan_Base_Date", "Order_Send_Date", "Expected_Supply_Date", "Delivery_Start_Date", "Closed_At"];

// ============================================================================
// القسم 1: أدوات عامة
// ============================================================================

const Util = {
  tz: function() { return Session.getScriptTimeZone() || "Africa/Cairo"; },
  now: function(fmt) { return Utilities.formatDate(new Date(), this.tz(), fmt || "yyyy-MM-dd HH:mm:ss"); },
  today: function() { return this.now("yyyy-MM-dd"); },
  nowPrecise: function() { return this.now("yyyy-MM-dd HH:mm:ss.SSS"); },
  /** تحويل أي قيمة تاريخ (نص أو Date من الشيت) إلى نص yyyy-MM-dd HH:mm:ss */
  dateStr: function(v, fmt) {
    if (v === "" || v === null || v === undefined) return "";
    if (Object.prototype.toString.call(v) === "[object Date]") {
      return Utilities.formatDate(v, this.tz(), fmt || "yyyy-MM-dd HH:mm:ss");
    }
    return String(v);
  },
  /** تحويل نص تاريخ إلى Date (يقبل yyyy-MM-dd و yyyy-MM-dd HH:mm[:ss]) */
  parseDate: function(v) {
    if (!v) return null;
    if (Object.prototype.toString.call(v) === "[object Date]") return v;
    const m = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  },
  bool: function(v) { return v === true || String(v).toUpperCase() === "TRUE"; },
  num: function(v) { const n = Number(v); return isNaN(n) ? 0 : n; },
  str: function(v) { return String(v === undefined || v === null ? "" : v).trim(); },
  actor: function(session) { return session ? (session.fullName || session.username || session.empId || "SYSTEM") : "SYSTEM"; },
  require: function(cond, msg) { if (!cond) throw new Error(msg); }
};

// ============================================================================
// القسم 2: مخطط الجداول (22 جدولاً) والتأسيس والترحيل
// ============================================================================

function getDatabaseSchemaDefinition_() {
  const S = SYSTEM_CONFIG.SHEETS;
  return [
    { name: S.SETTINGS, color: "#1e293b", headers: ["Setting_Key", "Setting_Value", "Data_Type", "Description", "Updated_At", "Updated_By"] },
    { name: S.USERS, color: "#334155", headers: ["User_ID", "Emp_ID", "Username", "Password_Hash", "Full_Name", "Role", "Is_Active", "Last_Login", "Password_Salt", "Must_Change_Password"] },
    { name: S.EMPLOYEES, color: "#0f766e", headers: ["Emp_ID", "Full_Name", "National_ID_Last4", "Mobile", "Department", "Job_Title", "Employment_Status", "Installment_Allowed", "Max_Credit_Limit", "Notes", "Updated_At"] },
    { name: S.SUPPLIERS, color: "#0369a1", headers: ["Supplier_ID", "Supplier_Name", "Contact_Person", "Phone", "Volume_Discount_Pct", "Return_Policy_Days", "Payment_Terms", "Contract_Notes", "Is_Active"] },
    { name: S.BOOKS, color: "#1d4ed8", headers: ["Book_ID", "Book_Name", "Stage", "Grade", "Subject", "Publisher", "Supplier_ID", "Cover_Price", "Supplier_Discount_Pct", "Initial_Purchase_Price", "Volume_Discount_Share_Pct", "Standard_Net_Cost", "Emp_Discount_Pct", "Emp_Selling_Price", "Book_Status", "School_Types", "Book_Part"] },
    { name: S.PHASES, color: "#4338ca", headers: ["Phase_ID", "Phase_Name", "Start_DateTime", "End_DateTime", "Order_Send_Date", "Expected_Supply_Date", "Delivery_Start_Date", "Allowed_Grades", "Phase_Status", "Manual_Override"] },
    { name: S.RES_HEADER, color: "#6d28d9", headers: ["Res_ID", "Phase_ID", "Emp_ID", "Created_At", "Last_Modified_At", "Payment_Method_Selected", "Down_Payment_Type", "Down_Payment_Input", "Calculated_Down_Payment", "Installment_Count", "Installment_Value", "Total_Cover_Value", "Total_Emp_Value", "Res_Status", "Invoice_Adjustment", "Adjustment_Reason", "Created_By"] },
    { name: S.RES_ITEMS, color: "#7e22ce", headers: ["Res_Item_ID", "Res_ID", "Phase_ID", "Emp_ID", "Book_ID", "Priority_Timestamp", "Requested_Qty", "Allocated_Qty", "Delivered_Qty", "Returned_Qty", "Net_Billable_Qty", "Unit_Cover_Price", "Unit_Emp_Price", "Total_Emp_Line_Amount", "Allocation_Status", "Unallocated_Reason", "Is_Manual_Exception", "Exception_By", "Exception_Reason", "Tranche_No", "Carried_From_Item_ID", "Beneficiary"] },
    { name: S.RES_AUDIT, color: "#9333ea", headers: ["Log_ID", "Res_ID", "Emp_ID", "Book_ID", "Action_Type", "Old_Qty", "New_Qty", "Priority_Timestamp_Applied", "Action_Timestamp", "Rule_Applied"] },
    { name: S.PO_SNAPSHOT, color: "#b45309", headers: ["PO_ID", "Phase_ID", "Supplier_ID", "Book_ID", "Total_Requested_Qty", "Carryover_Stock_Qty", "Net_Order_To_Supplier_Qty", "Frozen_At", "Frozen_By", "Pending_From_Previous_Qty", "Received_Qty_To_Date", "Outstanding_Qty", "Line_Status"] },
    { name: S.SUP_INV_HEADER, color: "#c2410c", headers: ["Sup_Inv_ID", "Internal_Ref_No", "Supplier_Invoice_No", "Supplier_ID", "Phase_ID", "Invoice_Date", "Gross_Total_Cover", "Total_After_Item_Discount", "Volume_Discount_Pct", "Volume_Discount_Amount", "Net_Payable_Amount", "Status", "Approved_By", "Approved_At", "Supplier_Stated_Net", "Variance_Amount", "Damaged_Claim_Amount"] },
    { name: S.SUP_INV_ITEMS, color: "#ea580c", headers: ["Sup_Inv_Item_ID", "Sup_Inv_ID", "Book_ID", "Ordered_Qty", "Received_Qty", "Variance_Qty", "Cover_Price_Invoiced", "Item_Discount_Pct_Invoiced", "Unit_Price_After_First_Disc", "Allocated_Volume_Disc_Per_Unit", "Actual_Unit_Net_Cost", "Total_Line_Net_Cost", "Matching_Flag", "Admin_Decision_Notes", "Damaged_Qty", "Price_Mismatch"] },
    { name: S.INVENTORY, color: "#15803d", headers: ["Trans_ID", "Trans_Timestamp", "Phase_ID", "Book_ID", "Batch_Ref_ID", "Movement_Type", "Qty_Change", "Unit_Actual_Cost", "Reference_Doc_ID", "Recorded_By", "Notes"] },
    { name: S.DELIVERY_RETURNS, color: "#16a34a", headers: ["Doc_ID", "Doc_Type", "Phase_ID", "Party_ID", "Trans_Date", "Book_ID", "Qty", "Unit_Price_Applied", "Total_Amount_Impact", "Return_Reason", "Handled_By", "Printed_Receipt_No", "Received_By", "Res_Item_ID"] },
    { name: S.EMP_INVOICES, color: "#0f766e", headers: ["Emp_Inv_ID", "Phase_ID", "Emp_ID", "Res_ID", "Issue_Date", "Total_Allocated_Amount", "Total_Delivered_Amount", "Total_Returns_Credit", "Net_Final_Invoice_Amount", "Down_Payment_Required", "Installments_Count", "Total_Paid_Amount", "Remaining_Balance", "Payment_Plan_Type", "Invoice_Status", "Total_Cover_Amount", "Total_Savings", "Plan_Base_Date", "Credit_Balance"] },
    { name: S.INSTALLMENTS, color: "#0d9488", headers: ["Inst_ID", "Emp_Inv_ID", "Emp_ID", "Installment_No", "Due_Date", "Scheduled_Amount", "Paid_Amount", "Remaining_Inst_Amount", "Status", "Admin_Custom_Notes"] },
    { name: S.EMP_PAYMENTS, color: "#059669", headers: ["Payment_ID", "Receipt_No", "Emp_ID", "Emp_Inv_ID", "Payment_Date", "Amount", "Payment_Method", "Transaction_Ref", "Collected_By", "Is_Voided", "Void_Reason", "Voided_By", "Payment_Type"] },
    { name: S.SUP_LEDGER, color: "#be123c", headers: ["Sup_Trans_ID", "Supplier_ID", "Phase_ID", "Trans_Date", "Trans_Type", "Reference_ID", "Debit_Amount", "Credit_Amount", "Payment_Channel", "Document_Ref", "Recorded_By", "Notes"] },
    { name: S.EXPENSES, color: "#9f1239", headers: ["Expense_ID", "Expense_Date", "Phase_ID", "Expense_Category", "Amount", "Beneficiary_Name", "Allocation_Method", "Receipt_Doc_No", "Recorded_By", "Notes"] },
    { name: S.AUDIT_TRAIL, color: "#475569", headers: ["Audit_ID", "Timestamp", "User_ID", "User_Role", "Module_Name", "Action_Performed", "Record_Primary_Key", "Before_State_JSON", "After_State_JSON"] },
    { name: S.COUNTERS, color: "#64748b", headers: ["Counter_Key", "Prefix", "Last_Value", "Updated_At"] },
    { name: S.CASH_CLOSINGS, color: "#0e7490", headers: ["Closing_ID", "Closing_Date", "Payment_Method", "System_Amount", "Counted_Amount", "Difference", "Receipts_Count", "Closed_By", "Closed_At", "Notes"] }
  ];
}

/** الجداول في Postgres (schema books) — لا يوجد تأسيس هنا */
function ensureDatabaseInitialized_() {}

// ============================================================================
// القسم 3: المحرك المالي
// ============================================================================

const FinancialEngine = {
  /** سعر الموظف: جبر لأعلى رقم صحيح (110.15 → 111 | 110.00 → 110) */
  roundUpEmployeePrice: function(rawPrice) {
    const num = Number(rawPrice);
    if (isNaN(num) || num <= 0) return 0;
    return Math.ceil(Math.round(num * 10000) / 10000);
  },

  /** تقريب محاسبي لأقرب قرش */
  roundCurrency: function(val) {
    const num = Number(val);
    if (isNaN(num)) return 0;
    return Math.round((num + (num >= 0 ? Number.EPSILON : -Number.EPSILON)) * 100) / 100;
  },

  /**
   * هيكل تكلفة وسعر الكتاب:
   * التكلفة = الغلاف × (1 − خصم الصنف) × (1 − خصم الكمية)  — خصم الكمية على صافي الفاتورة بعد خصم الأصناف
   * سعر الموظف = ⌈ الغلاف × (1 − خصم الموظف) ⌉
   */
  calculateBookPricing: function(coverPrice, supplierDiscPct, volumeDiscPct, empDiscPct) {
    const cover = Util.num(coverPrice);
    const supDisc = Util.num(supplierDiscPct) / 100;
    const volDisc = Util.num(volumeDiscPct) / 100;
    const empDisc = Util.num(empDiscPct) / 100;
    const initialPurchasePrice = this.roundCurrency(cover * (1 - supDisc));
    const volumeDiscountAmountPerUnit = this.roundCurrency(initialPurchasePrice * volDisc);
    const standardNetCost = this.roundCurrency(initialPurchasePrice - volumeDiscountAmountPerUnit);
    const empSellingPrice = this.roundUpEmployeePrice(cover * (1 - empDisc));
    return {
      coverPrice: this.roundCurrency(cover),
      supplierDiscountPct: Util.num(supplierDiscPct),
      initialPurchasePrice: initialPurchasePrice,
      volumeDiscountSharePct: Util.num(volumeDiscPct),
      volumeDiscountPerUnit: volumeDiscountAmountPerUnit,
      standardNetCost: standardNetCost,
      empDiscountPct: Util.num(empDiscPct),
      empSellingPrice: empSellingPrice,
      unitSurplusMargin: this.roundCurrency(empSellingPrice - standardNetCost)
    };
  },

  /**
   * خطة السداد: مقدم (نسبة أو مبلغ) + أقساط شهرية متساوية، والقسط الأخير يحمل فرق التقريب.
   * baseDate ثابت للفاتورة حتى لا تتحرك تواريخ الاستحقاق مع كل تحديث.
   */
  calculateInstallmentPlan: function(totalAmount, downPaymentType, downPaymentInput, installmentCount, baseDate) {
    const total = this.roundUpEmployeePrice(totalAmount);
    const count = Math.max(1, parseInt(installmentCount, 10) || 1);
    let downPayment;
    if (downPaymentType === "PERCENTAGE") {
      const pct = Math.min(100, Math.max(0, Util.num(downPaymentInput)));
      downPayment = this.roundUpEmployeePrice(total * pct / 100);
    } else {
      downPayment = this.roundUpEmployeePrice(Math.min(total, Math.max(0, Util.num(downPaymentInput))));
    }
    const remainingAfterDown = Math.max(0, total - downPayment);
    const base = Util.parseDate(baseDate) || new Date();
    const schedule = [];
    if (downPayment > 0) {
      schedule.push({ installmentNo: 0, label: "المقدم (عند الاستلام)", dueDate: Utilities.formatDate(base, Util.tz(), "yyyy-MM-dd"), amount: downPayment });
    }
    const baseInst = Math.floor(remainingAfterDown / count);
    let allocated = 0;
    for (let i = 1; i <= count; i++) {
      const amt = (i === count) ? (remainingAfterDown - allocated) : baseInst;
      allocated += amt;
      if (amt > 0) {
        const due = new Date(base.getFullYear(), base.getMonth() + i, 1);
        schedule.push({ installmentNo: i, label: "القسط رقم (" + i + ")", dueDate: Utilities.formatDate(due, Util.tz(), "yyyy-MM-dd"), amount: amt });
      }
    }
    return {
      totalInvoiceAmount: total,
      downPaymentType: downPaymentType,
      downPaymentAmount: downPayment,
      remainingToInstall: remainingAfterDown,
      installmentCount: count,
      averageInstallmentValue: Math.ceil(remainingAfterDown / count),
      schedule: schedule
    };
  }
};

// ============================================================================
// القسم 4: طبقة الوصول للبيانات مع ذاكرة مؤقتة لكل تنفيذ
// ============================================================================

// طبقة البيانات: تُستبدل دوالها كلها في engine.js بطبقة Postgres (books.records) داخل transaction
const DB_Engine = {
  clearCache: function() {},
  getAllRecords: function(sheetName) { throw new Error("DB_Engine غير مهيأ"); },
  insertRecordsBatch: function(sheetName, objectsArray) { throw new Error("DB_Engine غير مهيأ"); },
  updateRecordByPK: function(sheetName, pkField, pkValue, updatedFieldsObj) { throw new Error("DB_Engine غير مهيأ"); },
  overwriteTableData: function(sheetName, objectsArray) { throw new Error("DB_Engine غير مهيأ"); },
  executeWithLock: function(callbackFn) { return callbackFn(); },

  logAudit: function(userId, userRole, moduleName, action, recordPK, beforeObj, afterObj) {
    try {
      const strip = o => { if (!o) return ""; const c = Object.assign({}, o); delete c._rowIndex; delete c.Password_Hash; delete c.Password_Salt; return JSON.stringify(c).slice(0, 45000); };
      this.insertRecordsBatch(SYSTEM_CONFIG.SHEETS.AUDIT_TRAIL, [{
        Audit_ID: "AUD-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000),
        Timestamp: Util.now(),
        User_ID: String(userId || "SYSTEM"),
        User_Role: String(userRole || "SYSTEM"),
        Module_Name: moduleName,
        Action_Performed: action,
        Record_Primary_Key: String(recordPK),
        Before_State_JSON: strip(beforeObj),
        After_State_JSON: strip(afterObj)
      }]);
    } catch (err) {
      console.error("Audit Logging Failed:", err);
    }
  }
};

/** إعدادات المنظومة كقاموس مع تحويل الأنواع */
function getSettings_() {
  const out = {};
  DB_Engine.getAllRecords(SYSTEM_CONFIG.SHEETS.SETTINGS).forEach(r => {
    const t = String(r.Data_Type).toUpperCase();
    let v = r.Setting_Value;
    if (t === "NUMBER") v = Util.num(v);
    else if (t === "BOOLEAN") v = Util.bool(v);
    else v = String(v);
    out[r.Setting_Key] = v;
  });
  return out;
}

/**
 * ترقيم تسلسلي بلا فجوات لكل نوع مستند (إيصال، إذن تسليم، مرتجع...).
 * يُستدعى داخل القفل فقط.
 */
const Counter = {
  next: function(key, prefix) {
    const S = SYSTEM_CONFIG.SHEETS;
    const rows = DB_Engine.getAllRecords(S.COUNTERS);
    const row = rows.find(r => r.Counter_Key === key);
    const yr = Util.now("yyyy");
    let n;
    if (row) {
      n = Util.num(row.Last_Value) + 1;
      DB_Engine.updateRecordByPK(S.COUNTERS, "Counter_Key", key, { Last_Value: n, Updated_At: Util.now() });
    } else {
      n = 1;
      DB_Engine.insertRecordsBatch(S.COUNTERS, [{ Counter_Key: key, Prefix: prefix, Last_Value: n, Updated_At: Util.now() }]);
    }
    return prefix + "-" + yr + "-" + ("00000" + n).slice(-5);
  }
};

// ============================================================================
// القسم 5: المصادقة والصلاحيات
// ============================================================================

const AuthEngine = {
  hashPassword: function(password, salt) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + String(password), Utilities.Charset.UTF_8);
    return bytes.map(b => ("0" + ((b + 256) % 256).toString(16)).slice(-2)).join("");
  },

  newSalt: function() { return Utilities.getUuid().replace(/-/g, "").slice(0, 16); },

  normalizeMobile: function(mobileStr) {
    const arabic = "٠١٢٣٤٥٦٧٨٩";
    let s = String(mobileStr || "").replace(/[٠-٩]/g, d => String(arabic.indexOf(d)));
    let digits = s.replace(/\D/g, "");
    if (digits.startsWith("0020")) digits = digits.substring(2);
    if (digits.startsWith("20") && digits.length === 12) digits = "0" + digits.substring(2);
    else if (digits.length === 10 && digits.startsWith("1")) digits = "0" + digits;
    return digits;
  },

  throttleKey_: function(kind, id) { return "LOGINFAIL_" + kind + "_" + String(id).toLowerCase(); },

  checkThrottle_: function(kind, id) {
    const c = CacheService.getScriptCache().get(this.throttleKey_(kind, id));
    if (c && Number(c) >= SYSTEM_CONFIG.LOGIN_MAX_FAILS) {
      throw new Error("تم إيقاف الدخول مؤقتاً بسبب تكرار المحاولات الخاطئة. حاول بعد 15 دقيقة.");
    }
  },

  registerFail_: function(kind, id) {
    const cache = CacheService.getScriptCache();
    const k = this.throttleKey_(kind, id);
    const c = Number(cache.get(k) || 0) + 1;
    cache.put(k, String(c), SYSTEM_CONFIG.LOGIN_LOCK_SEC);
  },

  clearFails_: function(kind, id) { CacheService.getScriptCache().remove(this.throttleKey_(kind, id)); },

  /** دخول الموظف: الرقم الوظيفي + آخر 4 أرقام من الرقم القومي + الموبايل */
  authenticateEmployee: function(empIdInput, natIdLast4Input, mobileInput) {
    const empId = Util.str(empIdInput);
    const nat4 = Util.str(natIdLast4Input).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
    const mobile = this.normalizeMobile(mobileInput);
    if (!empId || nat4.length !== 4 || !mobile) {
      return { success: false, message: "أدخل الرقم الوظيفي، وآخر 4 أرقام من الرقم القومي، ورقم الموبايل بشكل صحيح." };
    }
    this.checkThrottle_("EMP", empId);
    const emp = DB_Engine.getAllRecords(SYSTEM_CONFIG.SHEETS.EMPLOYEES).find(e => Util.str(e.Emp_ID) === empId);
    const ok = emp && Util.str(emp.National_ID_Last4).padStart(4, "0") === nat4.padStart(4, "0") && this.normalizeMobile(emp.Mobile) === mobile;
    if (!ok) {
      this.registerFail_("EMP", empId);
      return { success: false, message: "البيانات غير مطابقة للسجلات." };
    }
    if (Util.str(emp.Employment_Status) !== "ساري") {
      return { success: false, message: "هذا الحساب موقوف. يرجى مراجعة إدارة المبادرة." };
    }
    this.clearFails_("EMP", empId);
    const user = {
      userType: "EMPLOYEE", empId: empId, fullName: emp.Full_Name, department: emp.Department,
      jobTitle: emp.Job_Title, mobile: this.normalizeMobile(emp.Mobile),
      installmentAllowed: emp.Installment_Allowed === "" ? true : Util.bool(emp.Installment_Allowed),
      maxCreditLimit: Util.num(emp.Max_Credit_Limit), role: "Employee"
    };
    return { success: true, sessionToken: this.createSessionToken_(user), user: user };
  },

  /** دخول المسؤولين بكلمة مرور مشفرة (SHA-256 + Salt) */
  authenticateAdmin: function(usernameInput, passwordInput) {
    const uname = Util.str(usernameInput).toLowerCase();
    const pass = String(passwordInput || "");
    if (!uname || !pass) return { success: false, message: "أدخل اسم المستخدم وكلمة المرور." };
    this.checkThrottle_("ADM", uname);
    const S = SYSTEM_CONFIG.SHEETS;
    const u = DB_Engine.getAllRecords(S.USERS).find(x => Util.str(x.Username).toLowerCase() === uname);
    let ok = false;
    if (u && Util.bool(u.Is_Active)) {
      if (u.Password_Salt) ok = this.hashPassword(pass, u.Password_Salt) === Util.str(u.Password_Hash);
      else ok = Util.str(u.Password_Hash) === pass; // نسخة قديمة بكلمة مرور غير مشفرة
    }
    if (!ok) {
      this.registerFail_("ADM", uname);
      return { success: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة، أو الحساب غير نشط." };
    }
    this.clearFails_("ADM", uname);
    const upd = { Last_Login: Util.now() };
    if (!u.Password_Salt) { // ترقية تلقائية للتشفير
      const salt = this.newSalt();
      upd.Password_Salt = salt;
      upd.Password_Hash = this.hashPassword(pass, salt);
      upd.Must_Change_Password = true;
    }
    DB_Engine.updateRecordByPK(S.USERS, "User_ID", u.User_ID, upd);
    const payload = {
      userType: "ADMIN", userId: u.User_ID, empId: Util.str(u.Emp_ID), username: u.Username,
      fullName: u.Full_Name, role: u.Role,
      mustChangePassword: Util.bool(upd.Must_Change_Password !== undefined ? upd.Must_Change_Password : u.Must_Change_Password)
    };
    return { success: true, sessionToken: this.createSessionToken_(payload), user: payload };
  },

  changePassword: function(session, oldPass, newPass) {
    Util.require(session.userType === "ADMIN", "تغيير كلمة المرور متاح لحسابات الإدارة فقط.");
    Util.require(String(newPass || "").length >= 8, "كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.");
    const S = SYSTEM_CONFIG.SHEETS;
    const u = DB_Engine.getAllRecords(S.USERS).find(x => x.User_ID === session.userId);
    Util.require(u, "المستخدم غير موجود.");
    const okOld = u.Password_Salt ? this.hashPassword(oldPass, u.Password_Salt) === Util.str(u.Password_Hash) : Util.str(u.Password_Hash) === String(oldPass);
    Util.require(okOld, "كلمة المرور الحالية غير صحيحة.");
    const salt = this.newSalt();
    DB_Engine.updateRecordByPK(S.USERS, "User_ID", u.User_ID, { Password_Salt: salt, Password_Hash: this.hashPassword(newPass, salt), Must_Change_Password: false });
    DB_Engine.logAudit(session.userId, session.role, "Auth", "CHANGE_PASSWORD", u.User_ID, null, null);
    return { success: true, message: "تم تغيير كلمة المرور بنجاح." };
  },

  createSessionToken_: function(payload) {
    const token = "TKN_" + Utilities.getUuid().replace(/-/g, "");
    CacheService.getScriptCache().put(token, JSON.stringify(payload), SYSTEM_CONFIG.SESSION_TTL_SEC);
    return token;
  },

  destroySession: function(token) { if (token) CacheService.getScriptCache().remove(token); },

  verifySession: function(token, allowedRoles) {
    if (!token) throw new Error("جلسة العمل منتهية، يرجى إعادة تسجيل الدخول.");
    const raw = CacheService.getScriptCache().get(token);
    if (!raw) throw new Error("انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى.");
    const session = JSON.parse(raw);
    if (allowedRoles && allowedRoles.length && session.role !== "Admin" && allowedRoles.indexOf(session.role) === -1) {
      throw new Error("ليس لديك صلاحية لهذه العملية. الدور المطلوب: " + allowedRoles.join(" أو "));
    }
    return session;
  }
};

// ============================================================================
// القسم 6: البيانات الأولية (تُزرع مرة واحدة إذا كانت الجداول فارغة)
// ============================================================================

function seedInitialData_() {
  const S = SYSTEM_CONFIG.SHEETS;
  const nowStr = Util.now();

  if (DB_Engine.getAllRecords(S.SETTINGS).length === 0) {
    const st = (k, v, t, d) => ({ Setting_Key: k, Setting_Value: v, Data_Type: t, Description: d, Updated_At: nowStr, Updated_By: "SYSTEM" });
    DB_Engine.insertRecordsBatch(S.SETTINGS, [
      st("INITIATIVE_TITLE", "مبادرة الكتب الخارجية المدرسية للعاملين", "STRING", "اسم المبادرة في الفواتير والتقارير"),
      st("UNIFIED_EMP_DISCOUNT_PCT", 18, "NUMBER", "نسبة الخصم الموحدة للموظف على جميع الكتب (%)"),
      st("DEFAULT_INSTALLMENT_COUNT", 2, "NUMBER", "عدد الأقساط الافتراضي بعد المقدم"),
      st("MAX_INSTALLMENT_COUNT", 4, "NUMBER", "أقصى عدد أقساط يختاره الموظف"),
      st("MIN_DOWN_PAYMENT_PCT", 20, "NUMBER", "الحد الأدنى للمقدم عند التقسيط (%)"),
      st("MAX_QTY_PER_BOOK", 3, "NUMBER", "أقصى عدد نسخ من الكتاب الواحد للموظف في المرحلة"),
      st("ORG_NAME", "النقابة العامة بالدقهلية", "STRING", "اسم الجهة في الشاشات والمستندات"),
      st("PLATFORM_NAME", "منصة حجز الكتب المخفضة", "STRING", "اسم المنصة"),
      st("CREDIT_LINE", "إعداد وتنفيذ الأستاذ محمود العراقي", "STRING", "سطر الإعداد والتنفيذ"),
      st("CONTACT_PHONE", "015501000025", "STRING", "هاتف التواصل مع المسؤول (اتصال)"),
      st("CONTACT_WHATSAPP", "015501000025", "STRING", "رقم واتساب المسؤول"),
      st("CONTACT_EMAIL", "", "STRING", "البريد الإلكتروني للمسؤول"),
      st("ALLOW_RELATIVE_BOOKING", true, "BOOLEAN", "السماح للعضو بالحجز لأقاربه (تُحسب على العضو نفسه)"),
      st("MAX_RELATIVES", 5, "NUMBER", "أقصى عدد أقارب يحجز لهم العضو في المرحلة"),
      st("DEFAULT_CREDIT_LIMIT", 15000, "NUMBER", "الحد الائتماني الافتراضي للموظف (ج.م) إذا لم يُحدَّد له حد"),
      st("REQUIRE_DOWN_PAYMENT_BEFORE_DELIVERY", true, "BOOLEAN", "منع التسليم قبل سداد المقدم (أو كامل القيمة للدفع الكامل)"),
      st("BLOCK_DELIVERY_IF_OVERDUE", true, "BOOLEAN", "منع التسليم لمن عليه أقساط متأخرة من مراحل سابقة"),
      st("EMP_RETURN_WINDOW_DAYS", 7, "NUMBER", "مدة قبول مرتجع الموظف بعد الاستلام (يوم)"),
      st("CASH_ACCOUNT_HOLDER", "محمود العراقي", "STRING", "اسم صاحب المحفظة وحساب إنستاباي"),
      st("DEFICIT_BEARER", "أمين الصندوق", "STRING", "الجهة التي تتحمل العجز ويؤول إليها الفائض"),
      st("ROUNDING_POLICY", "CEIL_INTEGER", "STRING", "جبر سعر الموظف لأقرب رقم صحيح أعلى"),
      st("BOOK_PUBLISHERS", "الأبرار،الأستاذ،الأضواء،الإبداع،الامتحان،الباهر،البيان،التأسيس السليم،التفوق،الشاطر،الفايز،المرشد،المعاصر،المعلم،الموسوعة،الميسر،النفيس،الوافي،الوسام،برافو،بوني،بيت باي بيت،ترافيللر،جيم،جينيال،ستار،ستيب أهيد،سلاح التلميذ،سندباد،قطر الندى،كيان،لافي أليكس،لو اكسلانس،ماي دريم،مندليف،ميرسي،نور البيان،نيوتن", "STRING", "قائمة الناشرين في نموذج الكتاب (مفصولة بفاصلة)"),
      st("BOOK_SUBJECTS", "عربي،نحو،نحو وصرف،بلاغة،إنجليزي،فرنساوي،ألماني،رياضيات،ماث،رياضيات بحتة،رياضيات تطبيقية،رياضيات أدبي،إحصاء،علوم،ساينس،علوم متكاملة،فيزياء،كيمياء،أحياء،دراسات،تاريخ،جغرافيا،فلسفة ومنطق،علم نفس،دين،فقه شافعي،تفسير،حديث،توحيد،أصول دين،حاسب آلي،أي سي تي،تكنولوجيا،ديسكفري،مهارات", "STRING", "قائمة المواد في نموذج الكتاب (مفصولة بفاصلة)"),
      st("BOOK_PARTS", "شرح،أسئلة،تدريبات،بلاس،جرامر،مستوى رفيع،أوليف", "STRING", "أجزاء الكتاب: شرح، أسئلة، تدريبات... (مفصولة بفاصلة)")
    ]);
  }

  if (DB_Engine.getAllRecords(S.USERS).length === 0) {
    const mk = (id, empId, uname, pass, name, role) => {
      const salt = AuthEngine.newSalt();
      return { User_ID: id, Emp_ID: empId, Username: uname, Password_Hash: AuthEngine.hashPassword(pass, salt), Password_Salt: salt, Full_Name: name, Role: role, Is_Active: true, Last_Login: "", Must_Change_Password: true };
    };
    DB_Engine.insertRecordsBatch(S.USERS, [
      mk("USR-01", "", "admin", "Admin@2026", "مدير المنظومة", "Admin"),
      mk("USR-02", "", "coord", "Coord@2026", "مسؤول المبادرة والحجوزات", "Coordinator"),
      mk("USR-03", "", "finance", "Finance@2026", "أمين الصندوق", "Finance"),
      mk("USR-04", "", "store", "Store@2026", "أمين المخزن والتسليم", "Warehouse")
    ]);
  }

  if (DB_Engine.getAllRecords(S.EMPLOYEES).length === 0) {
    const e = (id, n, nat, mob, dep, job, lim) => ({ Emp_ID: id, Full_Name: n, National_ID_Last4: nat, Mobile: mob, Department: dep, Job_Title: job, Employment_Status: "ساري", Installment_Allowed: true, Max_Credit_Limit: lim, Notes: "بيانات تجريبية", Updated_At: nowStr });
    DB_Engine.insertRecordsBatch(S.EMPLOYEES, [
      e("1001", "أحمد محمد عبد الرحمن", "4512", "01012345678", "تكنولوجيا المعلومات", "مهندس نظم", 10000),
      e("1002", "سارة محمود إبراهيم", "8834", "01122334455", "الموارد البشرية", "أخصائي أول", 10000),
      e("1003", "خالد حسن الشافعي", "0921", "01233445566", "الإدارة المالية", "محاسب", 12000)
    ]);
  }

  if (DB_Engine.getAllRecords(S.SUPPLIERS).length === 0) {
    DB_Engine.insertRecordsBatch(S.SUPPLIERS, [
      { Supplier_ID: "SUP-01", Supplier_Name: "مكتبة النور (تجريبي)", Contact_Person: "أ. محمود فوزي", Phone: "01099887766", Volume_Discount_Pct: 5, Return_Policy_Days: 30, Payment_Terms: "دفعات تحت الحساب والتصفية نهاية الموسم", Contract_Notes: "خصم كمية 5% على صافي الفاتورة بعد خصم الأصناف", Is_Active: true }
    ]);
  }

  if (DB_Engine.getAllRecords(S.BOOKS).length === 0) {
    const sample = [
      ["BK-101", "سلاح التلميذ - اللغة العربية", "المرحلة الابتدائية", "الصف الرابع الابتدائي", "اللغة العربية", "سلاح التلميذ", 135, 20],
      ["BK-102", "المعاصر - الرياضيات", "المرحلة الابتدائية", "الصف الرابع الابتدائي", "الرياضيات", "المعاصر", 165, 21],
      ["BK-201", "الامتحان - العلوم", "المرحلة الإعدادية", "الصف الثالث الإعدادي", "العلوم", "الامتحان", 150, 20],
      ["BK-202", "Bit by Bit - اللغة الإنجليزية", "المرحلة الإعدادية", "الصف الثالث الإعدادي", "اللغة الإنجليزية", "نيو جينيريشن", 140, 15],
      ["BK-301", "المعاصر - اللغة الإنجليزية", "المرحلة الثانوية", "الصف الثالث الثانوي", "اللغة الإنجليزية", "المعاصر", 250, 20],
      ["BK-302", "الامتحان - الفيزياء", "المرحلة الثانوية", "الصف الثالث الثانوي", "الفيزياء", "الامتحان", 280, 21]
    ];
    DB_Engine.insertRecordsBatch(S.BOOKS, sample.map(b => {
      const p = FinancialEngine.calculateBookPricing(b[6], b[7], 5, 18);
      return { Book_ID: b[0], Book_Name: b[1], Stage: b[2], Grade: b[3], Subject: b[4], Publisher: b[5], Supplier_ID: "SUP-01",
        Cover_Price: p.coverPrice, Supplier_Discount_Pct: p.supplierDiscountPct, Initial_Purchase_Price: p.initialPurchasePrice,
        Volume_Discount_Share_Pct: p.volumeDiscountSharePct, Standard_Net_Cost: p.standardNetCost, Emp_Discount_Pct: p.empDiscountPct,
        Emp_Selling_Price: p.empSellingPrice, Book_Status: "Available" };
    }));
  }

  if (DB_Engine.getAllRecords(S.PHASES).length === 0) {
    DB_Engine.insertRecordsBatch(S.PHASES, [{
      Phase_ID: "PH-01", Phase_Name: "المرحلة الأولى", Start_DateTime: "2026-11-01 08:00:00", End_DateTime: "2026-12-31 23:59:59",
      Order_Send_Date: "", Expected_Supply_Date: "", Delivery_Start_Date: "", Allowed_Grades: "ALL", Phase_Status: "Open", Manual_Override: false
    }]);
  }
}

/**
 * ============================================================================
 * منظومة إدارة مبادرة الكتب الخارجية المدرسية بالتخفيض والتقسيط
 * الملف 2 من 3: محركات العمليات — الحجز بشرائح الأسبقية، الحصر وطلب التوريد،
 * فواتير المكتبة والجرد، التوزيع، التسليم والمرتجعات، التحصيل والأقساط،
 * حسابات المكتبة والمصروفات، الإقفال اليومي، والتصفية النهائية.
 * الإصدار 2.0
 * ============================================================================
 */

// ============================================================================
// القسم 1: نقطة الاتصال الموحدة مع الواجهة
// ============================================================================

const ADMIN_ROLES = ["Admin", "Coordinator", "Finance", "Warehouse"];

// الصلاحيات لكل عملية. "EMPLOYEE" = بوابة الموظف فقط.
const ACTION_ACL = {
  GET_EMPLOYEE_PORTAL_DATA: ["EMPLOYEE"],
  SUBMIT_OR_UPDATE_RESERVATION: ["EMPLOYEE", "Coordinator"],
  CHANGE_PASSWORD: ADMIN_ROLES,
  GET_ADMIN_DASHBOARD_DATA: ADMIN_ROLES,
  GET_SETTLEMENT_REPORT: ADMIN_ROLES,
  SAVE_SETTING: ["Admin"],
  SAVE_SUPPLIER: ["Coordinator"],
  SAVE_BOOK: ["Coordinator"],
  BULK_IMPORT_BOOKS: ["Coordinator"],
  BULK_PRICE_BOOKS: ["Coordinator"],
  BULK_IMPORT_EMPLOYEES: ["Coordinator"],
  SAVE_PHASE: ["Coordinator"],
  SET_PHASE_STATUS: ["Coordinator"],
  GENERATE_PO_SNAPSHOT: ["Coordinator"],
  CANCEL_PO_BACKORDER: ["Coordinator"],
  SUBMIT_SUPPLIER_INVOICE: ["Coordinator", "Warehouse"],
  RUN_ALLOCATION_ENGINE: ["Coordinator", "Warehouse"],
  MANUAL_ALLOCATION_OVERRIDE: ["Coordinator"],
  CARRY_WAITLIST_TO_PHASE: ["Coordinator"],
  EXECUTE_BOOK_DELIVERY: ["Warehouse", "Coordinator"],
  CANCEL_UNDELIVERED_QTY: ["Warehouse", "Coordinator"],
  RECORD_BOOK_RETURN: ["Warehouse", "Coordinator"],
  RECORD_STOCK_ADJUSTMENT: ["Warehouse"],
  RECORD_EMPLOYEE_PAYMENT: ["Finance"],
  VOID_EMPLOYEE_PAYMENT: [],          // المدير فقط
  REFUND_EMPLOYEE_CREDIT: ["Finance"],
  CUSTOMIZE_EMP_INSTALLMENTS: ["Finance"],
  ADJUST_EMP_INVOICE: ["Finance"],
  DELETE_EMP_INVOICE: [],             // المدير فقط
  RECORD_SUPPLIER_PAYMENT: ["Finance"],
  RECORD_INITIATIVE_EXPENSE: ["Finance"],
  CLOSE_CASH_DAY: ["Finance"],
  SAVE_ROLE_PERMISSIONS: [],          // المدير فقط
  GET_AUDIT_LOG: ["Coordinator"],
  POST_ANNOUNCEMENT: ["Coordinator"]
};

// صلاحيات قابلة للتخصيص من المدير (إعداد ROLE_PERMISSIONS = JSON {action: [roles]})
// هذه العمليات ثابتة لا تُخصَّص: القراءة، كلمة المرور، الإعدادات، الصلاحيات نفسها.
const FIXED_ACL = ["GET_EMPLOYEE_PORTAL_DATA", "CHANGE_PASSWORD", "GET_ADMIN_DASHBOARD_DATA", "GET_SETTLEMENT_REPORT", "SAVE_SETTING", "SAVE_ROLE_PERMISSIONS"];
const CUSTOM_ROLES = ["Coordinator", "Finance", "Warehouse"];
function effectiveAcl_() {
  let ov = {};
  try { const row = DB_Engine.getAllRecords(SYSTEM_CONFIG.SHEETS.SETTINGS).find(r => r.Setting_Key === "ROLE_PERMISSIONS"); if (row && row.Setting_Value) ov = JSON.parse(String(row.Setting_Value)); } catch (e) { ov = {}; }
  const out = {};
  Object.keys(ACTION_ACL).forEach(a => {
    let roles = ACTION_ACL[a].slice();
    if (FIXED_ACL.indexOf(a) === -1 && Array.isArray(ov[a])) roles = roles.filter(r => r === "EMPLOYEE").concat(ov[a].filter(r => CUSTOM_ROLES.indexOf(r) !== -1));
    out[a] = roles;
  });
  return out;
}

/** نقطة تنفيذ العمليات: تستدعيها books-api لكل طلب {action, payload, token} */
function callServerApi(action, payload, sessionToken) {
  payload = payload || {};
  try {
    ensureDatabaseInitialized_();
    DB_Engine.clearCache();
    if (action === "LOGIN_EMPLOYEE") return AuthEngine.authenticateEmployee(payload.empId, payload.natIdLast4, payload.mobile);
    if (action === "LOGIN_ADMIN") return AuthEngine.authenticateAdmin(payload.username, payload.password);
    if (action === "LOGOUT") { AuthEngine.destroySession(sessionToken); return { success: true }; }
    if (action === "GET_PUBLIC_INIT_DATA") return OperationsEngine.getPublicInitData();

    const acl = ACTION_ACL[action] && effectiveAcl_()[action];
    if (!acl) throw new Error("العملية المطلوبة غير معروفة: " + action);
    const session = AuthEngine.verifySession(sessionToken);
    const isEmp = session.userType === "EMPLOYEE";
    if (isEmp && acl.indexOf("EMPLOYEE") === -1) throw new Error("هذه العملية غير متاحة من بوابة الموظف.");
    if (!isEmp && session.role !== "Admin" && acl.indexOf(session.role) === -1) {
      throw new Error("ليس لديك صلاحية لهذه العملية.");
    }

    const E = OperationsEngine;
    switch (action) {
      case "GET_EMPLOYEE_PORTAL_DATA": return E.getEmployeePortalData(session.empId, payload.phaseId);
      case "SUBMIT_OR_UPDATE_RESERVATION": return E.saveEmployeeReservation(session, payload);
      case "CHANGE_PASSWORD": return AuthEngine.changePassword(session, payload.oldPassword, payload.newPassword);
      case "GET_ADMIN_DASHBOARD_DATA": return E.getAdminDashboardFullData();
      case "GET_SETTLEMENT_REPORT": return E.getSettlementReport();
      case "SAVE_SETTING": return E.saveSetting(session, payload);
      case "SAVE_ROLE_PERMISSIONS": return E.saveRolePermissions(session, payload);
      case "GET_AUDIT_LOG": return E.getAuditLog(payload);
      case "POST_ANNOUNCEMENT": return E.postAnnouncement(session, payload);
      case "SAVE_SUPPLIER": return E.saveSupplier(session, payload);
      case "SAVE_BOOK": return E.saveBook(session, payload);
      case "BULK_PRICE_BOOKS": return E.bulkPriceBooks(session, payload);
      case "ADJUST_EMP_INVOICE": return E.adjustEmployeeInvoice(session, payload);
      case "DELETE_EMP_INVOICE": return E.deleteEmployeeInvoice(session, payload);
      case "BULK_IMPORT_BOOKS": return E.bulkImportBooks(session, payload.booksArray || []);
      case "BULK_IMPORT_EMPLOYEES": return E.bulkImportEmployees(session, payload.employeesArray || []);
      case "SAVE_PHASE": return E.savePhase(session, payload);
      case "SET_PHASE_STATUS": return E.setPhaseStatus(session, payload);
      case "GENERATE_PO_SNAPSHOT": return E.generatePurchaseOrderSnapshot(session, payload.phaseId);
      case "CANCEL_PO_BACKORDER": return E.cancelPoBackorder(session, payload);
      case "SUBMIT_SUPPLIER_INVOICE": return E.recordSupplierInvoiceAndStock(session, payload);
      case "RUN_ALLOCATION_ENGINE": return E.runAutoAllocationEngine(session, payload.phaseId);
      case "MANUAL_ALLOCATION_OVERRIDE": return E.manualAllocationOverride(session, payload);
      case "CARRY_WAITLIST_TO_PHASE": return E.carryWaitlistToPhase(session, payload);
      case "EXECUTE_BOOK_DELIVERY": return E.executeEmployeeDelivery(session, payload);
      case "CANCEL_UNDELIVERED_QTY": return E.cancelUndeliveredQty(session, payload);
      case "RECORD_BOOK_RETURN": return E.recordBookReturn(session, payload);
      case "RECORD_STOCK_ADJUSTMENT": return E.recordStockAdjustment(session, payload);
      case "RECORD_EMPLOYEE_PAYMENT": return E.recordEmployeePayment(session, payload);
      case "VOID_EMPLOYEE_PAYMENT": return E.voidEmployeePayment(session, payload);
      case "REFUND_EMPLOYEE_CREDIT": return E.refundEmployeeCredit(session, payload);
      case "CUSTOMIZE_EMP_INSTALLMENTS": return E.customizeEmployeeInstallments(session, payload);
      case "RECORD_SUPPLIER_PAYMENT": return E.recordSupplierPayment(session, payload);
      case "RECORD_INITIATIVE_EXPENSE": return E.recordInitiativeExpense(session, payload);
      case "CLOSE_CASH_DAY": return E.closeCashDay(session, payload);
    }
    throw new Error("العملية غير مدعومة: " + action);
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

// ============================================================================
// القسم 2: محرك العمليات
// ============================================================================

const OperationsEngine = {

  // --------------------------------------------------------------------------
  // أدوات مساعدة مشتركة
  // --------------------------------------------------------------------------

  S: function() { return SYSTEM_CONFIG.SHEETS; },

  getPhase_: function(phaseId) {
    const p = DB_Engine.getAllRecords(this.S().PHASES).find(x => Util.str(x.Phase_ID) === Util.str(phaseId));
    Util.require(p, "المرحلة غير موجودة: " + phaseId);
    return p;
  },

  /** هل الحجز مفتوح الآن؟ (الحالة Open وداخل نافذة التاريخ، أو تجاوز يدوي) */
  isBookingOpen_: function(phase) {
    if (Util.bool(phase.Manual_Override)) return true;
    if (phase.Phase_Status !== "Open") return false;
    const now = new Date();
    const st = Util.parseDate(phase.Start_DateTime), en = Util.parseDate(phase.End_DateTime);
    if (st && now < st) return false;
    if (en && now > en) return false;
    return true;
  },

  /** حالة المرحلة كما تُعرض: المرحلة المفتوحة التي انتهى موعدها تُعرض مغلقة */
  effectiveStatus_: function(phase) {
    if (phase.Phase_Status === "Open" && !this.isBookingOpen_(phase)) {
      const st = Util.parseDate(phase.Start_DateTime);
      return (st && new Date() < st) ? "Scheduled" : "Closed";
    }
    return phase.Phase_Status;
  },

  isCancelledItem_: function(i) { return String(i.Allocation_Status).indexOf("Cancelled") === 0 || String(i.Allocation_Status) === "Carried_Forward"; },

  /**
   * لقطة المخزون لكل كتاب:
   * onHand = مجموع حركات الدفتر · reserved = مخصص لم يُسلَّم بعد (كل المراحل) · free = onHand − reserved
   * avgCost = متوسط مرجح لتكلفة الوارد (توريد + رصيد افتتاحي)
   */
  getStockSnapshot_: function(resItems) {
    const ledger = DB_Engine.getAllRecords(this.S().INVENTORY);
    const items = resItems || DB_Engine.getAllRecords(this.S().RES_ITEMS);
    const m = {};
    const get = b => (m[b] = m[b] || { onHand: 0, reserved: 0, free: 0, inQty: 0, inCost: 0, avgCost: 0 });
    ledger.forEach(r => {
      const x = get(Util.str(r.Book_ID));
      const q = Util.num(r.Qty_Change);
      x.onHand += q;
      if (["IN_SUPPLY", "OPENING_CARRYOVER"].indexOf(String(r.Movement_Type)) !== -1 && q > 0) {
        x.inQty += q; x.inCost += q * Util.num(r.Unit_Actual_Cost);
      }
    });
    items.forEach(i => {
      if (this.isCancelledItem_(i)) return;
      get(Util.str(i.Book_ID)).reserved += Math.max(0, Util.num(i.Allocated_Qty) - Util.num(i.Delivered_Qty));
    });
    Object.keys(m).forEach(b => {
      const x = m[b];
      x.avgCost = x.inQty > 0 ? FinancialEngine.roundCurrency(x.inCost / x.inQty) : 0;
      x.free = x.onHand - x.reserved;
      x.totalQty = x.onHand;      // توافق مع الواجهة القديمة
      x.unitCost = x.avgCost;
    });
    return m;
  },

  bookCost_: function(snap, bookId) {
    if (snap[bookId] && snap[bookId].avgCost) return snap[bookId].avgCost;
    const b = DB_Engine.getAllRecords(this.S().BOOKS).find(x => Util.str(x.Book_ID) === bookId);
    return b ? Util.num(b.Standard_Net_Cost) : 0;
  },

  /** الأقساط المتأخرة على موظف (كل المراحل) */
  overdueForEmployee_: function(empId, exceptInvId) {
    const today = Util.today();
    return DB_Engine.getAllRecords(this.S().INSTALLMENTS)
      .filter(i => Util.str(i.Emp_ID) === empId && Util.str(i.Emp_Inv_ID) !== Util.str(exceptInvId) && Util.num(i.Remaining_Inst_Amount) > 0 && Util.str(i.Due_Date) < today)
      .reduce((s, i) => s + Util.num(i.Remaining_Inst_Amount), 0);
  },

  inventoryRow_: function(session, phaseId, bookId, type, qty, cost, ref, notes) {
    return {
      Trans_ID: "TRN-" + new Date().getTime() + "-" + Math.floor(Math.random() * 10000),
      Trans_Timestamp: Util.now(), Phase_ID: phaseId, Book_ID: bookId, Batch_Ref_ID: phaseId,
      Movement_Type: type, Qty_Change: qty, Unit_Actual_Cost: cost, Reference_Doc_ID: ref,
      Recorded_By: Util.actor(session), Notes: notes || ""
    };
  },

  // --------------------------------------------------------------------------
  // بيانات الشاشات
  // --------------------------------------------------------------------------

  getPublicInitData: function() {
    const st = getSettings_();
    return { success: true, settings: { INITIATIVE_TITLE: st.INITIATIVE_TITLE, UNIFIED_EMP_DISCOUNT_PCT: st.UNIFIED_EMP_DISCOUNT_PCT }, brand: this.brand_(st), version: SYSTEM_CONFIG.VERSION };
  },
  /** هوية المنصة وبيانات التواصل (تُعدَّل من الإعدادات) */
  brand_: function(st) {
    st = st || getSettings_();
    return { org: st.ORG_NAME || "النقابة العامة بالدقهلية", platform: st.PLATFORM_NAME || st.INITIATIVE_TITLE || "منصة حجز الكتب المخفضة",
      credit: st.CREDIT_LINE || "", phone: st.CONTACT_PHONE || "", whatsapp: st.CONTACT_WHATSAPP || st.CONTACT_PHONE || "", email: st.CONTACT_EMAIL || "" };
  },
  /** الإعلانات السارية (من إعداد ANNOUNCEMENTS بصيغة JSON) */
  announcements_: function() {
    const row = DB_Engine.getAllRecords(this.S().SETTINGS).find(r => r.Setting_Key === "ANNOUNCEMENTS");
    try { return row && row.Setting_Value ? JSON.parse(String(row.Setting_Value)) : []; } catch (e) { return []; }
  },
  /** إضافة أو حذف إعلان للموظفين: {op:"add", title, body, tone, until} أو {op:"delete", id} */
  postAnnouncement: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S(); let list = this.announcements_();
      if (payload.op === "delete") list = list.filter(a => a.id !== Util.str(payload.id));
      else {
        const title = Util.str(payload.title); Util.require(title, "اكتب عنوان الإعلان.");
        list.unshift({ id: "ANN-" + new Date().getTime(), title: title.slice(0, 120), body: Util.str(payload.body).slice(0, 600), tone: ["info", "success", "warning"].indexOf(payload.tone) !== -1 ? payload.tone : "info",
          until: Util.str(payload.until), phaseId: Util.str(payload.phaseId), at: Util.now(), by: Util.actor(session) });
        list = list.slice(0, 20);
      }
      const val = JSON.stringify(list), row = DB_Engine.getAllRecords(S.SETTINGS).find(r => r.Setting_Key === "ANNOUNCEMENTS");
      const rec = { Setting_Key: "ANNOUNCEMENTS", Setting_Value: val, Data_Type: "JSON", Description: "إعلانات للموظفين (تُدار من لوحة القيادة)", Updated_At: Util.now(), Updated_By: Util.actor(session) };
      if (row) DB_Engine.updateRecordByPK(S.SETTINGS, "Setting_Key", "ANNOUNCEMENTS", rec); else DB_Engine.insertRecordsBatch(S.SETTINGS, [rec]);
      DB_Engine.logAudit(session.userId, session.role, "Settings", payload.op === "delete" ? "DELETE_ANNOUNCEMENT" : "POST_ANNOUNCEMENT", payload.id || "-", null, payload);
      return { success: true, message: payload.op === "delete" ? "تم حذف الإعلان." : "تم نشر الإعلان للموظفين." };
    });
  },

  getEmployeePortalData: function(empId, phaseId) {
    const S = this.S();
    const phases = DB_Engine.getAllRecords(S.PHASES).filter(p => p.Phase_Status !== "Draft")
      .map(p => Object.assign(p, { Effective_Status: this.effectiveStatus_(p), Booking_Open: this.isBookingOpen_(p) }));
    const active = (phaseId && phases.find(p => Util.str(p.Phase_ID) === Util.str(phaseId)))
      || phases.find(p => p.Booking_Open) || phases[phases.length - 1] || null;
    const resItems = DB_Engine.getAllRecords(S.RES_ITEMS);
    const snap = this.getStockSnapshot_(resItems);
    const books = DB_Engine.getAllRecords(S.BOOKS)
      .filter(b => SYSTEM_CONFIG.BOOKABLE_BOOK_STATUSES.indexOf(b.Book_Status) !== -1 || b.Book_Status === "Pricing")
      .map(b => Object.assign(b, { In_Stock_From_Previous: snap[b.Book_ID] ? Math.max(0, snap[b.Book_ID].free) : 0 }));
    const settings = getSettings_();
    const mine = r => Util.str(r.Emp_ID) === Util.str(empId);
    const emp = DB_Engine.getAllRecords(S.EMPLOYEES).find(mine) || {};
    return {
      success: true,
      activePhase: active, phases: phases,
      catalog: { grades: SYSTEM_CONFIG.CATALOG.GRADES, schoolTypes: SYSTEM_CONFIG.CATALOG.SCHOOL_TYPES },
      settings: {
        UNIFIED_EMP_DISCOUNT_PCT: settings.UNIFIED_EMP_DISCOUNT_PCT, MAX_INSTALLMENT_COUNT: settings.MAX_INSTALLMENT_COUNT,
        MIN_DOWN_PAYMENT_PCT: settings.MIN_DOWN_PAYMENT_PCT, DEFAULT_INSTALLMENT_COUNT: settings.DEFAULT_INSTALLMENT_COUNT,
        MAX_QTY_PER_BOOK: settings.MAX_QTY_PER_BOOK, CASH_ACCOUNT_HOLDER: settings.CASH_ACCOUNT_HOLDER,
        ALLOW_RELATIVE_BOOKING: settings.ALLOW_RELATIVE_BOOKING !== false && String(settings.ALLOW_RELATIVE_BOOKING) !== "false", MAX_RELATIVES: settings.MAX_RELATIVES || 5
      },
      brand: this.brand_(settings), announcements: this.announcements_().filter(a => (!a.until || a.until >= Util.today()) && (!a.phaseId || (active && Util.str(active.Phase_ID) === a.phaseId))),
      employee: { installmentAllowed: emp.Installment_Allowed === "" ? true : Util.bool(emp.Installment_Allowed), creditLimit: Util.num(emp.Max_Credit_Limit) || settings.DEFAULT_CREDIT_LIMIT },
      books: books,
      myReservations: DB_Engine.getAllRecords(S.RES_HEADER).filter(mine),
      myReservationItems: resItems.filter(mine),
      myInvoices: DB_Engine.getAllRecords(S.EMP_INVOICES).filter(mine),
      myInstallments: DB_Engine.getAllRecords(S.INSTALLMENTS).filter(mine),
      myPayments: DB_Engine.getAllRecords(S.EMP_PAYMENTS).filter(p => mine(p) && !Util.bool(p.Is_Voided))
    };
  },

  getAdminDashboardFullData: function() {
    const S = this.S();
    const resItems = DB_Engine.getAllRecords(S.RES_ITEMS);
    const phases = DB_Engine.getAllRecords(S.PHASES).map(p => Object.assign(p, { Effective_Status: this.effectiveStatus_(p), Booking_Open: this.isBookingOpen_(p) }));
    return {
      catalog: this.catalogLists_(),
      acl: effectiveAcl_(),
      brand: this.brand_(), announcements: this.announcements_(),
      success: true,
      settings: DB_Engine.getAllRecords(S.SETTINGS),
      settingsMap: getSettings_(),
      employees: DB_Engine.getAllRecords(S.EMPLOYEES),
      suppliers: DB_Engine.getAllRecords(S.SUPPLIERS),
      books: DB_Engine.getAllRecords(S.BOOKS),
      phases: phases,
      resHeaders: DB_Engine.getAllRecords(S.RES_HEADER),
      resItems: resItems,
      poSnapshots: DB_Engine.getAllRecords(S.PO_SNAPSHOT),
      supInvHeaders: DB_Engine.getAllRecords(S.SUP_INV_HEADER),
      supInvItems: DB_Engine.getAllRecords(S.SUP_INV_ITEMS),
      inventoryLedger: DB_Engine.getAllRecords(S.INVENTORY),
      deliveryReturns: DB_Engine.getAllRecords(S.DELIVERY_RETURNS),
      empInvoices: DB_Engine.getAllRecords(S.EMP_INVOICES),
      installments: DB_Engine.getAllRecords(S.INSTALLMENTS),
      empPayments: DB_Engine.getAllRecords(S.EMP_PAYMENTS),
      supLedger: DB_Engine.getAllRecords(S.SUP_LEDGER),
      expenses: DB_Engine.getAllRecords(S.EXPENSES),
      cashClosings: DB_Engine.getAllRecords(S.CASH_CLOSINGS),
      stockMap: this.getStockSnapshot_(resItems)
    };
  },

  // --------------------------------------------------------------------------
  // الحجز بشرائح الأسبقية
  // --------------------------------------------------------------------------

  /**
   * حفظ استمارة الحجز. كل زيادة في كمية كتاب تُضاف كشريحة جديدة بختم وقت جديد،
   * وتحتفظ النسخ الأقدم بأسبقيتها. التخفيض يُلغي من أحدث شريحة أولاً.
   */
  saveEmployeeReservation: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const settings = getSettings_();
      const isEmpPortal = session.userType === "EMPLOYEE";
      const empId = Util.str(isEmpPortal ? session.empId : payload.empId);
      Util.require(empId, "حدد الموظف.");
      const emp = DB_Engine.getAllRecords(S.EMPLOYEES).find(e => Util.str(e.Emp_ID) === empId);
      Util.require(emp, "الموظف غير مسجل.");
      Util.require(Util.str(emp.Employment_Status) === "ساري", "حساب الموظف موقوف.");

      const phaseId = Util.str(payload.phaseId);
      const phase = this.getPhase_(phaseId);
      // الموظف يحجز أثناء فترة الحجز فقط؛ الإدارة تعدّل في أي وقت قبل إغلاق المرحلة نهائياً
      if (isEmpPortal && !this.isBookingOpen_(phase)) throw new Error("فترة الحجز لهذه المرحلة مغلقة.");
      if (!isEmpPortal) Util.require(phase.Phase_Status !== "Completed", "المرحلة مغلقة نهائياً ولا تقبل تعديل الحجوزات.");

      // تجميع الطلب لكل كتاب
      // المفتاح = الكتاب + المستفيد ("" = العضو وأبناؤه، أو اسم القريب وصلته)
      const SEP = "\u0001", keyOf = (b, ben) => b + SEP + ben, bookOf = k => k.split(SEP)[0], benOf = k => k.split(SEP)[1] || "";
      const allowRel = settings.ALLOW_RELATIVE_BOOKING !== false && String(settings.ALLOW_RELATIVE_BOOKING) !== "false";
      const wanted = {};
      (payload.items || []).forEach(r => {
        const b = Util.str(r.bookId), q = parseInt(r.qty, 10) || 0;
        const ben = Util.str(r.beneficiary).replace(/\s+/g, " ").slice(0, 80);
        if (b && q > 0) wanted[keyOf(b, ben)] = (wanted[keyOf(b, ben)] || 0) + q;
      });
      const bens = {}; Object.keys(wanted).forEach(k => { if (benOf(k)) bens[benOf(k)] = 1; });
      if (Object.keys(bens).length) {
        Util.require(allowRel || !isEmpPortal, "الحجز للأقارب غير متاح حالياً.");
        Util.require(Object.keys(bens).length <= (settings.MAX_RELATIVES || 5), "الحد الأقصى للأقارب " + (settings.MAX_RELATIVES || 5) + ".");
      }

      const booksMap = {};
      DB_Engine.getAllRecords(S.BOOKS).forEach(b => booksMap[Util.str(b.Book_ID)] = b);
      const allowedGrades = Util.str(phase.Allowed_Grades);
      const gradeList = (allowedGrades && allowedGrades !== "ALL") ? allowedGrades.split(/[,،]/).map(s => s.trim()) : null;
      const maxPerBook = settings.MAX_QTY_PER_BOOK || 3;

      Object.keys(wanted).forEach(key => {
        const bId = bookOf(key);
        const book = booksMap[bId];
        Util.require(book, "الكتاب كود " + bId + " غير موجود.");
        Util.require(book.Book_Status !== "Pricing", "الكتاب (" + book.Book_Name + ") جاري تسعيره، ويُتاح للحجز فور إعلان سعره.");
        Util.require(SYSTEM_CONFIG.BOOKABLE_BOOK_STATUSES.indexOf(book.Book_Status) !== -1, "الكتاب (" + book.Book_Name + ") غير متاح للحجز حالياً.");
        if (gradeList) Util.require(gradeList.indexOf(Util.str(book.Grade)) !== -1, "الكتاب (" + book.Book_Name + ") ليس ضمن صفوف هذه المرحلة.");
        Util.require(wanted[key] <= maxPerBook, "أقصى عدد من نفس الكتاب " + maxPerBook + " (" + book.Book_Name + ")" + (benOf(key) ? " لـ " + benOf(key) : "") + ".");
      });

      const nowStr = Util.nowPrecise();
      const allHeaders = DB_Engine.getAllRecords(S.RES_HEADER);
      const allItems = DB_Engine.getAllRecords(S.RES_ITEMS);
      const existingHeader = allHeaders.find(h => Util.str(h.Emp_ID) === empId && Util.str(h.Phase_ID) === phaseId);
      const resId = existingHeader ? existingHeader.Res_ID : ("RES-" + phaseId + "-" + empId);
      const mine = allItems.filter(i => Util.str(i.Res_ID) === resId);
      const others = allItems.filter(i => Util.str(i.Res_ID) !== resId);

      const byBook = {};
      mine.forEach(i => { const k = keyOf(Util.str(i.Book_ID), Util.str(i.Beneficiary)); (byBook[k] = byBook[k] || []).push(i); });
      const maxTr = {}; mine.forEach(i => { const b = Util.str(i.Book_ID); maxTr[b] = Math.max(maxTr[b] || 0, Util.num(i.Tranche_No)); });
      const audit = [];
      const logA = (bId, type, oldQ, newQ, ts, rule, ben) => audit.push({
        Log_ID: "RLOG-" + new Date().getTime() + "-" + audit.length, Res_ID: resId, Emp_ID: empId, Book_ID: bId,
        Action_Type: type, Old_Qty: oldQ, New_Qty: newQ, Priority_Timestamp_Applied: ts, Action_Timestamp: nowStr, Rule_Applied: rule + (ben ? " — لـ " + ben : "") + (isEmpPortal ? "" : " — بواسطة الإدارة (" + Util.actor(session) + ")")
      });

      const result = [];
      const allBooks = Object.keys(Object.assign({}, byBook, wanted));
      allBooks.forEach(key => {
        const bId = bookOf(key), ben = benOf(key);
        const tranches = (byBook[key] || []).slice().sort((a, b) => Util.num(a.Tranche_No) - Util.num(b.Tranche_No));
        const oldTotal = tranches.reduce((s, t) => s + Util.num(t.Requested_Qty), 0);
        const newTotal = wanted[key] || 0;
        const book = booksMap[bId];
        const unitEmp = book ? FinancialEngine.roundUpEmployeePrice(book.Emp_Selling_Price) : 0;

        if (newTotal > oldTotal) {
          const nextNo = (maxTr[bId] = (maxTr[bId] || 0) + 1);
          tranches.push({
            Res_Item_ID: resId + "-" + bId + "-T" + nextNo, Res_ID: resId, Phase_ID: phaseId, Emp_ID: empId, Book_ID: bId,
            Priority_Timestamp: nowStr, Requested_Qty: newTotal - oldTotal, Allocated_Qty: 0, Delivered_Qty: 0, Returned_Qty: 0,
            Net_Billable_Qty: 0, Unit_Cover_Price: Util.num(book.Cover_Price), Unit_Emp_Price: unitEmp, Total_Emp_Line_Amount: 0,
            Allocation_Status: "Pending", Unallocated_Reason: "", Is_Manual_Exception: false, Exception_By: "", Exception_Reason: "",
            Tranche_No: nextNo, Carried_From_Item_ID: "", Beneficiary: ben
          });
          logA(bId, oldTotal === 0 ? "ADD_NEW" : "INCREASE_QTY", oldTotal, newTotal, nowStr,
            oldTotal === 0 ? "حجز جديد بختم وقت أولي" : "زيادة: النسخ الإضافية بختم وقت جديد، والنسخ السابقة تحتفظ بأسبقيتها", ben);
        } else if (newTotal < oldTotal) {
          let toRemove = oldTotal - newTotal;
          for (let k = tranches.length - 1; k >= 0 && toRemove > 0; k--) {
            const t = tranches[k];
            const floor = Util.num(t.Delivered_Qty);
            const canCut = Math.max(0, Util.num(t.Requested_Qty) - floor);
            const cut = Math.min(canCut, toRemove);
            t.Requested_Qty = Util.num(t.Requested_Qty) - cut;
            t.Allocated_Qty = Math.min(Util.num(t.Allocated_Qty), t.Requested_Qty);
            toRemove -= cut;
          }
          Util.require(toRemove === 0, "لا يمكن تخفيض كمية كتاب سبق تسليمه.");
          logA(bId, newTotal === 0 ? "REMOVE_ITEM" : "DECREASE_QTY", oldTotal, newTotal, "",
            "تخفيض من أحدث شريحة أولاً، والشرائح الأقدم تحتفظ بأسبقيتها", ben);
        }
        tranches.forEach(t => {
          if (Util.num(t.Requested_Qty) > 0) {
            t.Unit_Emp_Price = Util.num(t.Unit_Emp_Price) || unitEmp;
            t.Total_Emp_Line_Amount = Util.num(t.Requested_Qty) * Util.num(t.Unit_Emp_Price);
            result.push(t);
          }
        });
      });

      // القيم والسداد
      let totalCover = 0, totalEmp = 0;
      result.forEach(t => { totalCover += Util.num(t.Requested_Qty) * Util.num(t.Unit_Cover_Price); totalEmp += Util.num(t.Requested_Qty) * Util.num(t.Unit_Emp_Price); });

      const method = Util.str(payload.paymentMethod) || "INSTALLMENT";
      Util.require(["INSTALLMENT", "CASH", "WALLET", "INSTAPAY", "PAYROLL"].indexOf(method) !== -1, "طريقة سداد غير معروفة.");
      const downType = payload.downPaymentType === "FIXED" ? "FIXED" : "PERCENTAGE";
      const downInput = Util.num(payload.downPaymentInput);
      let instCount = parseInt(payload.installmentCount, 10) || settings.DEFAULT_INSTALLMENT_COUNT || 2;
      const warnings = [];

      let plan;
      if (method === "INSTALLMENT" && totalEmp > 0) {
        const allowed = emp.Installment_Allowed === "" ? true : Util.bool(emp.Installment_Allowed);
        Util.require(allowed, "التقسيط غير متاح لهذا الموظف. اختر الدفع الكامل.");
        const maxInst = settings.MAX_INSTALLMENT_COUNT || 4;
        Util.require(instCount >= 1 && instCount <= maxInst, "عدد الأقساط المسموح من 1 إلى " + maxInst + ".");
        plan = FinancialEngine.calculateInstallmentPlan(totalEmp, downType, downInput, instCount, phase.Delivery_Start_Date);
        const minDown = FinancialEngine.roundUpEmployeePrice(totalEmp * (settings.MIN_DOWN_PAYMENT_PCT || 0) / 100);
        Util.require(plan.downPaymentAmount >= minDown, "الحد الأدنى للمقدم " + (settings.MIN_DOWN_PAYMENT_PCT || 0) + "% أي " + minDown + " ج.م.");
        // الحد الائتماني: المؤجل في هذا الحجز + المتبقي على الموظف من مراحل أخرى
        const limit = Util.num(emp.Max_Credit_Limit) || settings.DEFAULT_CREDIT_LIMIT || 0;
        const otherOpen = DB_Engine.getAllRecords(S.EMP_INVOICES)
          .filter(i => Util.str(i.Emp_ID) === empId && Util.str(i.Phase_ID) !== phaseId)
          .reduce((s, i) => s + Math.max(0, Util.num(i.Remaining_Balance)), 0);
        if (limit > 0) {
          Util.require(plan.remainingToInstall + otherOpen <= limit,
            "تجاوز الحد الائتماني (" + limit + " ج.م). المؤجل الحالي " + plan.remainingToInstall + " والمتبقي عليك من مراحل سابقة " + otherOpen + ".");
        }
      } else {
        instCount = 0;
        plan = FinancialEngine.calculateInstallmentPlan(totalEmp, "PERCENTAGE", 100, 1, phase.Delivery_Start_Date);
      }
      const overdue = this.overdueForEmployee_(empId, null);
      if (overdue > 0) warnings.push("عليك أقساط متأخرة بقيمة " + overdue + " ج.م من مراحل سابقة، وقد يُمنع التسليم حتى سدادها.");

      const headerObj = {
        Res_ID: resId, Phase_ID: phaseId, Emp_ID: empId,
        Created_At: existingHeader ? existingHeader.Created_At : nowStr, Last_Modified_At: nowStr,
        Payment_Method_Selected: method, Down_Payment_Type: method === "INSTALLMENT" ? downType : "PERCENTAGE",
        Down_Payment_Input: method === "INSTALLMENT" ? downInput : 100, Calculated_Down_Payment: plan.downPaymentAmount,
        Installment_Count: instCount, Installment_Value: method === "INSTALLMENT" ? plan.averageInstallmentValue : 0,
        Total_Cover_Value: FinancialEngine.roundCurrency(totalCover), Total_Emp_Value: totalEmp,
        Res_Status: result.length > 0 ? "Active" : "Cancelled",
        Created_By: existingHeader ? (existingHeader.Created_By || "") : (isEmpPortal ? "" : Util.actor(session))
      };

      if (existingHeader) DB_Engine.updateRecordByPK(S.RES_HEADER, "Res_ID", resId, headerObj);
      else if (result.length > 0) DB_Engine.insertRecordsBatch(S.RES_HEADER, [headerObj]);
      else throw new Error("لم تقم باختيار أي كتاب.");

      DB_Engine.overwriteTableData(S.RES_ITEMS, others.concat(result));
      if (audit.length) DB_Engine.insertRecordsBatch(S.RES_AUDIT, audit);
      // إن صدرت فاتورة لهذا الموظف في المرحلة تُحدَّث فوراً بعد تعديل الحجز
      if (DB_Engine.getAllRecords(S.EMP_INVOICES).some(i => Util.str(i.Emp_ID) === empId && Util.str(i.Phase_ID) === phaseId)) this.syncEmployeeInvoicesForPhase_(phaseId);
      DB_Engine.logAudit(session.userId || empId, session.role, "Reservations", isEmpPortal ? "SAVE_RESERVATION" : "SAVE_RESERVATION_ON_BEHALF", resId, existingHeader, headerObj);

      return {
        success: true,
        message: result.length ? (isEmpPortal ? "تم حفظ حجزك بنجاح وتوثيق أسبقية كل كتاب." : "تم حفظ حجز الموظف (" + emp.Full_Name + ") وتوثيق أسبقية كل كتاب.") : (isEmpPortal ? "تم إلغاء حجزك بالكامل." : "تم إلغاء حجز الموظف بالكامل."),
        warnings: warnings, reservationHeader: headerObj, reservationItems: result, installmentPlan: plan
      };
    });
  },

  // --------------------------------------------------------------------------
  // المراحل والإعدادات والكتالوج
  // --------------------------------------------------------------------------

  savePhase: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const phases = DB_Engine.getAllRecords(S.PHASES);
      const pId = Util.str(payload.phaseId) || ("PH-" + ("0" + (phases.length + 1)).slice(-2));
      const existing = phases.find(p => Util.str(p.Phase_ID) === pId);
      Util.require(Util.str(payload.phaseName), "أدخل اسم المرحلة.");
      const st = Util.str(payload.startDate), en = Util.str(payload.endDate);
      if (st && en) Util.require(st <= en, "تاريخ نهاية الحجز يجب أن يكون بعد البداية.");
      const obj = {
        Phase_ID: pId, Phase_Name: payload.phaseName,
        Start_DateTime: st.length === 10 ? st + " 00:00:00" : st,
        End_DateTime: en.length === 10 ? en + " 23:59:59" : en,
        Order_Send_Date: payload.orderSendDate || (existing ? existing.Order_Send_Date : ""),
        Expected_Supply_Date: payload.expectedSupplyDate || (existing ? existing.Expected_Supply_Date : ""),
        Delivery_Start_Date: payload.deliveryStartDate || (existing ? existing.Delivery_Start_Date : ""),
        Allowed_Grades: payload.allowedGrades || "ALL",
        Phase_Status: payload.phaseStatus || (existing ? existing.Phase_Status : "Open"),
        Manual_Override: Util.bool(payload.manualOverride)
      };
      if (existing) DB_Engine.updateRecordByPK(S.PHASES, "Phase_ID", pId, obj);
      else DB_Engine.insertRecordsBatch(S.PHASES, [obj]);
      DB_Engine.logAudit(session.userId, session.role, "Phases", "SAVE_PHASE", pId, existing, obj);
      return { success: true, message: "تم حفظ المرحلة (" + pId + ")." };
    });
  },

  setPhaseStatus: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const phase = this.getPhase_(payload.phaseId);
      const st = Util.str(payload.status);
      Util.require(SYSTEM_CONFIG.PHASE_STATUSES.indexOf(st) !== -1, "حالة غير معروفة.");
      if (st === "Completed") {
        const items = DB_Engine.getAllRecords(S.RES_ITEMS).filter(i => Util.str(i.Phase_ID) === Util.str(phase.Phase_ID) && !this.isCancelledItem_(i));
        const pendingDelivery = items.reduce((s, i) => s + Math.max(0, Util.num(i.Allocated_Qty) - Util.num(i.Delivered_Qty)), 0);
        Util.require(pendingDelivery === 0, "لا يمكن إغلاق المرحلة: يوجد " + pendingDelivery + " نسخة مخصصة لم تُسلَّم بعد.");
      }
      const upd = { Phase_Status: st };
      if (payload.deliveryStartDate) upd.Delivery_Start_Date = payload.deliveryStartDate;
      if (st !== "Open") upd.Manual_Override = false;
      DB_Engine.updateRecordByPK(S.PHASES, "Phase_ID", phase.Phase_ID, upd);
      DB_Engine.logAudit(session.userId, session.role, "Phases", "SET_STATUS", phase.Phase_ID, { Phase_Status: phase.Phase_Status }, upd);
      return { success: true, message: "تم تغيير حالة المرحلة إلى " + st + "." };
    });
  },

  /**
   * سجل التعديلات: آخر الحركات من سجل النظام وسجل بنود الحجز معاً.
   * payload: { module, q, days, empId, limit } — الأحدث أولاً.
   */
  getAuditLog: function(payload) {
    const S = this.S(), p = payload || {};
    const limit = Math.min(1000, Math.max(20, parseInt(p.limit, 10) || 300));
    const since = p.days ? Util.dateStr(new Date(new Date().getTime() - Util.num(p.days) * 86400000)) : "";
    const users = {}; DB_Engine.getAllRecords(S.USERS).forEach(u => { users[Util.str(u.User_ID)] = u.Full_Name; });
    const emps = {}; DB_Engine.getAllRecords(S.EMPLOYEES).forEach(e => { emps[Util.str(e.Emp_ID)] = e.Full_Name; });
    const nameOf = id => users[id] || emps[id] || id;
    const q = Util.str(p.q).toLowerCase(), mod = Util.str(p.module), emp = Util.str(p.empId);
    let out = DB_Engine.getAllRecords(S.AUDIT_TRAIL).map(a => ({ t: Util.str(a.Timestamp), user: nameOf(Util.str(a.User_ID)), uid: Util.str(a.User_ID), role: a.User_Role, module: a.Module_Name, action: a.Action_Performed, key: Util.str(a.Record_Primary_Key), before: a.Before_State_JSON, after: a.After_State_JSON }));
    DB_Engine.getAllRecords(S.RES_AUDIT).forEach(r => out.push({ t: Util.str(r.Action_Timestamp).slice(0, 19), user: nameOf(Util.str(r.Emp_ID)), uid: Util.str(r.Emp_ID), role: "", module: "ReservationItems", action: r.Action_Type, key: Util.str(r.Res_ID), book: r.Book_ID, oldQty: r.Old_Qty, newQty: r.New_Qty, rule: r.Rule_Applied, emp: Util.str(r.Emp_ID) }));
    out = out.filter(a => (!since || a.t >= since) && (!mod || a.module === mod)
      && (!emp || a.uid === emp || a.emp === emp || a.key.indexOf("-" + emp) !== -1)
      && (!q || (a.user + " " + a.action + " " + a.key + " " + (a.book || "") + " " + (a.rule || "")).toLowerCase().indexOf(q) !== -1));
    out.sort((x, y) => y.t < x.t ? -1 : y.t > x.t ? 1 : 0);
    return { success: true, total: out.length, entries: out.slice(0, limit) };
  },

  /** حفظ مصفوفة الصلاحيات: payload.acl = {action: [roles]} */
  saveRolePermissions: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S(), src = payload.acl || {}, clean = {};
      Object.keys(src).forEach(a => {
        if (!ACTION_ACL[a] || FIXED_ACL.indexOf(a) !== -1) return;
        clean[a] = (Array.isArray(src[a]) ? src[a] : []).filter((r, i, arr) => CUSTOM_ROLES.indexOf(r) !== -1 && arr.indexOf(r) === i);
      });
      const val = JSON.stringify(clean);
      const row = DB_Engine.getAllRecords(S.SETTINGS).find(r => r.Setting_Key === "ROLE_PERMISSIONS");
      const rec = { Setting_Key: "ROLE_PERMISSIONS", Setting_Value: val, Data_Type: "JSON", Description: "صلاحيات الأدوار (تُعدَّل من صفحة الإعدادات ← الصلاحيات)", Updated_At: Util.now(), Updated_By: Util.actor(session) };
      if (row) DB_Engine.updateRecordByPK(S.SETTINGS, "Setting_Key", "ROLE_PERMISSIONS", rec); else DB_Engine.insertRecordsBatch(S.SETTINGS, [rec]);
      DB_Engine.logAudit(session.userId, session.role, "Settings", "SAVE_ROLE_PERMISSIONS", "ROLE_PERMISSIONS", row ? { v: row.Setting_Value } : null, { v: val });
      return { success: true, message: "تم حفظ الصلاحيات، وتسري فوراً على كل المستخدمين." };
    });
  },

  saveSetting: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const key = Util.str(payload.key);
      const row = DB_Engine.getAllRecords(S.SETTINGS).find(r => r.Setting_Key === key);
      Util.require(row, "إعداد غير معروف: " + key);
      DB_Engine.updateRecordByPK(S.SETTINGS, "Setting_Key", key, { Setting_Value: payload.value, Updated_At: Util.now(), Updated_By: Util.actor(session) });
      DB_Engine.logAudit(session.userId, session.role, "Settings", "SAVE_SETTING", key, { v: row.Setting_Value }, { v: payload.value });
      return { success: true, message: "تم حفظ الإعداد." };
    });
  },

  /** قوائم الكتالوج (الثابتة + القابلة للتعديل من الإعدادات) */
  catalogLists_: function() {
    const st = getSettings_();
    const list = k => Util.str(st[k]).split(/[,،]/).map(x => x.trim()).filter(Boolean);
    return { grades: SYSTEM_CONFIG.CATALOG.GRADES, schoolTypes: SYSTEM_CONFIG.CATALOG.SCHOOL_TYPES,
      publishers: list("BOOK_PUBLISHERS"), subjects: list("BOOK_SUBJECTS"), parts: list("BOOK_PARTS") };
  },

  /** كود جديد للكتاب: كود الصف + رقم تسلسلي داخل الصف (P4-007) */
  nextBookCode_: function(gradeCode, books) {
    const pre = gradeCode + "-";
    const max = books.reduce((m, b) => { const id = Util.str(b.Book_ID); return id.indexOf(pre) === 0 ? Math.max(m, parseInt(id.slice(pre.length), 10) || 0) : m; }, 0);
    return pre + ("00" + (max + 1)).slice(-3);
  },

  /** اسم العرض: الناشر — المادة (الجزء)، مع «لغات» لطبعة مدارس اللغات من مادة لها طبعة عربية */
  bookDisplayName_: function(publisher, subject, part, types) {
    const englishNamed = ["إنجليزي", "فرنساوي", "ألماني", "ماث", "ساينس", "أي سي تي", "ديسكفري"];
    const langOnly = types && types.length === 1 && types[0] === "لغات" && englishNamed.indexOf(subject) === -1;
    return publisher + " — " + subject + (langOnly ? " لغات" : "") + (part ? " (" + part + ")" : "");
  },

  saveBook: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const lists = this.catalogLists_();
      const books = DB_Engine.getAllRecords(S.BOOKS);
      const existing = payload.bookId ? books.find(b => Util.str(b.Book_ID) === Util.str(payload.bookId)) : null;
      const grade = lists.grades.find(g => g.label === Util.str(payload.grade));
      Util.require(grade, "اختر الصف الدراسي من القائمة.");
      const types = String(payload.schoolTypes || "").split(/[,،+]/).map(x => x.trim()).filter(Boolean);
      Util.require(types.length && types.every(t => lists.schoolTypes.indexOf(t) !== -1), "اختر نوع المدرسة من القائمة.");
      const publisher = Util.str(payload.publisher), subject = Util.str(payload.subject), part = Util.str(payload.bookPart);
      Util.require(lists.publishers.indexOf(publisher) !== -1, "اختر الناشر من القائمة (يمكن إضافة ناشر جديد من الإعدادات).");
      Util.require(lists.subjects.indexOf(subject) !== -1, "اختر المادة من القائمة (يمكن إضافة مادة جديدة من الإعدادات).");
      Util.require(!part || lists.parts.indexOf(part) !== -1, "اختر جزء الكتاب من القائمة.");
      const id = existing ? existing.Book_ID : this.nextBookCode_(grade.code, books);
      const priced = Util.num(payload.coverPrice) > 0;
      const base = {
        Book_ID: id, Book_Name: this.bookDisplayName_(publisher, subject, part, types), Stage: grade.stage, Grade: grade.label,
        Subject: subject, Publisher: publisher, School_Types: types.join("،"), Book_Part: part
      };
      let obj, msg;
      if (priced) {
        const sup = DB_Engine.getAllRecords(S.SUPPLIERS).find(s => Util.str(s.Supplier_ID) === Util.str(payload.supplierId));
        Util.require(sup, "اختر المكتبة الموردة.");
        const empPct = payload.empDiscountPct !== undefined && payload.empDiscountPct !== "" ? payload.empDiscountPct : getSettings_().UNIFIED_EMP_DISCOUNT_PCT;
        const volPct = payload.volumeDiscountSharePct !== undefined && payload.volumeDiscountSharePct !== "" ? payload.volumeDiscountSharePct : sup.Volume_Discount_Pct;
        const p = FinancialEngine.calculateBookPricing(payload.coverPrice, payload.supplierDiscountPct, volPct, empPct);
        let status = payload.bookStatus || (existing ? existing.Book_Status : "Available");
        if (status === "Pricing") status = "Available"; // دخل السعر: يُتاح للحجز
        obj = Object.assign(base, {
          Supplier_ID: sup.Supplier_ID, Cover_Price: p.coverPrice,
          Supplier_Discount_Pct: p.supplierDiscountPct, Initial_Purchase_Price: p.initialPurchasePrice,
          Volume_Discount_Share_Pct: p.volumeDiscountSharePct, Standard_Net_Cost: p.standardNetCost,
          Emp_Discount_Pct: p.empDiscountPct, Emp_Selling_Price: p.empSellingPrice, Book_Status: status
        });
        const warn = p.unitSurplusMargin < 0 ? " تنبيه: هذا الكتاب يُباع بخسارة " + Math.abs(p.unitSurplusMargin) + " ج.م للنسخة." : "";
        msg = "تم حفظ الكتاب " + id + " بسعر موظف " + p.empSellingPrice + " ج.م." + warn;
      } else {
        obj = Object.assign(base, {
          Supplier_ID: Util.str(payload.supplierId) || (existing ? existing.Supplier_ID : ""), Cover_Price: "", Supplier_Discount_Pct: "",
          Initial_Purchase_Price: "", Volume_Discount_Share_Pct: "", Standard_Net_Cost: "", Emp_Discount_Pct: "", Emp_Selling_Price: "",
          Book_Status: "Pricing"
        });
        msg = "تم حفظ الكتاب " + id + " بحالة «جاري التسعير» — لن يُتاح للحجز حتى يُدخل سعره.";
      }
      if (existing) DB_Engine.updateRecordByPK(S.BOOKS, "Book_ID", id, obj);
      else DB_Engine.insertRecordsBatch(S.BOOKS, [obj]);
      DB_Engine.logAudit(session.userId, session.role, "Catalog", "SAVE_BOOK", id, existing, obj);
      return { success: true, message: msg, book: obj };
    });
  },

  /**
   * تسعير جماعي لكتب موجودة: rows = [{bookId, coverPrice, supplierDiscountPct?, supplierId?}]
   * defaults = {supplierDiscountPct, supplierId}. يحدّث حقول السعر فقط ويُتيح الكتاب للحجز.
   * dryRun: يحسب النتيجة بلا حفظ (للمعاينة).
   */
  bulkPriceBooks: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S(), st = getSettings_(), def = payload.defaults || {};
      // قواعد خصم المكتبة حسب الناشر: {publisher: pct}، وdefaults.supplierDiscountPct لباقي الكتب
      const pubRule = {}; Object.keys(def.publisherDiscounts || {}).forEach(k => { const v = def.publisherDiscounts[k]; if (v !== "" && v !== null && v !== undefined) pubRule[Util.str(k)] = Util.num(v); });
      const sups = {}; DB_Engine.getAllRecords(S.SUPPLIERS).forEach(x => { sups[Util.str(x.Supplier_ID)] = x; });
      const firstSup = Object.keys(sups)[0];
      const books = {}; DB_Engine.getAllRecords(S.BOOKS).forEach(b => { books[Util.str(b.Book_ID)] = b; });
      const results = [], seen = {};
      let ok = 0;
      (payload.rows || []).forEach((r, i) => {
        const id = Util.str(r.bookId).toUpperCase(), line = i + 1, b = books[id];
        const res = { line: line, bookId: id, ok: false };
        results.push(res);
        if (!b) { res.error = "كود غير موجود"; return; }
        if (seen[id]) { res.error = "مكرر في القائمة"; return; }
        seen[id] = 1; res.name = b.Book_Name;
        const cover = Util.num(r.coverPrice);
        if (!(cover > 0)) { res.error = "سعر الغلاف غير صحيح"; return; }
        const supId = Util.str(r.supplierId) || Util.str(def.supplierId) || Util.str(b.Supplier_ID) || firstSup;
        const sup = sups[supId];
        if (!sup) { res.error = "مكتبة غير معروفة: " + supId; return; }
        const pub = Util.str(b.Publisher);
        const discRaw = r.supplierDiscountPct !== undefined && r.supplierDiscountPct !== "" ? r.supplierDiscountPct
          : pubRule[pub] !== undefined ? pubRule[pub]
          : (def.supplierDiscountPct !== undefined && def.supplierDiscountPct !== "" ? def.supplierDiscountPct : b.Supplier_Discount_Pct);
        res.rule = r.supplierDiscountPct !== undefined && r.supplierDiscountPct !== "" ? "السطر" : pubRule[pub] !== undefined ? pub : (def.supplierDiscountPct !== undefined && def.supplierDiscountPct !== "" ? "باقي الكتب" : "السابق");
        const disc = Util.num(discRaw);
        if (disc < 0 || disc >= 100) { res.error = "خصم المكتبة غير صحيح"; return; }
        const pr = FinancialEngine.calculateBookPricing(cover, disc, sup.Volume_Discount_Pct, b.Emp_Discount_Pct !== "" && b.Emp_Discount_Pct !== undefined ? b.Emp_Discount_Pct : st.UNIFIED_EMP_DISCOUNT_PCT);
        Object.assign(res, { ok: true, oldCover: b.Cover_Price, cover: pr.coverPrice, disc: pr.supplierDiscountPct, cost: pr.standardNetCost, emp: pr.empSellingPrice, margin: pr.unitSurplusMargin, supplierId: supId, wasPricing: b.Book_Status === "Pricing" });
        if (pr.unitSurplusMargin < 0) res.warning = "يُباع بأقل من التكلفة";
        ok++;
        if (!payload.dryRun) DB_Engine.updateRecordByPK(S.BOOKS, "Book_ID", id, {
          Supplier_ID: supId, Cover_Price: pr.coverPrice, Supplier_Discount_Pct: pr.supplierDiscountPct, Initial_Purchase_Price: pr.initialPurchasePrice,
          Volume_Discount_Share_Pct: pr.volumeDiscountSharePct, Standard_Net_Cost: pr.standardNetCost, Emp_Discount_Pct: pr.empDiscountPct, Emp_Selling_Price: pr.empSellingPrice,
          Book_Status: b.Book_Status === "Pricing" ? "Available" : b.Book_Status });
      });
      const bad = results.filter(x => !x.ok).length;
      if (!payload.dryRun && ok) DB_Engine.logAudit(session.userId, session.role, "Catalog", "BULK_PRICE_BOOKS", "-", null, { priced: ok, rejected: bad, rules: pubRule, rest: def.supplierDiscountPct });
      // حفظ القواعد لتظهر في المرة القادمة
      if (!payload.dryRun && (Object.keys(pubRule).length || (def.supplierDiscountPct !== undefined && def.supplierDiscountPct !== ""))) {
        const val = JSON.stringify({ publishers: pubRule, rest: def.supplierDiscountPct === undefined ? "" : def.supplierDiscountPct, supplierId: Util.str(def.supplierId) });
        const row = DB_Engine.getAllRecords(S.SETTINGS).find(x => x.Setting_Key === "SUPPLIER_DISCOUNT_RULES");
        const rec = { Setting_Key: "SUPPLIER_DISCOUNT_RULES", Setting_Value: val, Data_Type: "JSON", Description: "قواعد خصم المكتبة حسب الناشر (تُعدَّل من التسعير الجماعي)", Updated_At: Util.now(), Updated_By: Util.actor(session) };
        if (row) DB_Engine.updateRecordByPK(S.SETTINGS, "Setting_Key", "SUPPLIER_DISCOUNT_RULES", rec); else DB_Engine.insertRecordsBatch(S.SETTINGS, [rec]);
      }
      return { success: true, dryRun: !!payload.dryRun, results: results, priced: ok, rejected: bad,
        message: payload.dryRun ? "معاينة: " + ok + " صالح و" + bad + " مرفوض." : "تم تسعير " + ok + " كتاباً وإتاحتها للحجز" + (bad ? "، ورُفض " + bad + " سطراً (راجع الأخطاء)." : ".") };
    });
  },

  bulkImportBooks: function(session, booksArray) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const st = getSettings_();
      const sups = {};
      DB_Engine.getAllRecords(S.SUPPLIERS).forEach(s => sups[Util.str(s.Supplier_ID)] = s);
      const map = {};
      DB_Engine.getAllRecords(S.BOOKS).forEach(b => map[Util.str(b.Book_ID)] = b);
      let added = 0, updated = 0;
      const errors = [];
      booksArray.forEach((inp, idx) => {
        const id = Util.str(inp.Book_ID);
        if (!id) return;
        const sup = sups[Util.str(inp.Supplier_ID)] || sups[Object.keys(sups)[0]];
        if (!(Util.num(inp.Cover_Price) > 0)) { // بلا سعر: يُضاف بحالة «جاري التسعير»
          const base = map[id] || {};
          if (!map[id]) added++; else updated++;
          map[id] = Object.assign({}, base, {
            Book_ID: id, Book_Name: Util.str(inp.Book_Name) || base.Book_Name, Stage: inp.Stage || base.Stage || "", Grade: inp.Grade || base.Grade || "",
            Subject: inp.Subject || base.Subject || "", Publisher: inp.Publisher || base.Publisher || "-", Supplier_ID: sup ? sup.Supplier_ID : (base.Supplier_ID || ""),
            School_Types: inp.School_Types || base.School_Types || "", Book_Part: inp.Book_Part || base.Book_Part || "",
            Cover_Price: "", Supplier_Discount_Pct: "", Initial_Purchase_Price: "", Volume_Discount_Share_Pct: "", Standard_Net_Cost: "",
            Emp_Discount_Pct: "", Emp_Selling_Price: "", Book_Status: "Pricing" });
          return;
        }
        if (!sup) { errors.push("سطر " + (idx + 1) + ": مكتبة غير صحيحة"); return; }
        const p = FinancialEngine.calculateBookPricing(inp.Cover_Price, inp.Supplier_Discount_Pct,
          inp.Volume_Discount_Share_Pct !== undefined && inp.Volume_Discount_Share_Pct !== "" ? inp.Volume_Discount_Share_Pct : sup.Volume_Discount_Pct,
          inp.Emp_Discount_Pct !== undefined && inp.Emp_Discount_Pct !== "" ? inp.Emp_Discount_Pct : st.UNIFIED_EMP_DISCOUNT_PCT);
        if (map[id]) updated++; else added++;
        map[id] = {
          Book_ID: id, Book_Name: Util.str(inp.Book_Name), Stage: inp.Stage || "", Grade: inp.Grade || "", Subject: inp.Subject || "",
          Publisher: inp.Publisher || "-", Supplier_ID: sup.Supplier_ID, Cover_Price: p.coverPrice,
          Supplier_Discount_Pct: p.supplierDiscountPct, Initial_Purchase_Price: p.initialPurchasePrice,
          Volume_Discount_Share_Pct: p.volumeDiscountSharePct, Standard_Net_Cost: p.standardNetCost,
          Emp_Discount_Pct: p.empDiscountPct, Emp_Selling_Price: p.empSellingPrice,
          School_Types: inp.School_Types || (map[id] ? map[id].School_Types : ""), Book_Part: inp.Book_Part || (map[id] ? map[id].Book_Part : ""),
          Book_Status: inp.Book_Status || (map[id] && map[id].Book_Status !== "Pricing" ? map[id].Book_Status : "Available")
        };
      });
      DB_Engine.overwriteTableData(S.BOOKS, Object.keys(map).map(k => map[k]));
      DB_Engine.logAudit(session.userId, session.role, "Catalog", "BULK_IMPORT_BOOKS", "-", null, { added: added, updated: updated });
      return { success: true, message: "تم استيراد الكتب (إضافة " + added + " | تحديث " + updated + ")" + (errors.length ? " — أخطاء: " + errors.join("؛ ") : "") };
    });
  },

  bulkImportEmployees: function(session, employeesArray) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const map = {};
      DB_Engine.getAllRecords(S.EMPLOYEES).forEach(e => map[Util.str(e.Emp_ID)] = e);
      let added = 0, updated = 0;
      const errors = [];
      employeesArray.forEach((inp, idx) => {
        const id = Util.str(inp.Emp_ID);
        if (!id) return;
        const nat = Util.str(inp.National_ID_Last4).padStart(4, "0");
        const mob = AuthEngine.normalizeMobile(inp.Mobile);
        if (!/^\d{4}$/.test(nat) || !/^01\d{9}$/.test(mob)) { errors.push("سطر " + (idx + 1) + " (" + id + "): رقم قومي أو موبايل غير صحيح"); return; }
        const old = map[id];
        if (old) updated++; else added++;
        map[id] = {
          Emp_ID: id, Full_Name: Util.str(inp.Full_Name) || (old ? old.Full_Name : ""), National_ID_Last4: nat, Mobile: mob,
          Department: inp.Department || (old ? old.Department : ""), Job_Title: inp.Job_Title || (old ? old.Job_Title : ""),
          Employment_Status: inp.Employment_Status || (old ? old.Employment_Status : "ساري"),
          Installment_Allowed: inp.Installment_Allowed !== undefined ? inp.Installment_Allowed !== false : (old ? old.Installment_Allowed : true),
          Max_Credit_Limit: Util.num(inp.Max_Credit_Limit) || (old ? old.Max_Credit_Limit : ""),
          Notes: inp.Notes || (old ? old.Notes : ""), Updated_At: Util.now()
        };
      });
      DB_Engine.overwriteTableData(S.EMPLOYEES, Object.keys(map).map(k => map[k]));
      DB_Engine.logAudit(session.userId, session.role, "Employees", "BULK_IMPORT", "-", null, { added: added, updated: updated });
      return { success: true, message: "تم الاستيراد (إضافة " + added + " | تحديث " + updated + ")" + (errors.length ? " — مرفوض: " + errors.join("؛ ") : "") };
    });
  },

  saveSupplier: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const list = DB_Engine.getAllRecords(S.SUPPLIERS);
      Util.require(Util.str(payload.supplierName), "أدخل اسم المكتبة.");
      const supId = Util.str(payload.supplierId) || ("SUP-" + ("0" + (list.length + 1)).slice(-2));
      const existing = list.find(s => Util.str(s.Supplier_ID) === supId);
      const obj = {
        Supplier_ID: supId, Supplier_Name: payload.supplierName, Contact_Person: payload.contactPerson || (existing ? existing.Contact_Person : "-"),
        Phone: payload.phone || (existing ? existing.Phone : ""), Volume_Discount_Pct: Util.num(payload.volumeDiscountPct),
        Return_Policy_Days: Util.num(payload.returnPolicyDays) || (existing ? existing.Return_Policy_Days : 30),
        Payment_Terms: payload.paymentTerms || (existing ? existing.Payment_Terms : "-"),
        Contract_Notes: payload.contractNotes || (existing ? existing.Contract_Notes : ""), Is_Active: true
      };
      if (existing) DB_Engine.updateRecordByPK(S.SUPPLIERS, "Supplier_ID", supId, obj);
      else DB_Engine.insertRecordsBatch(S.SUPPLIERS, [obj]);
      DB_Engine.logAudit(session.userId, session.role, "Suppliers", "SAVE_SUPPLIER", supId, existing, obj);
      return { success: true, message: "تم حفظ بيانات المكتبة (" + supId + ")." };
    });
  },

  // --------------------------------------------------------------------------
  // الحصر التجميعي وطلب التوريد
  // --------------------------------------------------------------------------

  /**
   * المطلوب من المكتبة لكل كتاب = احتياج المرحلة − (الرصيد الحر + نواقص مستحقة على المكتبة)
   * بعد أن يأخذ المنتظرون من المراحل السابقة نصيبهم أولاً.
   */
  generatePurchaseOrderSnapshot: function(session, phaseId) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const phase = this.getPhase_(phaseId);
      Util.require(!this.isBookingOpen_(phase), "أغلق الحجز لهذه المرحلة أولاً قبل تجميد الحصر.");
      const invs = DB_Engine.getAllRecords(S.SUP_INV_HEADER).filter(h => Util.str(h.Phase_ID) === Util.str(phaseId));
      Util.require(invs.length === 0, "تم استلام فواتير على هذه المرحلة، ولا يمكن إعادة تجميد الحصر.");

      const books = DB_Engine.getAllRecords(S.BOOKS);
      const items = DB_Engine.getAllRecords(S.RES_ITEMS).filter(i => !this.isCancelledItem_(i));
      const snap = this.getStockSnapshot_(items);
      const allPO = DB_Engine.getAllRecords(S.PO_SNAPSHOT);
      const otherPO = allPO.filter(p => Util.str(p.Phase_ID) !== Util.str(phaseId));

      const need = {}, waitingPrev = {}, owedPrev = {};
      items.forEach(i => {
        const b = Util.str(i.Book_ID);
        const unmet = Math.max(0, Util.num(i.Requested_Qty) - Util.num(i.Allocated_Qty));
        if (Util.str(i.Phase_ID) === Util.str(phaseId)) need[b] = (need[b] || 0) + unmet;
        else waitingPrev[b] = (waitingPrev[b] || 0) + unmet;
      });
      otherPO.filter(p => p.Line_Status === "Open").forEach(p => {
        owedPrev[Util.str(p.Book_ID)] = (owedPrev[Util.str(p.Book_ID)] || 0) + Util.num(p.Outstanding_Qty);
      });

      const nowStr = Util.now();
      const rows = [];
      books.forEach(book => {
        const b = Util.str(book.Book_ID);
        const n = need[b] || 0;
        if (n <= 0) return;
        const free = Math.max(0, snap[b] ? snap[b].free : 0);
        const wPrev = waitingPrev[b] || 0;
        const owed = owedPrev[b] || 0;
        const freeAfterPrev = Math.max(0, free - wPrev);
        const owedAfterPrev = Math.max(0, owed - Math.max(0, wPrev - free));
        const carry = Math.min(n, freeAfterPrev);
        const pendingUse = Math.min(n - carry, owedAfterPrev);
        const net = n - carry - pendingUse;
        rows.push({
          PO_ID: "PO-" + phaseId + "-" + b, Phase_ID: phaseId, Supplier_ID: book.Supplier_ID, Book_ID: b,
          Total_Requested_Qty: n, Carryover_Stock_Qty: carry, Net_Order_To_Supplier_Qty: net,
          Frozen_At: nowStr, Frozen_By: Util.actor(session), Pending_From_Previous_Qty: pendingUse,
          Received_Qty_To_Date: 0, Outstanding_Qty: net, Line_Status: net > 0 ? "Open" : "Covered_From_Stock"
        });
      });
      DB_Engine.overwriteTableData(S.PO_SNAPSHOT, otherPO.concat(rows));
      if (["Open", "Closed", "Draft"].indexOf(phase.Phase_Status) !== -1) {
        DB_Engine.updateRecordByPK(S.PHASES, "Phase_ID", phase.Phase_ID, { Phase_Status: "Ordered", Order_Send_Date: Util.today(), Manual_Override: false });
      }
      DB_Engine.logAudit(session.userId, session.role, "PO_Snapshot", "FREEZE_PO", phaseId, null, { lines: rows.length });
      const totalNet = rows.reduce((s, r) => s + r.Net_Order_To_Supplier_Qty, 0);
      const totalCarry = rows.reduce((s, r) => s + r.Carryover_Stock_Qty, 0);
      return { success: true, message: "تم تجميد الحصر: " + rows.length + " كتاب، مطلوب من المكتبة " + totalNet + " نسخة، ومغطى من المخزون " + totalCarry + " نسخة.", snapshot: rows };
    });
  },

  /** إلغاء النواقص المستحقة على المكتبة (كتاب لن يُطبع أو لن يُورَّد) */
  cancelPoBackorder: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const po = DB_Engine.getAllRecords(S.PO_SNAPSHOT).find(p => p.PO_ID === Util.str(payload.poId));
      Util.require(po, "سطر طلب التوريد غير موجود.");
      Util.require(Util.str(payload.reason), "اكتب سبب الإلغاء.");
      DB_Engine.updateRecordByPK(S.PO_SNAPSHOT, "PO_ID", po.PO_ID, { Line_Status: "Cancelled", Outstanding_Qty: 0 });
      DB_Engine.logAudit(session.userId, session.role, "PO_Snapshot", "CANCEL_BACKORDER", po.PO_ID, po, { reason: payload.reason });
      return { success: true, message: "تم إلغاء الكمية المستحقة على المكتبة. شغّل التوزيع ليتحول المنتظرون إلى (لم يُورَّد)." };
    });
  },

  // --------------------------------------------------------------------------
  // فاتورة المكتبة والجرد
  // --------------------------------------------------------------------------

  /**
   * الفاتورة تُثبَّت بالكمية المفوترة (سليم + تالف)، ويدخل المخزن السليم فقط،
   * ويُسجَّل التالف مطالبة على المكتبة تلقائياً.
   */
  recordSupplierInvoiceAndStock: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const supplierId = Util.str(payload.supplierId);
      const phaseId = Util.str(payload.phaseId);
      const supInvNo = Util.str(payload.supplierInvoiceNo);
      Util.require(supInvNo, "أدخل رقم فاتورة المكتبة.");
      const phase = this.getPhase_(phaseId);
      const supplier = DB_Engine.getAllRecords(S.SUPPLIERS).find(s => Util.str(s.Supplier_ID) === supplierId);
      Util.require(supplier, "المكتبة غير موجودة.");
      const dup = DB_Engine.getAllRecords(S.SUP_INV_HEADER).find(h => Util.str(h.Supplier_ID) === supplierId && Util.str(h.Supplier_Invoice_No) === supInvNo);
      Util.require(!dup, "فاتورة المكتبة رقم " + supInvNo + " مسجلة من قبل.");

      const books = {};
      DB_Engine.getAllRecords(S.BOOKS).forEach(b => books[Util.str(b.Book_ID)] = b);
      const volPct = payload.volumeDiscountPct !== undefined && payload.volumeDiscountPct !== "" ? Util.num(payload.volumeDiscountPct) : Util.num(supplier.Volume_Discount_Pct);
      const supInvId = "SINV-" + phaseId + "-" + new Date().getTime();
      const invDate = Util.str(payload.invoiceDate) || Util.today();

      let gross = 0, afterFirst = 0, damagedClaim = 0, invoicedUnits = 0;
      const lines = [], stockIn = [];
      (payload.items || []).forEach((ln, idx) => {
        const bId = Util.str(ln.bookId);
        const rec = Math.max(0, parseInt(ln.receivedQty, 10) || 0);
        const dmg = Math.max(0, parseInt(ln.damagedQty, 10) || 0);
        const ord = Math.max(0, parseInt(ln.orderedQty, 10) || 0);
        if (rec + dmg === 0 && ord === 0) return;
        Util.require(books[bId], "كتاب غير موجود بالكتالوج: " + bId);
        const cover = Util.num(ln.coverPrice) || Util.num(books[bId].Cover_Price);
        const disc = ln.itemDiscPct !== undefined && ln.itemDiscPct !== "" ? Util.num(ln.itemDiscPct) : Util.num(books[bId].Supplier_Discount_Pct);
        const unitFirst = FinancialEngine.roundCurrency(cover * (1 - disc / 100));
        const unitVol = FinancialEngine.roundCurrency(unitFirst * volPct / 100);
        const unitNet = FinancialEngine.roundCurrency(unitFirst - unitVol);
        const invoiced = rec + dmg;
        gross += cover * invoiced;
        afterFirst += unitFirst * invoiced;
        damagedClaim += unitNet * dmg;
        invoicedUnits += invoiced;
        let flag = "EXACT";
        if (invoiced === 0 && ord > 0) flag = ln.notPrinted ? "NOT_PRINTED" : "NOT_RECEIVED";
        else if (ord === 0 && invoiced > 0) flag = "UNORDERED_ITEM";
        else if (invoiced < ord) flag = "SHORTAGE";
        else if (invoiced > ord) flag = "SURPLUS";
        const priceMismatch = (Math.abs(cover - Util.num(books[bId].Cover_Price)) > 0.001 || Math.abs(disc - Util.num(books[bId].Supplier_Discount_Pct)) > 0.001);
        lines.push({
          Sup_Inv_Item_ID: supInvId + "-L" + (idx + 1), Sup_Inv_ID: supInvId, Book_ID: bId, Ordered_Qty: ord, Received_Qty: rec,
          Variance_Qty: invoiced - ord, Cover_Price_Invoiced: cover, Item_Discount_Pct_Invoiced: disc,
          Unit_Price_After_First_Disc: unitFirst, Allocated_Volume_Disc_Per_Unit: unitVol, Actual_Unit_Net_Cost: unitNet,
          Total_Line_Net_Cost: FinancialEngine.roundCurrency(unitNet * invoiced), Matching_Flag: flag,
          Admin_Decision_Notes: Util.str(ln.notes), Damaged_Qty: dmg, Price_Mismatch: priceMismatch ? "مختلف عن الكتالوج" : ""
        });
        if (rec > 0) stockIn.push(this.inventoryRow_(session, phaseId, bId, "IN_SUPPLY", rec, unitNet, supInvId, "توريد فاتورة " + supInvNo));
        if (ln.notPrinted && books[bId].Book_Status === "Available") {
          DB_Engine.updateRecordByPK(S.BOOKS, "Book_ID", bId, { Book_Status: "Not_Yet_Printed" });
        }
      });
      Util.require(invoicedUnits > 0, "لا توجد كميات مفوترة في الفاتورة.");

      afterFirst = FinancialEngine.roundCurrency(afterFirst);
      const volAmt = FinancialEngine.roundCurrency(afterFirst * volPct / 100);
      const net = FinancialEngine.roundCurrency(afterFirst - volAmt);
      damagedClaim = FinancialEngine.roundCurrency(damagedClaim);
      const stated = payload.supplierStatedNet !== undefined && payload.supplierStatedNet !== "" ? Util.num(payload.supplierStatedNet) : "";
      const variance = stated === "" ? 0 : FinancialEngine.roundCurrency(stated - net);
      const header = {
        Sup_Inv_ID: supInvId, Internal_Ref_No: Counter.next("SUP_INV", "SIN"), Supplier_Invoice_No: supInvNo, Supplier_ID: supplierId,
        Phase_ID: phaseId, Invoice_Date: invDate, Gross_Total_Cover: FinancialEngine.roundCurrency(gross),
        Total_After_Item_Discount: afterFirst, Volume_Discount_Pct: volPct, Volume_Discount_Amount: volAmt,
        Net_Payable_Amount: net, Status: Math.abs(variance) > 1 ? "Approved_With_Variance" : "Approved",
        Approved_By: Util.actor(session), Approved_At: Util.now(), Supplier_Stated_Net: stated,
        Variance_Amount: variance, Damaged_Claim_Amount: damagedClaim
      };

      const ledger = [{
        Sup_Trans_ID: "SLED-" + supInvId, Supplier_ID: supplierId, Phase_ID: phaseId, Trans_Date: invDate, Trans_Type: "INVOICE_CREDIT",
        Reference_ID: supInvId, Debit_Amount: 0, Credit_Amount: net, Payment_Channel: "-", Document_Ref: supInvNo,
        Recorded_By: Util.actor(session), Notes: "صافي فاتورة توريد بعد خصم الكمية " + volPct + "%"
      }];
      if (damagedClaim > 0) ledger.push({
        Sup_Trans_ID: "SCLM-" + supInvId, Supplier_ID: supplierId, Phase_ID: phaseId, Trans_Date: invDate, Trans_Type: "DAMAGE_CLAIM",
        Reference_ID: supInvId, Debit_Amount: damagedClaim, Credit_Amount: 0, Payment_Channel: "مطالبة تالف", Document_Ref: supInvNo,
        Recorded_By: Util.actor(session), Notes: "مطالبة المكتبة بقيمة نسخ تالفة/معيبة وردت بالفاتورة"
      });

      DB_Engine.insertRecordsBatch(S.SUP_INV_HEADER, [header]);
      DB_Engine.insertRecordsBatch(S.SUP_INV_ITEMS, lines);
      if (stockIn.length) DB_Engine.insertRecordsBatch(S.INVENTORY, stockIn);
      DB_Engine.insertRecordsBatch(S.SUP_LEDGER, ledger);

      // تحديث المستحق على المكتبة في طلب التوريد: هذه المرحلة أولاً ثم الأقدم
      const po = DB_Engine.getAllRecords(S.PO_SNAPSHOT);
      const phaseOrder = DB_Engine.getAllRecords(S.PHASES).map(p => Util.str(p.Phase_ID));
      lines.forEach(l => {
        let qty = l.Received_Qty;
        const candidates = po.filter(p => Util.str(p.Book_ID) === l.Book_ID && p.Line_Status === "Open")
          .sort((a, b) => (Util.str(a.Phase_ID) === phaseId ? -1 : 0) - (Util.str(b.Phase_ID) === phaseId ? -1 : 0) || phaseOrder.indexOf(Util.str(a.Phase_ID)) - phaseOrder.indexOf(Util.str(b.Phase_ID)));
        candidates.forEach(p => {
          if (qty <= 0) return;
          const take = Math.min(qty, Util.num(p.Outstanding_Qty));
          qty -= take;
          const out = Util.num(p.Outstanding_Qty) - take;
          DB_Engine.updateRecordByPK(S.PO_SNAPSHOT, "PO_ID", p.PO_ID, {
            Received_Qty_To_Date: Util.num(p.Received_Qty_To_Date) + take, Outstanding_Qty: out, Line_Status: out === 0 ? "Fulfilled" : "Open"
          });
          p.Outstanding_Qty = out;
          if (out === 0) p.Line_Status = "Fulfilled";
        });
      });
      if (["Ordered", "Closed"].indexOf(phase.Phase_Status) !== -1) {
        DB_Engine.updateRecordByPK(S.PHASES, "Phase_ID", phase.Phase_ID, { Phase_Status: "Receiving", Manual_Override: false });
      }

      DB_Engine.logAudit(session.userId, session.role, "Supplier_Invoices", "APPROVE_INVOICE", supInvId, null, header);
      const flags = lines.filter(l => l.Matching_Flag !== "EXACT").length;
      let msg = "تم اعتماد الفاتورة " + supInvNo + " بصافي " + net + " ج.م وإضافة السليم للمخزن.";
      if (flags) msg += " يوجد " + flags + " سطر به فروق (نقص/زيادة/لم يُطبع).";
      if (damagedClaim > 0) msg += " مطالبة تالف: " + damagedClaim + " ج.م.";
      if (header.Status === "Approved_With_Variance") msg += " تنبيه: صافي المكتبة يختلف عن حساب المنظومة بـ " + variance + " ج.م.";
      return { success: true, message: msg, invoiceHeader: header };
    });
  },

  recordStockAdjustment: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const bId = Util.str(payload.bookId);
      const qty = parseInt(payload.qty, 10) || 0;
      Util.require(qty !== 0, "أدخل كمية التسوية (موجبة للزيادة وسالبة للعجز).");
      Util.require(Util.str(payload.reason), "اكتب سبب التسوية (محضر جرد).");
      const snap = this.getStockSnapshot_();
      if (qty < 0) Util.require((snap[bId] ? snap[bId].onHand : 0) + qty >= 0, "التسوية تجعل الرصيد سالباً.");
      const cost = this.bookCost_(snap, bId);
      DB_Engine.insertRecordsBatch(S.INVENTORY, [this.inventoryRow_(session, Util.str(payload.phaseId), bId, qty > 0 ? "ADJUST_GAIN" : "ADJUST_LOSS", qty, cost, Counter.next("ADJ", "ADJ"), payload.reason)]);
      DB_Engine.logAudit(session.userId, session.role, "Inventory", "ADJUST", bId, null, { qty: qty, reason: payload.reason });
      return { success: true, message: "تم تسجيل تسوية الجرد." };
    });
  },

  // --------------------------------------------------------------------------
  // محرك التوزيع بالأسبقية
  // --------------------------------------------------------------------------

  /**
   * المتاح للمرحلة = الرصيد الفعلي − المخصص غير المسلَّم للمراحل الأخرى.
   * يُحجز أولاً ما سُلِّم أو خُصص يدوياً، ثم توزَّع البقية على الشرائح بالأقدم.
   * التشغيل المتكرر يعطي النتيجة نفسها.
   */
  runAutoAllocationEngine: function(session, phaseId) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const phase = this.getPhase_(phaseId);
      Util.require(!this.isBookingOpen_(phase), "لا يمكن التوزيع والحجز مفتوح. أغلق الحجز أولاً.");
      const all = DB_Engine.getAllRecords(S.RES_ITEMS);
      const ledger = DB_Engine.getAllRecords(S.INVENTORY);
      const books = {};
      DB_Engine.getAllRecords(S.BOOKS).forEach(b => books[Util.str(b.Book_ID)] = b);
      const owed = {};
      DB_Engine.getAllRecords(S.PO_SNAPSHOT).filter(p => p.Line_Status === "Open").forEach(p => owed[Util.str(p.Book_ID)] = (owed[Util.str(p.Book_ID)] || 0) + Util.num(p.Outstanding_Qty));

      const onHand = {};
      ledger.forEach(r => onHand[Util.str(r.Book_ID)] = (onHand[Util.str(r.Book_ID)] || 0) + Util.num(r.Qty_Change));
      const reservedOther = {};
      all.forEach(i => {
        if (Util.str(i.Phase_ID) === Util.str(phaseId) || this.isCancelledItem_(i)) return;
        reservedOther[Util.str(i.Book_ID)] = (reservedOther[Util.str(i.Book_ID)] || 0) + Math.max(0, Util.num(i.Allocated_Qty) - Util.num(i.Delivered_Qty));
      });

      const phaseItems = all.filter(i => Util.str(i.Phase_ID) === Util.str(phaseId) && !this.isCancelledItem_(i));
      const byBook = {};
      phaseItems.forEach(i => (byBook[Util.str(i.Book_ID)] = byBook[Util.str(i.Book_ID)] || []).push(i));
      const stats = { full: 0, partial: 0, waiting: 0 };

      Object.keys(byBook).forEach(bId => {
        let pool = Math.max(0, (onHand[bId] || 0) - (reservedOther[bId] || 0));
        const reqs = byBook[bId];
        const locked = r => Util.num(r.Delivered_Qty) > 0 || Util.bool(r.Is_Manual_Exception);
        reqs.filter(locked).forEach(r => {
          r.Allocated_Qty = Math.max(Util.num(r.Allocated_Qty), Util.num(r.Delivered_Qty));
          pool = Math.max(0, pool - (r.Allocated_Qty - Util.num(r.Delivered_Qty)));
          r.Allocation_Status = r.Allocated_Qty >= Util.num(r.Requested_Qty) ? "Fully_Allocated" : (r.Allocated_Qty > 0 ? "Partially_Allocated" : "Waitlisted");
        });
        reqs.filter(r => !locked(r))
          .sort((a, b) => String(a.Priority_Timestamp).localeCompare(String(b.Priority_Timestamp)) || String(a.Res_Item_ID).localeCompare(String(b.Res_Item_ID)))
          .forEach(r => {
            const want = Util.num(r.Requested_Qty);
            const give = Math.min(want, pool);
            pool -= give;
            r.Allocated_Qty = give;
            if (give === want) { r.Allocation_Status = "Fully_Allocated"; r.Unallocated_Reason = ""; stats.full++; }
            else {
              r.Allocation_Status = give > 0 ? "Partially_Allocated" : "Waitlisted";
              if (give > 0) stats.partial++; else stats.waiting++;
              const bk = books[bId] || {};
              r.Unallocated_Reason = bk.Book_Status === "Not_Yet_Printed" ? "الكتاب لم يُطبع بعد"
                : (owed[bId] > 0 ? "بانتظار استكمال المكتبة للنواقص (حسب أسبقية الحجز)" : "نفدت الكمية الواردة (حسب أسبقية الحجز)");
            }
          });
        reqs.forEach(r => {
          r.Net_Billable_Qty = Math.max(Util.num(r.Allocated_Qty), Util.num(r.Delivered_Qty)) - Util.num(r.Returned_Qty);
          r.Total_Emp_Line_Amount = r.Net_Billable_Qty * Util.num(r.Unit_Emp_Price);
        });
      });

      DB_Engine.overwriteTableData(S.RES_ITEMS, all);
      this.syncEmployeeInvoicesForPhase_(phaseId);
      if (["Ordered", "Receiving", "Closed"].indexOf(phase.Phase_Status) !== -1) {
        DB_Engine.updateRecordByPK(S.PHASES, "Phase_ID", phase.Phase_ID, { Phase_Status: "Delivering", Delivery_Start_Date: phase.Delivery_Start_Date || Util.today(), Manual_Override: false });
      }
      DB_Engine.logAudit(session.userId, session.role, "Allocation", "RUN_FIFO", phaseId, null, stats);
      return { success: true, message: "تم التوزيع بالأسبقية: مكتمل " + stats.full + " | جزئي " + stats.partial + " | انتظار " + stats.waiting + ". وتم تحديث فواتير الموظفين." };
    });
  },

  manualAllocationOverride: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const all = DB_Engine.getAllRecords(S.RES_ITEMS);
      const t = all.find(i => Util.str(i.Res_Item_ID) === Util.str(payload.resItemId));
      Util.require(t, "بند الحجز غير موجود.");
      const reason = Util.str(payload.reason);
      Util.require(reason, "اكتب سبب الاستثناء للتوثيق الرقابي.");
      const newQ = Math.max(0, parseInt(payload.newAllocatedQty, 10) || 0);
      Util.require(newQ >= Util.num(t.Delivered_Qty), "لا يمكن أن يقل المخصص عن المسلَّم فعلاً (" + t.Delivered_Qty + ").");
      Util.require(newQ <= Util.num(t.Requested_Qty), "لا يمكن تخصيص أكثر من المحجوز (" + t.Requested_Qty + ").");
      const delta = newQ - Util.num(t.Allocated_Qty);
      if (delta > 0) {
        const snap = this.getStockSnapshot_(all);
        const free = snap[Util.str(t.Book_ID)] ? snap[Util.str(t.Book_ID)].free : 0;
        Util.require(free >= delta, "لا يوجد رصيد حر كافٍ (المتاح " + free + "). خفِّض تخصيص موظف آخر أولاً.");
      }
      const before = Object.assign({}, t);
      t.Allocated_Qty = newQ;
      t.Is_Manual_Exception = true;
      t.Exception_By = Util.actor(session);
      t.Exception_Reason = reason;
      t.Allocation_Status = newQ >= Util.num(t.Requested_Qty) ? "Fully_Allocated" : (newQ > 0 ? "Partially_Allocated" : "Waitlisted");
      t.Net_Billable_Qty = Math.max(newQ, Util.num(t.Delivered_Qty)) - Util.num(t.Returned_Qty);
      t.Total_Emp_Line_Amount = t.Net_Billable_Qty * Util.num(t.Unit_Emp_Price);
      DB_Engine.overwriteTableData(S.RES_ITEMS, all);
      this.syncEmployeeInvoicesForPhase_(t.Phase_ID);
      DB_Engine.logAudit(session.userId, session.role, "Allocation", "MANUAL_EXCEPTION", t.Res_Item_ID, before, t);
      return { success: true, message: "تم تطبيق الاستثناء وتوثيقه وتحديث فاتورة الموظف." };
    });
  },

  /**
   * ترحيل المنتظرين من مرحلة إلى مرحلة لاحقة مع الاحتفاظ بختم أسبقيتهم الأصلي.
   * الكمية غير المخصصة تُغلق في المرحلة القديمة وتُنشأ شريحة في الجديدة.
   */
  carryWaitlistToPhase: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const fromId = Util.str(payload.fromPhaseId), toId = Util.str(payload.toPhaseId);
      Util.require(fromId && toId && fromId !== toId, "حدد مرحلة المصدر ومرحلة الوجهة.");
      this.getPhase_(fromId);
      const toPhase = this.getPhase_(toId);
      const all = DB_Engine.getAllRecords(S.RES_ITEMS);
      const headers = DB_Engine.getAllRecords(S.RES_HEADER);
      const newHeaders = [];
      let moved = 0, people = {};
      const added = [];
      all.filter(i => Util.str(i.Phase_ID) === fromId && !this.isCancelledItem_(i)).forEach(i => {
        const unmet = Util.num(i.Requested_Qty) - Math.max(Util.num(i.Allocated_Qty), Util.num(i.Delivered_Qty));
        if (unmet <= 0) return;
        const empId = Util.str(i.Emp_ID);
        let h = headers.concat(newHeaders).find(x => Util.str(x.Emp_ID) === empId && Util.str(x.Phase_ID) === toId);
        if (!h) {
          const src = headers.find(x => Util.str(x.Res_ID) === Util.str(i.Res_ID)) || {};
          h = Object.assign({}, src, { Res_ID: "RES-" + toId + "-" + empId, Phase_ID: toId, Created_At: Util.nowPrecise(), Last_Modified_At: Util.nowPrecise(), Res_Status: "Active" });
          delete h._rowIndex;
          newHeaders.push(h);
        }
        const siblings = all.concat(added).filter(x => Util.str(x.Res_ID) === h.Res_ID && Util.str(x.Book_ID) === Util.str(i.Book_ID));
        const no = siblings.reduce((m, x) => Math.max(m, Util.num(x.Tranche_No)), 0) + 1;
        added.push(Object.assign({}, i, {
          _rowIndex: undefined, Res_Item_ID: h.Res_ID + "-" + i.Book_ID + "-T" + no, Res_ID: h.Res_ID, Phase_ID: toId,
          Requested_Qty: unmet, Allocated_Qty: 0, Delivered_Qty: 0, Returned_Qty: 0, Net_Billable_Qty: 0, Total_Emp_Line_Amount: 0,
          Allocation_Status: "Pending", Unallocated_Reason: "مُرحَّل من " + fromId + " بأسبقيته الأصلية", Is_Manual_Exception: false,
          Exception_By: "", Exception_Reason: "", Tranche_No: no, Carried_From_Item_ID: i.Res_Item_ID
        }));
        i.Requested_Qty = Math.max(Util.num(i.Allocated_Qty), Util.num(i.Delivered_Qty));
        if (i.Requested_Qty === 0) i.Allocation_Status = "Carried_Forward";
        i.Unallocated_Reason = "رُحِّلت " + unmet + " نسخة إلى " + toId;
        moved += unmet; people[empId] = 1;
      });
      Util.require(moved > 0, "لا توجد كميات منتظرة في " + fromId + ".");
      DB_Engine.overwriteTableData(S.RES_ITEMS, all.concat(added));
      if (newHeaders.length) DB_Engine.insertRecordsBatch(S.RES_HEADER, newHeaders);
      this.syncEmployeeInvoicesForPhase_(fromId);
      DB_Engine.logAudit(session.userId, session.role, "Allocation", "CARRY_WAITLIST", fromId + "->" + toId, null, { moved: moved });
      return { success: true, message: "تم ترحيل " + moved + " نسخة لعدد " + Object.keys(people).length + " موظف إلى " + toPhase.Phase_Name + " بأسبقيتهم الأصلية." };
    });
  },

  // --------------------------------------------------------------------------
  // فواتير الموظفين وجداول الأقساط
  // --------------------------------------------------------------------------

  syncEmployeeInvoicesForPhase_: function(phaseId) {
    const S = this.S();
    const phase = this.getPhase_(phaseId);
    const items = DB_Engine.getAllRecords(S.RES_ITEMS).filter(i => Util.str(i.Phase_ID) === Util.str(phaseId));
    const headers = DB_Engine.getAllRecords(S.RES_HEADER).filter(h => Util.str(h.Phase_ID) === Util.str(phaseId));
    const allInv = DB_Engine.getAllRecords(S.EMP_INVOICES);
    const prefix = "EINV-" + phaseId + "-";
    const oldInvMap = {};
    allInv.filter(i => Util.str(i.Phase_ID) === Util.str(phaseId)).forEach(i => oldInvMap[i.Emp_Inv_ID] = i);
    const otherInv = allInv.filter(i => Util.str(i.Phase_ID) !== Util.str(phaseId));
    const otherInst = DB_Engine.getAllRecords(S.INSTALLMENTS).filter(i => String(i.Emp_Inv_ID).indexOf(prefix) !== 0);
    const payments = DB_Engine.getAllRecords(S.EMP_PAYMENTS).filter(p => !Util.bool(p.Is_Voided));
    const today = Util.today();
    const newInv = [], newInst = [];

    headers.forEach(h => {
      const empId = Util.str(h.Emp_ID);
      const invId = prefix + empId;
      const mine = items.filter(i => Util.str(i.Res_ID) === Util.str(h.Res_ID));
      let alloc = 0, deliv = 0, ret = 0, net = 0, cover = 0;
      mine.forEach(i => {
        const p = Util.num(i.Unit_Emp_Price);
        const billable = Math.max(Util.num(i.Allocated_Qty), Util.num(i.Delivered_Qty)) - Util.num(i.Returned_Qty);
        alloc += Util.num(i.Allocated_Qty) * p;
        deliv += Util.num(i.Delivered_Qty) * p;
        ret += Util.num(i.Returned_Qty) * p;
        net += billable * p;
        cover += billable * Util.num(i.Unit_Cover_Price);
      });
      const adj = FinancialEngine.roundCurrency(Util.num(h.Invoice_Adjustment));
      if (adj) net = Math.max(0, net + adj);
      const old = oldInvMap[invId];
      const paid = FinancialEngine.roundCurrency(payments.filter(p => Util.str(p.Emp_Inv_ID) === invId).reduce((s, p) => s + Util.num(p.Amount), 0));
      if (net === 0 && paid === 0 && (!old || h.Res_Status === "Cancelled")) return; // فاتورة محذوفة أو بلا قيمة
      const base = (old && old.Plan_Base_Date) || phase.Delivery_Start_Date || today;
      const isInst = h.Payment_Method_Selected === "INSTALLMENT";
      const plan = isInst
        ? FinancialEngine.calculateInstallmentPlan(net, h.Down_Payment_Type, h.Down_Payment_Input, h.Installment_Count || 1, base)
        : FinancialEngine.calculateInstallmentPlan(net, "PERCENTAGE", 100, 1, base);
      let remaining = FinancialEngine.roundCurrency(net - paid);
      const credit = remaining < 0 ? -remaining : 0;
      if (remaining < 0) remaining = 0;

      let pool = Math.max(0, paid);
      let anyOverdue = false;
      plan.schedule.forEach(sc => {
        const cov = Math.min(sc.amount, pool);
        pool = FinancialEngine.roundCurrency(pool - cov);
        const rem = FinancialEngine.roundCurrency(sc.amount - cov);
        const overdue = rem > 0 && sc.dueDate < today;
        if (overdue) anyOverdue = true;
        newInst.push({
          Inst_ID: invId + "-INST-" + sc.installmentNo, Emp_Inv_ID: invId, Emp_ID: empId, Installment_No: sc.installmentNo,
          Due_Date: sc.dueDate, Scheduled_Amount: sc.amount, Paid_Amount: cov, Remaining_Inst_Amount: rem,
          Status: rem === 0 ? "Paid" : (overdue ? "Overdue" : (cov > 0 ? "Partial" : "Scheduled")), Admin_Custom_Notes: sc.label
        });
      });

      let status = "Unpaid";
      if (net === 0 && paid === 0) status = "Zero_Allocation";
      else if (credit > 0) status = "Refund_Due";
      else if (remaining === 0) status = "Paid_In_Full";
      else if (anyOverdue) status = "Overdue";
      else if (paid > 0) status = "Partially_Paid";

      newInv.push({
        Emp_Inv_ID: invId, Phase_ID: phaseId, Emp_ID: empId, Res_ID: h.Res_ID, Issue_Date: old ? old.Issue_Date : today,
        Total_Allocated_Amount: alloc, Total_Delivered_Amount: deliv, Total_Returns_Credit: ret, Net_Final_Invoice_Amount: net,
        Down_Payment_Required: plan.downPaymentAmount, Installments_Count: isInst ? plan.installmentCount : 0,
        Total_Paid_Amount: paid, Remaining_Balance: remaining, Payment_Plan_Type: h.Payment_Method_Selected, Invoice_Status: status,
        Total_Cover_Amount: FinancialEngine.roundCurrency(cover), Total_Savings: FinancialEngine.roundCurrency(cover - net),
        Plan_Base_Date: base, Credit_Balance: credit
      });
    });

    DB_Engine.overwriteTableData(S.EMP_INVOICES, otherInv.concat(newInv));
    DB_Engine.overwriteTableData(S.INSTALLMENTS, otherInst.concat(newInst));
  },

  // --------------------------------------------------------------------------
  // التسليم والمرتجعات
  // --------------------------------------------------------------------------

  /**
   * تسليم بند واحد (resItemId) أو كل المتبقي لموظف في المرحلة (empId + phaseId) بإذن واحد.
   * شروط: رصيد فعلي كافٍ، سداد المقدم، لا متأخرات سابقة — ويمكن للمدير التجاوز بسبب موثق.
   */
  executeEmployeeDelivery: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const st = getSettings_();
      const all = DB_Engine.getAllRecords(S.RES_ITEMS);
      let targets;
      if (payload.resItemId) {
        const it = all.find(i => Util.str(i.Res_Item_ID) === Util.str(payload.resItemId));
        Util.require(it, "بند التخصيص غير موجود.");
        const q = parseInt(payload.deliverQty, 10) || 0;
        Util.require(q > 0, "أدخل كمية تسليم صحيحة.");
        Util.require(Util.num(it.Delivered_Qty) + q <= Util.num(it.Allocated_Qty), "الكمية أكبر من المتبقي المخصص للموظف (" + (Util.num(it.Allocated_Qty) - Util.num(it.Delivered_Qty)) + ").");
        targets = [{ item: it, qty: q }];
      } else {
        const empId = Util.str(payload.empId), phaseId = Util.str(payload.phaseId);
        targets = all.filter(i => Util.str(i.Emp_ID) === empId && Util.str(i.Phase_ID) === phaseId && !this.isCancelledItem_(i))
          .map(i => ({ item: i, qty: Util.num(i.Allocated_Qty) - Util.num(i.Delivered_Qty) })).filter(t => t.qty > 0);
        Util.require(targets.length, "لا توجد كتب مخصصة متبقية للتسليم لهذا الموظف.");
      }
      const empId = Util.str(targets[0].item.Emp_ID);
      const phaseId = Util.str(targets[0].item.Phase_ID);
      const force = Util.str(payload.forceReason);
      if (force) Util.require(session.role === "Admin", "تجاوز شروط التسليم متاح للمدير فقط.");

      const inv = DB_Engine.getAllRecords(S.EMP_INVOICES).find(i => i.Emp_Inv_ID === "EINV-" + phaseId + "-" + empId);
      Util.require(inv, "لا توجد فاتورة للموظف في هذه المرحلة. شغّل التوزيع أولاً.");
      if (st.REQUIRE_DOWN_PAYMENT_BEFORE_DELIVERY && !force) {
        Util.require(Util.num(inv.Total_Paid_Amount) + 0.001 >= Util.num(inv.Down_Payment_Required),
          "لم يُسدَّد المقدم المطلوب قبل التسليم (" + inv.Down_Payment_Required + " ج.م، المسدد " + inv.Total_Paid_Amount + "). وجّه الموظف للخزينة أولاً.");
      }
      if (st.BLOCK_DELIVERY_IF_OVERDUE && !force) {
        const od = this.overdueForEmployee_(empId, inv.Emp_Inv_ID);
        Util.require(od === 0, "على الموظف أقساط متأخرة من مراحل سابقة بقيمة " + od + " ج.م. يُشترط سدادها قبل التسليم.");
      }

      const snap = this.getStockSnapshot_(all);
      const need = {};
      targets.forEach(t => need[Util.str(t.item.Book_ID)] = (need[Util.str(t.item.Book_ID)] || 0) + t.qty);
      Object.keys(need).forEach(b => Util.require((snap[b] ? snap[b].onHand : 0) >= need[b], "الرصيد الفعلي بالمخزن لا يكفي للكتاب " + b + "."));

      const receiptNo = Counter.next("DELIVERY", "DLV");
      const now = Util.now();
      const inv_rows = [], docs = [];
      targets.forEach(t => {
        const it = t.item;
        it.Delivered_Qty = Util.num(it.Delivered_Qty) + t.qty;
        it.Net_Billable_Qty = Math.max(Util.num(it.Allocated_Qty), it.Delivered_Qty) - Util.num(it.Returned_Qty);
        it.Total_Emp_Line_Amount = it.Net_Billable_Qty * Util.num(it.Unit_Emp_Price);
        const cost = this.bookCost_(snap, Util.str(it.Book_ID));
        inv_rows.push(this.inventoryRow_(session, phaseId, Util.str(it.Book_ID), "OUT_EMP_DELIVERY", -t.qty, cost, receiptNo, "تسليم للموظف " + empId));
        docs.push({
          Doc_ID: "DOC-" + receiptNo + "-" + it.Book_ID, Doc_Type: "EMP_DELIVERY", Phase_ID: phaseId, Party_ID: empId, Trans_Date: now,
          Book_ID: it.Book_ID, Qty: t.qty, Unit_Price_Applied: it.Unit_Emp_Price, Total_Amount_Impact: t.qty * Util.num(it.Unit_Emp_Price),
          Return_Reason: force ? "تجاوز شروط: " + force : "-", Handled_By: Util.actor(session), Printed_Receipt_No: receiptNo,
          Received_By: Util.str(payload.receivedBy) || "الموظف نفسه", Res_Item_ID: it.Res_Item_ID
        });
      });
      DB_Engine.overwriteTableData(S.RES_ITEMS, all);
      DB_Engine.insertRecordsBatch(S.INVENTORY, inv_rows);
      DB_Engine.insertRecordsBatch(S.DELIVERY_RETURNS, docs);
      this.syncEmployeeInvoicesForPhase_(phaseId);
      DB_Engine.logAudit(session.userId, session.role, "Delivery", force ? "DELIVER_FORCED" : "DELIVER", receiptNo, null, { empId: empId, lines: docs.length, force: force });
      const total = targets.reduce((s, t) => s + t.qty, 0);
      return { success: true, receiptNo: receiptNo, message: "تم تسليم " + total + " نسخة بإذن استلام رقم " + receiptNo + "." };
    });
  },

  /** الموظف رفض/تنازل عن كمية لم تُسلَّم بعد — تتحرر للمنتظرين في التوزيع التالي */
  cancelUndeliveredQty: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const all = DB_Engine.getAllRecords(S.RES_ITEMS);
      const it = all.find(i => Util.str(i.Res_Item_ID) === Util.str(payload.resItemId));
      Util.require(it, "البند غير موجود.");
      const q = parseInt(payload.qty, 10) || 0;
      const undelivered = Util.num(it.Requested_Qty) - Util.num(it.Delivered_Qty);
      Util.require(q > 0 && q <= undelivered, "الكمية القابلة للإلغاء " + undelivered + ".");
      const before = Object.assign({}, it);
      it.Requested_Qty = Util.num(it.Requested_Qty) - q;
      it.Allocated_Qty = Math.max(Util.num(it.Delivered_Qty), Math.min(Util.num(it.Allocated_Qty), it.Requested_Qty));
      if (it.Requested_Qty === 0) it.Allocation_Status = "Cancelled_By_Employee";
      else it.Allocation_Status = it.Allocated_Qty >= it.Requested_Qty ? "Fully_Allocated" : (it.Allocated_Qty > 0 ? "Partially_Allocated" : "Waitlisted");
      it.Unallocated_Reason = "تنازل الموظف عن " + q + " نسخة: " + (Util.str(payload.reason) || "رفض الاستلام");
      it.Net_Billable_Qty = Math.max(Util.num(it.Allocated_Qty), Util.num(it.Delivered_Qty)) - Util.num(it.Returned_Qty);
      it.Total_Emp_Line_Amount = it.Net_Billable_Qty * Util.num(it.Unit_Emp_Price);
      DB_Engine.overwriteTableData(S.RES_ITEMS, all);
      this.syncEmployeeInvoicesForPhase_(it.Phase_ID);
      DB_Engine.insertRecordsBatch(S.RES_AUDIT, [{ Log_ID: "RLOG-" + new Date().getTime(), Res_ID: it.Res_ID, Emp_ID: it.Emp_ID, Book_ID: it.Book_ID, Action_Type: "CANCEL_UNDELIVERED", Old_Qty: before.Requested_Qty, New_Qty: it.Requested_Qty, Priority_Timestamp_Applied: it.Priority_Timestamp, Action_Timestamp: Util.nowPrecise(), Rule_Applied: it.Unallocated_Reason }]);
      DB_Engine.logAudit(session.userId, session.role, "Delivery", "CANCEL_UNDELIVERED", it.Res_Item_ID, before, it);
      return { success: true, message: "تم إلغاء " + q + " نسخة وتعديل فاتورة الموظف. شغّل التوزيع لتذهب النسخة للمنتظر التالي." };
    });
  },

  recordBookReturn: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const st = getSettings_();
      const now = Util.now();
      const force = Util.str(payload.forceReason);
      if (force) Util.require(session.role === "Admin", "تجاوز مدة المرتجع متاح للمدير فقط.");

      if (payload.returnType === "EMP_RETURN") {
        const all = DB_Engine.getAllRecords(S.RES_ITEMS);
        const it = all.find(i => Util.str(i.Res_Item_ID) === Util.str(payload.resItemId));
        Util.require(it, "بند الحجز غير موجود.");
        const q = parseInt(payload.qty, 10) || 0;
        const maxRet = Util.num(it.Delivered_Qty) - Util.num(it.Returned_Qty);
        Util.require(q > 0 && q <= maxRet, "الكمية القابلة للإرجاع " + maxRet + ".");
        const lastDelivery = DB_Engine.getAllRecords(S.DELIVERY_RETURNS)
          .filter(d => d.Doc_Type === "EMP_DELIVERY" && Util.str(d.Res_Item_ID) === Util.str(it.Res_Item_ID))
          .map(d => Util.str(d.Trans_Date)).sort().pop();
        const windowDays = st.EMP_RETURN_WINDOW_DAYS || 0;
        if (windowDays > 0 && lastDelivery && !force) {
          const ld = Util.parseDate(lastDelivery);
          const days = (new Date() - ld) / 86400000;
          Util.require(days <= windowDays, "انتهت مدة المرتجع (" + windowDays + " أيام من الاستلام). يتطلب موافقة المدير.");
        }
        Util.require(payload.condition !== "DAMAGED" || force, "الكتاب التالف لا يُقبل مرتجعاً إلا بموافقة المدير.");
        it.Returned_Qty = Util.num(it.Returned_Qty) + q;
        it.Net_Billable_Qty = Math.max(Util.num(it.Allocated_Qty), Util.num(it.Delivered_Qty)) - it.Returned_Qty;
        it.Total_Emp_Line_Amount = it.Net_Billable_Qty * Util.num(it.Unit_Emp_Price);
        const docNo = Counter.next("EMP_RETURN", "RET");
        const snap = this.getStockSnapshot_(all);
        const cost = this.bookCost_(snap, Util.str(it.Book_ID));
        DB_Engine.overwriteTableData(S.RES_ITEMS, all);
        const moves = [this.inventoryRow_(session, it.Phase_ID, Util.str(it.Book_ID), "IN_EMP_RETURN", q, cost, docNo, "مرتجع من الموظف " + it.Emp_ID)];
        if (payload.condition === "DAMAGED") moves.push(this.inventoryRow_(session, it.Phase_ID, Util.str(it.Book_ID), "ADJUST_LOSS", -q, cost, docNo, "استبعاد مرتجع تالف"));
        DB_Engine.insertRecordsBatch(S.INVENTORY, moves);
        DB_Engine.insertRecordsBatch(S.DELIVERY_RETURNS, [{
          Doc_ID: "DOC-" + docNo, Doc_Type: "EMP_RETURN", Phase_ID: it.Phase_ID, Party_ID: it.Emp_ID, Trans_Date: now, Book_ID: it.Book_ID,
          Qty: q, Unit_Price_Applied: it.Unit_Emp_Price, Total_Amount_Impact: -(q * Util.num(it.Unit_Emp_Price)),
          Return_Reason: Util.str(payload.reason) || "مرتجع من الموظف", Handled_By: Util.actor(session), Printed_Receipt_No: docNo,
          Received_By: "", Res_Item_ID: it.Res_Item_ID
        }]);
        this.syncEmployeeInvoicesForPhase_(it.Phase_ID);
        DB_Engine.logAudit(session.userId, session.role, "Returns", "EMP_RETURN", docNo, null, { item: it.Res_Item_ID, qty: q, force: force });
        return { success: true, message: "تم قبول المرتجع (" + q + " نسخة) برقم " + docNo + " وتخفيض فاتورة الموظف." };
      }

      // مرتجع للمكتبة
      const supplierId = Util.str(payload.supplierId);
      const bId = Util.str(payload.bookId);
      const q = parseInt(payload.qty, 10) || 0;
      Util.require(q > 0, "أدخل الكمية.");
      const book = DB_Engine.getAllRecords(S.BOOKS).find(b => Util.str(b.Book_ID) === bId);
      Util.require(book, "الكتاب غير موجود.");
      Util.require(!supplierId || Util.str(book.Supplier_ID) === supplierId, "هذا الكتاب ليس من توريد هذه المكتبة.");
      const snap = this.getStockSnapshot_();
      const free = snap[bId] ? snap[bId].free : 0;
      Util.require(free >= q, "الرصيد الحر للكتاب " + free + " فقط (الباقي مخصص لموظفين).");
      const cost = this.bookCost_(snap, bId);
      const amount = FinancialEngine.roundCurrency(q * cost);
      const docNo = Counter.next("SUP_RETURN", "SRT");
      const phaseId = Util.str(payload.phaseId);
      DB_Engine.insertRecordsBatch(S.INVENTORY, [this.inventoryRow_(session, phaseId, bId, "OUT_SUPPLIER_RETURN", -q, cost, docNo, "إرجاع للمكتبة")]);
      DB_Engine.insertRecordsBatch(S.SUP_LEDGER, [{
        Sup_Trans_ID: "SLED-" + docNo, Supplier_ID: book.Supplier_ID, Phase_ID: phaseId, Trans_Date: Util.today(), Trans_Type: "RETURN_DEBIT_NOTE",
        Reference_ID: docNo, Debit_Amount: amount, Credit_Amount: 0, Payment_Channel: "مرتجع بضاعة", Document_Ref: docNo,
        Recorded_By: Util.actor(session), Notes: "مرتجع " + q + " نسخة من " + book.Book_Name + " بمتوسط تكلفة " + cost
      }]);
      DB_Engine.insertRecordsBatch(S.DELIVERY_RETURNS, [{
        Doc_ID: "DOC-" + docNo, Doc_Type: "SUPPLIER_RETURN", Phase_ID: phaseId, Party_ID: book.Supplier_ID, Trans_Date: now, Book_ID: bId,
        Qty: q, Unit_Price_Applied: cost, Total_Amount_Impact: -amount, Return_Reason: Util.str(payload.reason) || "إرجاع فائض للمكتبة",
        Handled_By: Util.actor(session), Printed_Receipt_No: docNo, Received_By: "", Res_Item_ID: ""
      }]);
      DB_Engine.logAudit(session.userId, session.role, "Returns", "SUPPLIER_RETURN", docNo, null, { bookId: bId, qty: q, amount: amount });
      return { success: true, message: "تم تسجيل إذن ارتجاع " + docNo + " بـ " + q + " نسخة وخصم " + amount + " ج.م من حساب المكتبة." };
    });
  },

  // --------------------------------------------------------------------------
  // التحصيل والأقساط
  // --------------------------------------------------------------------------

  recordEmployeePayment: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const invId = Util.str(payload.empInvId);
      const amount = FinancialEngine.roundCurrency(payload.amount);
      const method = Util.str(payload.paymentMethod) || "CASH";
      const ref = Util.str(payload.transactionRef);
      Util.require(amount > 0, "قيمة الدفعة يجب أن تكون أكبر من صفر.");
      Util.require(["CASH", "WALLET", "INSTAPAY", "PAYROLL"].indexOf(method) !== -1, "طريقة دفع غير معروفة.");
      if (method === "WALLET" || method === "INSTAPAY") {
        Util.require(ref.length >= 4, "أدخل رقم مرجع التحويل كما يظهر في إشعار المحفظة/إنستاباي.");
        const dup = DB_Engine.getAllRecords(S.EMP_PAYMENTS).find(p => !Util.bool(p.Is_Voided) && p.Payment_Method === method && Util.str(p.Transaction_Ref) === ref);
        Util.require(!dup, "رقم المرجع مسجَّل من قبل في الإيصال " + (dup ? dup.Receipt_No : "") + ".");
      }
      const inv = DB_Engine.getAllRecords(S.EMP_INVOICES).find(i => i.Emp_Inv_ID === invId);
      Util.require(inv, "فاتورة الموظف غير موجودة.");
      Util.require(amount <= Util.num(inv.Remaining_Balance) + 0.001, "المبلغ أكبر من المتبقي على الفاتورة (" + inv.Remaining_Balance + " ج.م).");
      const receiptNo = Counter.next("RECEIPT", "RCP");
      const rec = {
        Payment_ID: "PAY-" + new Date().getTime(), Receipt_No: receiptNo, Emp_ID: inv.Emp_ID, Emp_Inv_ID: invId, Payment_Date: Util.now(),
        Amount: amount, Payment_Method: method, Transaction_Ref: method === "CASH" ? "نقدي بالخزينة" : (ref || "-"),
        Collected_By: Util.actor(session), Is_Voided: false, Void_Reason: "", Voided_By: "", Payment_Type: "PAYMENT"
      };
      DB_Engine.insertRecordsBatch(S.EMP_PAYMENTS, [rec]);
      this.syncEmployeeInvoicesForPhase_(inv.Phase_ID);
      DB_Engine.logAudit(session.userId, session.role, "Payments", "COLLECT", receiptNo, null, rec);
      return { success: true, receiptNo: receiptNo, payment: rec, message: "تم تحصيل " + amount + " ج.م بإيصال رقم " + receiptNo + "." };
    });
  },

  voidEmployeePayment: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const reason = Util.str(payload.reason);
      Util.require(reason, "اكتب سبب إلغاء الإيصال.");
      const p = DB_Engine.getAllRecords(S.EMP_PAYMENTS).find(x => x.Receipt_No === Util.str(payload.receiptNo));
      Util.require(p, "الإيصال غير موجود.");
      Util.require(!Util.bool(p.Is_Voided), "الإيصال ملغى من قبل.");
      const day = Util.str(p.Payment_Date).slice(0, 10);
      const closed = DB_Engine.getAllRecords(S.CASH_CLOSINGS).find(c => Util.str(c.Closing_Date) === day && c.Payment_Method === p.Payment_Method);
      Util.require(!closed, "يوم " + day + " مُقفَل للخزينة. لا يمكن إلغاء إيصال بعد الإقفال؛ سجّل تسوية بدلاً من ذلك.");
      DB_Engine.updateRecordByPK(S.EMP_PAYMENTS, "Payment_ID", p.Payment_ID, { Is_Voided: true, Void_Reason: reason, Voided_By: Util.actor(session) });
      const inv = DB_Engine.getAllRecords(S.EMP_INVOICES).find(i => i.Emp_Inv_ID === p.Emp_Inv_ID);
      if (inv) this.syncEmployeeInvoicesForPhase_(inv.Phase_ID);
      DB_Engine.logAudit(session.userId, session.role, "Payments", "VOID", p.Receipt_No, p, { reason: reason });
      return { success: true, message: "تم إلغاء الإيصال " + p.Receipt_No + " وإعادة حساب رصيد الموظف." };
    });
  },

  /** رد رصيد دائن للموظف (دفع أكثر من صافي فاتورته بعد مرتجع أو إلغاء) */
  refundEmployeeCredit: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const inv = DB_Engine.getAllRecords(S.EMP_INVOICES).find(i => i.Emp_Inv_ID === Util.str(payload.empInvId));
      Util.require(inv, "الفاتورة غير موجودة.");
      const credit = Util.num(inv.Credit_Balance);
      const amount = FinancialEngine.roundCurrency(payload.amount || credit);
      Util.require(credit > 0 && amount > 0 && amount <= credit + 0.001, "الرصيد الدائن المستحق للموظف " + credit + " ج.م.");
      const method = Util.str(payload.paymentMethod) || "CASH";
      const receiptNo = Counter.next("REFUND", "RFD");
      DB_Engine.insertRecordsBatch(S.EMP_PAYMENTS, [{
        Payment_ID: "RFD-" + new Date().getTime(), Receipt_No: receiptNo, Emp_ID: inv.Emp_ID, Emp_Inv_ID: inv.Emp_Inv_ID, Payment_Date: Util.now(),
        Amount: -amount, Payment_Method: method, Transaction_Ref: Util.str(payload.transactionRef) || "رد نقدي", Collected_By: Util.actor(session),
        Is_Voided: false, Void_Reason: "", Voided_By: "", Payment_Type: "REFUND"
      }]);
      this.syncEmployeeInvoicesForPhase_(inv.Phase_ID);
      DB_Engine.logAudit(session.userId, session.role, "Payments", "REFUND", receiptNo, null, { amount: amount });
      return { success: true, message: "تم رد " + amount + " ج.م للموظف بإيصال " + receiptNo + "." };
    });
  },

  /** تعديل فاتورة موظف: خصم (قيمة سالبة) أو إضافة (موجبة) بسبب موثق؛ تُعاد جدولة الأقساط تلقائياً */
  adjustEmployeeInvoice: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const inv = DB_Engine.getAllRecords(S.EMP_INVOICES).find(i => Util.str(i.Emp_Inv_ID) === Util.str(payload.invId));
      Util.require(inv, "الفاتورة غير موجودة.");
      const h = DB_Engine.getAllRecords(S.RES_HEADER).find(r => Util.str(r.Res_ID) === Util.str(inv.Res_ID));
      Util.require(h, "ملف الحجز غير موجود.");
      const amount = FinancialEngine.roundCurrency(Util.num(payload.amount));
      const reason = Util.str(payload.reason);
      Util.require(amount === 0 || reason, "اكتب سبب التعديل.");
      const base = Util.num(inv.Net_Final_Invoice_Amount) - Util.num(h.Invoice_Adjustment);
      Util.require(base + amount >= 0, "لا يمكن أن يصبح صافي الفاتورة أقل من صفر.");
      const upd = { Invoice_Adjustment: amount, Adjustment_Reason: amount ? reason : "", Last_Modified_At: Util.nowPrecise() };
      DB_Engine.updateRecordByPK(S.RES_HEADER, "Res_ID", h.Res_ID, upd);
      this.syncEmployeeInvoicesForPhase_(h.Phase_ID);
      DB_Engine.logAudit(session.userId, session.role, "Invoices", "ADJUST_INVOICE", inv.Emp_Inv_ID, { Invoice_Adjustment: h.Invoice_Adjustment }, upd);
      return { success: true, message: amount ? "تم تعديل الفاتورة " + inv.Emp_Inv_ID + " بقيمة " + amount + " ج.م." : "تم إلغاء تعديل الفاتورة." };
    });
  },

  /** حذف فاتورة موظف: يلغي حجزه في المرحلة ويحرر النسخ المخصصة له. يشترط ألا توجد إيصالات سارية ولا كتب مُسلَّمة. */
  deleteEmployeeInvoice: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const inv = DB_Engine.getAllRecords(S.EMP_INVOICES).find(i => Util.str(i.Emp_Inv_ID) === Util.str(payload.invId));
      Util.require(inv, "الفاتورة غير موجودة.");
      Util.require(Util.str(payload.reason), "اكتب سبب الحذف.");
      const pays = DB_Engine.getAllRecords(S.EMP_PAYMENTS).filter(p => Util.str(p.Emp_Inv_ID) === inv.Emp_Inv_ID && !Util.bool(p.Is_Voided));
      Util.require(!pays.length, "على الفاتورة إيصالات سارية (" + pays.length + "). ألغِ الإيصالات أو رد المبلغ أولاً.");
      const items = DB_Engine.getAllRecords(S.RES_ITEMS);
      const mine = items.filter(i => Util.str(i.Res_ID) === Util.str(inv.Res_ID));
      Util.require(!mine.some(i => Util.num(i.Delivered_Qty) - Util.num(i.Returned_Qty) > 0), "بالفاتورة كتب مُسلَّمة لم تُرتجع. سجّل المرتجع أولاً.");
      mine.forEach(i => {
        if (this.isCancelledItem_(i) || Util.num(i.Requested_Qty) === 0) return;
        DB_Engine.updateRecordByPK(S.RES_ITEMS, "Res_Item_ID", i.Res_Item_ID, { Requested_Qty: 0, Allocated_Qty: 0, Net_Billable_Qty: 0, Total_Emp_Line_Amount: 0, Allocation_Status: "Cancelled_By_Admin", Unallocated_Reason: Util.str(payload.reason) });
      });
      DB_Engine.updateRecordByPK(S.RES_HEADER, "Res_ID", inv.Res_ID, { Res_Status: "Cancelled", Invoice_Adjustment: 0, Adjustment_Reason: "", Total_Emp_Value: 0, Total_Cover_Value: 0, Last_Modified_At: Util.nowPrecise() });
      this.syncEmployeeInvoicesForPhase_(inv.Phase_ID);
      DB_Engine.logAudit(session.userId, session.role, "Invoices", "DELETE_INVOICE", inv.Emp_Inv_ID, inv, { reason: Util.str(payload.reason) });
      return { success: true, message: "تم حذف الفاتورة " + inv.Emp_Inv_ID + " وإلغاء الحجز المرتبط بها، وتحررت نسخه للتوزيع." };
    });
  },

  customizeEmployeeInstallments: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const h = DB_Engine.getAllRecords(S.RES_HEADER).find(r => Util.str(r.Res_ID) === Util.str(payload.resId));
      Util.require(h, "ملف الحجز غير موجود.");
      const method = Util.str(payload.paymentMethod) || h.Payment_Method_Selected;
      const count = Math.max(1, parseInt(payload.installmentCount, 10) || 1);
      Util.require(count <= 12, "أقصى عدد أقساط 12.");
      const upd = {
        Payment_Method_Selected: method,
        Down_Payment_Type: payload.downPaymentType === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
        Down_Payment_Input: Util.num(payload.downPaymentInput),
        Installment_Count: method === "INSTALLMENT" ? count : 0,
        Last_Modified_At: Util.nowPrecise()
      };
      DB_Engine.updateRecordByPK(S.RES_HEADER, "Res_ID", h.Res_ID, upd);
      this.syncEmployeeInvoicesForPhase_(h.Phase_ID);
      DB_Engine.logAudit(session.userId, session.role, "Installments", "CUSTOMIZE_PLAN", h.Res_ID, h, upd);
      return { success: true, message: "تم تعديل خطة السداد: " + (method === "INSTALLMENT" ? "مقدم " + upd.Down_Payment_Input + " و" + count + " أقساط." : "دفع كامل.") };
    });
  },

  // --------------------------------------------------------------------------
  // حساب المكتبة والمصروفات والخزينة
  // --------------------------------------------------------------------------

  supplierBalance_: function(supplierId) {
    return FinancialEngine.roundCurrency(DB_Engine.getAllRecords(this.S().SUP_LEDGER)
      .filter(l => Util.str(l.Supplier_ID) === supplierId)
      .reduce((s, l) => s + Util.num(l.Credit_Amount) - Util.num(l.Debit_Amount), 0));
  },

  recordSupplierPayment: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const supplierId = Util.str(payload.supplierId);
      const amount = FinancialEngine.roundCurrency(payload.amount);
      Util.require(amount > 0, "المبلغ يجب أن يكون أكبر من صفر.");
      Util.require(DB_Engine.getAllRecords(S.SUPPLIERS).find(s => Util.str(s.Supplier_ID) === supplierId), "المكتبة غير موجودة.");
      const bal = this.supplierBalance_(supplierId);
      Util.require(amount <= bal + 0.001 || Util.bool(payload.allowAdvance), "المبلغ أكبر من المستحق للمكتبة (" + bal + " ج.م). فعّل (دفعة مقدمة) إذا كان ذلك مقصوداً.");
      Util.require(Util.str(payload.docRef), "أدخل رقم إيصال استلام المكتبة أو رقم التحويل.");
      const no = Counter.next("SUP_PAYMENT", "SPY");
      DB_Engine.insertRecordsBatch(S.SUP_LEDGER, [{
        Sup_Trans_ID: no, Supplier_ID: supplierId, Phase_ID: Util.str(payload.phaseId), Trans_Date: Util.str(payload.date) || Util.today(),
        Trans_Type: "PAYMENT_DEBIT", Reference_ID: Util.str(payload.docRef), Debit_Amount: amount, Credit_Amount: 0,
        Payment_Channel: Util.str(payload.channel) || "نقدي/تحويل", Document_Ref: Util.str(payload.docRef),
        Recorded_By: Util.actor(session), Notes: Util.str(payload.notes) || "دفعة للمكتبة"
      }]);
      DB_Engine.logAudit(session.userId, session.role, "Supplier", "PAYMENT", no, null, { amount: amount });
      return { success: true, message: "تم تسجيل دفعة " + amount + " ج.م برقم " + no + ". الرصيد المتبقي للمكتبة " + FinancialEngine.roundCurrency(bal - amount) + " ج.م." };
    });
  },

  recordInitiativeExpense: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const amount = FinancialEngine.roundCurrency(payload.amount);
      Util.require(amount > 0, "قيمة المصروف يجب أن تكون أكبر من صفر.");
      const cat = Util.str(payload.category);
      Util.require(SYSTEM_CONFIG.EXPENSE_CATEGORIES.indexOf(cat) !== -1, "بند مصروف غير معروف.");
      Util.require(Util.str(payload.beneficiary), "أدخل الجهة المستفيدة.");
      if (cat === "أخرى") Util.require(Util.str(payload.notes), "اكتب وصف المصروف في الملاحظات.");
      const no = Counter.next("EXPENSE", "EXP");
      const rec = {
        Expense_ID: no, Expense_Date: Util.str(payload.date) || Util.today(), Phase_ID: Util.str(payload.phaseId), Expense_Category: cat,
        Amount: amount, Beneficiary_Name: Util.str(payload.beneficiary), Allocation_Method: "BY_VALUE",
        Receipt_Doc_No: Util.str(payload.docNo) || "-", Recorded_By: Util.actor(session), Notes: Util.str(payload.notes)
      };
      DB_Engine.insertRecordsBatch(S.EXPENSES, [rec]);
      DB_Engine.logAudit(session.userId, session.role, "Expenses", "RECORD", no, null, rec);
      return { success: true, message: "تم تسجيل المصروف " + no + " بقيمة " + amount + " ج.م." };
    });
  },

  /** إقفال يومي: مطابقة المحصّل في المنظومة مع الفعلي لكل وسيلة دفع */
  closeCashDay: function(session, payload) {
    return DB_Engine.executeWithLock(() => {
      const S = this.S();
      const day = Util.str(payload.date) || Util.today();
      const counted = payload.counted || {};
      const pays = DB_Engine.getAllRecords(S.EMP_PAYMENTS).filter(p => !Util.bool(p.Is_Voided) && Util.str(p.Payment_Date).slice(0, 10) === day);
      const existing = DB_Engine.getAllRecords(S.CASH_CLOSINGS).filter(c => Util.str(c.Closing_Date) === day);
      const rows = [];
      ["CASH", "WALLET", "INSTAPAY", "PAYROLL"].forEach(m => {
        const list = pays.filter(p => p.Payment_Method === m);
        if (!list.length && counted[m] === undefined) return;
        Util.require(!existing.find(c => c.Payment_Method === m), "تم إقفال " + m + " ليوم " + day + " من قبل.");
        const sys = FinancialEngine.roundCurrency(list.reduce((s, p) => s + Util.num(p.Amount), 0));
        const cnt = counted[m] === undefined || counted[m] === "" ? sys : FinancialEngine.roundCurrency(counted[m]);
        rows.push({
          Closing_ID: "CLS-" + day + "-" + m, Closing_Date: day, Payment_Method: m, System_Amount: sys, Counted_Amount: cnt,
          Difference: FinancialEngine.roundCurrency(cnt - sys), Receipts_Count: list.length, Closed_By: Util.actor(session),
          Closed_At: Util.now(), Notes: Util.str(payload.notes)
        });
      });
      Util.require(rows.length, "لا توجد تحصيلات لإقفالها في " + day + ".");
      DB_Engine.insertRecordsBatch(S.CASH_CLOSINGS, rows);
      DB_Engine.logAudit(session.userId, session.role, "Cash", "CLOSE_DAY", day, null, rows);
      const diffs = rows.filter(r => r.Difference !== 0).map(r => r.Payment_Method + ": " + r.Difference);
      return { success: true, message: "تم إقفال يوم " + day + "." + (diffs.length ? " فروق: " + diffs.join("، ") : " لا توجد فروق."), rows: rows };
    });
  },

  // --------------------------------------------------------------------------
  // التصفية النهائية
  // --------------------------------------------------------------------------

  getSettlementReport: function() {
    const S = this.S();
    const st = getSettings_();
    const items = DB_Engine.getAllRecords(S.RES_ITEMS);
    const snap = this.getStockSnapshot_(items);
    const ledger = DB_Engine.getAllRecords(S.INVENTORY);
    const invoices = DB_Engine.getAllRecords(S.EMP_INVOICES);
    const pays = DB_Engine.getAllRecords(S.EMP_PAYMENTS).filter(p => !Util.bool(p.Is_Voided));
    const supLed = DB_Engine.getAllRecords(S.SUP_LEDGER);
    const expenses = DB_Engine.getAllRecords(S.EXPENSES);
    const inst = DB_Engine.getAllRecords(S.INSTALLMENTS);
    const R = FinancialEngine.roundCurrency;

    const revenue = R(invoices.reduce((s, i) => s + Util.num(i.Net_Final_Invoice_Amount), 0));
    const savings = R(invoices.reduce((s, i) => s + Util.num(i.Total_Savings), 0));
    const sumMove = types => R(-ledger.filter(r => types.indexOf(String(r.Movement_Type)) !== -1).reduce((s, r) => s + Util.num(r.Qty_Change) * Util.num(r.Unit_Actual_Cost), 0));
    const cogs = sumMove(["OUT_EMP_DELIVERY", "IN_EMP_RETURN"]);
    const shrink = sumMove(["ADJUST_LOSS", "ADJUST_GAIN"]);
    const purchasesNet = R(supLed.filter(l => l.Trans_Type === "INVOICE_CREDIT").reduce((s, l) => s + Util.num(l.Credit_Amount), 0));
    const claims = R(supLed.filter(l => l.Trans_Type === "DAMAGE_CLAIM").reduce((s, l) => s + Util.num(l.Debit_Amount), 0));
    const supReturns = R(supLed.filter(l => l.Trans_Type === "RETURN_DEBIT_NOTE").reduce((s, l) => s + Util.num(l.Debit_Amount), 0));
    const supPaid = R(supLed.filter(l => l.Trans_Type === "PAYMENT_DEBIT").reduce((s, l) => s + Util.num(l.Debit_Amount), 0));
    const supBalance = R(purchasesNet - claims - supReturns - supPaid);
    const totalExp = R(expenses.reduce((s, e) => s + Util.num(e.Amount), 0));
    const collected = R(pays.filter(p => Util.num(p.Amount) > 0).reduce((s, p) => s + Util.num(p.Amount), 0));
    const refunds = R(-pays.filter(p => Util.num(p.Amount) < 0).reduce((s, p) => s + Util.num(p.Amount), 0));
    const byMethod = {};
    pays.forEach(p => byMethod[p.Payment_Method] = R((byMethod[p.Payment_Method] || 0) + Util.num(p.Amount)));
    const receivables = R(invoices.reduce((s, i) => s + Math.max(0, Util.num(i.Remaining_Balance)), 0));
    const creditsDue = R(invoices.reduce((s, i) => s + Util.num(i.Credit_Balance), 0));

    let stockQty = 0, stockVal = 0;
    const stockLines = [];
    Object.keys(snap).forEach(b => {
      const x = snap[b];
      if (x.onHand !== 0) { stockQty += x.onHand; stockVal += x.onHand * x.avgCost; stockLines.push({ bookId: b, onHand: x.onHand, reserved: x.reserved, free: x.free, avgCost: x.avgCost, value: R(x.onHand * x.avgCost) }); }
    });
    stockVal = R(stockVal);

    const today = Util.today();
    const aging = { notDue: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 };
    inst.forEach(i => {
      const rem = Util.num(i.Remaining_Inst_Amount);
      if (rem <= 0) return;
      const due = Util.str(i.Due_Date);
      if (due >= today) { aging.notDue += rem; return; }
      const days = (Util.parseDate(today) - Util.parseDate(due)) / 86400000;
      if (days <= 30) aging.d1_30 += rem; else if (days <= 60) aging.d31_60 += rem; else if (days <= 90) aging.d61_90 += rem; else aging.d90p += rem;
    });

    // الفائض المحاسبي = الإيراد − تكلفة المسلَّم − المصروفات − عجز الجرد
    // ملاحظة: الإيراد هنا يشمل المخصص غير المسلَّم؛ في نهاية الموسم يتساويان.
    const deliveredRevenue = R(items.reduce((s, i) => s + (Util.num(i.Delivered_Qty) - Util.num(i.Returned_Qty)) * Util.num(i.Unit_Emp_Price), 0));
    const surplus = R(deliveredRevenue - cogs - totalExp - shrink);
    const cashExpected = R(collected - refunds - supPaid - totalExp);

    const waiting = items.filter(i => !this.isCancelledItem_(i)).reduce((s, i) => s + Math.max(0, Util.num(i.Requested_Qty) - Math.max(Util.num(i.Allocated_Qty), Util.num(i.Delivered_Qty))), 0);
    const undelivered = items.filter(i => !this.isCancelledItem_(i)).reduce((s, i) => s + Math.max(0, Util.num(i.Allocated_Qty) - Util.num(i.Delivered_Qty)), 0);
    const openPO = DB_Engine.getAllRecords(S.PO_SNAPSHOT).filter(p => p.Line_Status === "Open").reduce((s, p) => s + Util.num(p.Outstanding_Qty), 0);
    const checklist = [
      { item: "لا توجد حجوزات منتظرة بلا تخصيص", ok: waiting === 0, value: waiting + " نسخة" },
      { item: "تم تسليم كل المخصص", ok: undelivered === 0, value: undelivered + " نسخة" },
      { item: "لا نواقص مفتوحة على المكتبة", ok: openPO === 0, value: openPO + " نسخة" },
      { item: "المخزن صفر (أُرجع المتبقي للمكتبة)", ok: stockQty === 0, value: stockQty + " نسخة بقيمة " + stockVal },
      { item: "رصيد المكتبة مُسوّى", ok: Math.abs(supBalance) < 0.01, value: supBalance + " ج.م" },
      { item: "لا مديونيات على الموظفين", ok: receivables === 0, value: receivables + " ج.م" },
      { item: "لا أرصدة دائنة للموظفين لم تُرد", ok: creditsDue === 0, value: creditsDue + " ج.م" }
    ];

    return {
      success: true,
      generatedAt: Util.now(),
      deficitBearer: st.DEFICIT_BEARER, cashHolder: st.CASH_ACCOUNT_HOLDER,
      pnl: { billedRevenue: revenue, deliveredRevenue: deliveredRevenue, cogs: cogs, expenses: totalExp, inventoryShrink: shrink, surplus: surplus, employeeSavings: savings },
      supplier: { purchasesNet: purchasesNet, damageClaims: claims, returns: supReturns, paid: supPaid, balance: supBalance },
      cash: { collected: collected, refunds: refunds, byMethod: byMethod, supplierPaid: supPaid, expenses: totalExp, expectedCashOnHand: cashExpected },
      receivables: { total: receivables, creditsDue: creditsDue, aging: aging },
      stock: { qty: stockQty, value: stockVal, lines: stockLines },
      reconciliation: {
        note: "النقدية المتوقعة لدى " + st.CASH_ACCOUNT_HOLDER + " = المحصل − المردود للموظفين − المدفوع للمكتبة − المصروفات. قارنها بالرصيد الفعلي للخزينة والمحفظة وإنستاباي.",
        expectedCashOnHand: cashExpected
      },
      checklist: checklist
    };
  }
};

// ============================================================================
// القسم 3: المهمة اليومية
// ============================================================================

function dailyMaintenanceJob() {
  DB_Engine.executeWithLock(() => {
    const S = SYSTEM_CONFIG.SHEETS;
    DB_Engine.getAllRecords(S.PHASES).forEach(p => {
      if (p.Phase_Status === "Open" && !Util.bool(p.Manual_Override)) {
        const en = Util.parseDate(p.End_DateTime);
        if (en && new Date() > en) DB_Engine.updateRecordByPK(S.PHASES, "Phase_ID", p.Phase_ID, { Phase_Status: "Closed" });
      }
    });
    const phasesWithInv = {};
    DB_Engine.getAllRecords(S.EMP_INVOICES).forEach(i => phasesWithInv[Util.str(i.Phase_ID)] = 1);
    Object.keys(phasesWithInv).forEach(ph => OperationsEngine.syncEmployeeInvoicesForPhase_(ph));
  });
}
