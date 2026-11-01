import type { ExpenseFormInput, PayExpenseInput, SupplierFormInput } from "@/src/contracts/expense-schema";
import type { RecurringBillFormInput } from "@/src/contracts/recurring-bill-schema";
import type { Expense, Supplier } from "@/src/domain/entities/Expense";
import type { RecurringBill } from "@/src/domain/entities/RecurringBill";
import { apiPost, apiPut } from "@/src/lib/api/client";
import {
  expenseResponseSchema,
  supplierResponseSchema,
} from "@/src/presentation/dashboard/accounting/accounting-response-schema";

import { recurringBillResponseSchema } from "./expense-response-schema";

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

  /** Attach or replace the receipt; a blank URL removes it. Nothing posted changes. */
  setReceipt(id: string, receiptUrl: string): Promise<Expense> {
    return apiPut(`/admin/expenses/${id}/receipt`, { receiptUrl }, expenseResponseSchema);
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

export const recurringBillsApi = {
  create(values: RecurringBillFormInput): Promise<RecurringBill> {
    return apiPost("/admin/recurring-bills", values, recurringBillResponseSchema);
  },

  update(id: string, values: RecurringBillFormInput): Promise<RecurringBill> {
    return apiPut(`/admin/recurring-bills/${id}`, values, recurringBillResponseSchema);
  },

  /** Book a month of the bill as an expense, with the figures as they really came. */
  record(id: string, period: string, values: ExpenseFormInput): Promise<Expense> {
    return apiPost(`/admin/recurring-bills/${id}/record`, { ...values, period }, expenseResponseSchema);
  },

  /** Stop asking about a month; nothing is booked. */
  skip(id: string, period: string): Promise<void> {
    return apiPost(`/admin/recurring-bills/${id}/skip`, { period });
  },
};
