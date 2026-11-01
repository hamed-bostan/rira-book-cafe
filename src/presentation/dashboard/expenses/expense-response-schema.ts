import { z } from "zod/mini";

import type { ExpenseSummary, SupplierBalances } from "@/src/domain/entities/Expense";
import type { DueBill, RecurringBill } from "@/src/domain/entities/RecurringBill";

/** `GET /api/admin/expenses/summary` — the figures across the top of the Expenses page and its tab counts. */
export const expenseSummaryResponseSchema: z.ZodMiniType<ExpenseSummary> = z.object({
  owed: z.object({ count: z.number(), total: z.number() }),
  month: z.object({ fromDay: z.string(), toDay: z.string(), count: z.number(), total: z.number() }),
  counts: z.object({ unpaid: z.number(), paid: z.number(), void: z.number() }),
});

/** `GET /api/admin/suppliers/balances` — what's owed to each supplier. */
export const supplierBalancesResponseSchema: z.ZodMiniType<SupplierBalances> = z.object({
  suppliers: z.array(z.object({ supplierId: z.string(), billCount: z.number(), owed: z.number() })),
  noSupplier: z.object({ billCount: z.number(), owed: z.number() }),
  total: z.number(),
});

export const recurringBillResponseSchema: z.ZodMiniType<RecurringBill> = z.object({
  id: z.string(),
  description: z.string(),
  accountCode: z.string(),
  supplierId: z.optional(z.string()),
  supplierName: z.optional(z.string()),
  amount: z.number(),
  vatAmount: z.number(),
  dayOfMonth: z.number(),
  startsOn: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export const recurringBillListResponseSchema = z.array(recurringBillResponseSchema);

/** `GET /api/admin/recurring-bills/due` — the months waiting for someone. */
export const dueBillListResponseSchema: z.ZodMiniType<DueBill[]> = z.array(
  z.object({ bill: recurringBillResponseSchema, period: z.string(), dueOn: z.string() }),
);
