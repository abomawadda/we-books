// الأدوار كما في المواصفات (قسم «الأدوار والصلاحيات»).
export const ROLES = {
  employee: 'الموظف',
  manager: 'مدير المبادرة',
  storekeeper: 'أمين المخزن',
  treasurer: 'أمين الخزينة',
  auditor: 'المراجع المالي',
};

// من يملك الكتابة في كل مجموعة. المراجع لا يكتب في أي مجموعة.
export const WRITE_ACCESS = {
  bk_seasons: ['manager'],
  bk_suppliers: ['manager'],
  bk_books: ['manager'],
  bk_stages: ['manager'],
  bk_booking_forms: ['employee', 'manager'],
  bk_booking_lines: ['employee', 'manager'],
  bk_purchase_orders: ['manager'],
  bk_supplier_invoices: ['storekeeper'],
  bk_stock_moves: ['storekeeper'],
  bk_employee_invoices: ['manager'],
  bk_credit_notes: ['storekeeper', 'manager'],
  bk_installments: ['manager', 'treasurer'],
  bk_receipts: ['treasurer'],
  bk_supplier_ledger: ['manager', 'storekeeper'],
  bk_expenses: ['manager'],
  bk_cash_closings: ['treasurer'],
};

export function canWrite(role, collection) {
  return (WRITE_ACCESS[collection] ?? []).includes(role);
}
