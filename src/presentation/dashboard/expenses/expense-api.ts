import type { ExpenseFormInput, PayExpenseInput, SupplierFormInput } from "@/src/contracts/expense-schema";
import type { Expense, Supplier } from "@/src/domain/entities/Expense";
import { apiPost, apiPut } from "@/src/lib/api/client";
import { expenseResponseSchema, supplierResponseSchema } from "@/src/presentation/dashboard/accounting/accounting-response-schema";

/** Typed client for expense writes; each books its journal entries server-side. */
export const expensesApi = {
  create(values: ExpenseFormInput): Promise<Expense> {
    return apiPost("/admin/expenses", values, expenseResponseSchema);
  },

  pay(id: string, values: PayExpenseInput): Promise<Expense> {
    return apiPost(`/admin/expenses/${id}/pay`, values, expenseResponseSchema);
  },

  /** Reverses everything the expense posted, dated today. */
  void(id: string, reason: string): Promise<Expense> {
    return apiPost(`/admin/expenses/${id}/void`, { reason }, expenseResponseSchema);
  },
};

export const suppliersApi = {
  create(values: SupplierFormInput): Promise<Supplier> {
    return apiPost("/admin/suppliers", values, supplierResponseSchema);
  },

  update(id: string, values: SupplierFormInput): Promise<Supplier> {
    return apiPut(`/admin/suppliers/${id}`, values, supplierResponseSchema);
  },
};
