// المجموعات كما في قسم «نموذج البيانات». الأسماء تبقى كما هي عند الانتقال إلى Firestore.
export const C = {
  seasons: 'bk_seasons',
  suppliers: 'bk_suppliers',
  books: 'bk_books',
  stages: 'bk_stages',
  bookingForms: 'bk_booking_forms',
  bookingLines: 'bk_booking_lines',
  purchaseOrders: 'bk_purchase_orders',
  supplierInvoices: 'bk_supplier_invoices',
  stockMoves: 'bk_stock_moves',
  employeeInvoices: 'bk_employee_invoices',
  creditNotes: 'bk_credit_notes',
  installments: 'bk_installments',
  receipts: 'bk_receipts',
  supplierLedger: 'bk_supplier_ledger',
  expenses: 'bk_expenses',
  cashClosings: 'bk_cash_closings',
  counters: 'bk_counters',
  auditLogs: 'audit_logs',
};

export const ALL_COLLECTIONS = Object.values(C);

// مستندات مالية: لا تُحذف أبدًا، والإلغاء بمستند عكسي.
export const FINANCIAL = new Set([
  C.purchaseOrders, C.supplierInvoices, C.stockMoves, C.employeeInvoices, C.creditNotes,
  C.installments, C.receipts, C.supplierLedger, C.expenses, C.cashClosings, C.counters, C.auditLogs,
]);

// مجموعات لا يُحذف منها شيء إطلاقًا في هذه المنظومة (الإيقاف بحقل active أو status).
export const NO_DELETE = new Set([...FINANCIAL, C.seasons, C.suppliers, C.books, C.stages, C.bookingForms, C.bookingLines]);
