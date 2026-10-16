import type { Supplier } from "@/src/domain/entities/Expense";
import { ApiError } from "@/src/lib/api/ApiError";
import { serverApiGet } from "@/src/lib/api/server-client";
import {
  expenseDetailResponseSchema,
  expensePageResponseSchema,
  supplierListResponseSchema,
  type ExpenseDetailWire,
  type ExpensePageWire,
} from "@/src/presentation/dashboard/accounting/accounting-response-schema";

/** Server-side expense and supplier reads for the dashboard (BFF). */
export const expensesServerApi = {
  list(params: Record<string, string>): Promise<ExpensePageWire> {
    return serverApiGet("/admin/expenses", expensePageResponseSchema, { params });
  },

  /** An expense with the entries it posted; `null` on 404. */
  async getById(id: string): Promise<ExpenseDetailWire | null> {
    try {
      return await serverApiGet(`/admin/expenses/${id}`, expenseDetailResponseSchema);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
};

export const suppliersServerApi = {
  list(includeInactive: boolean): Promise<Supplier[]> {
    return serverApiGet("/admin/suppliers", supplierListResponseSchema, includeInactive ? { params: { all: "true" } } : undefined);
  },
};
