import { z } from "zod/mini";

import type { ExpenseSummary } from "@/src/domain/entities/Expense";

/** `GET /api/admin/expenses/summary` — the figures across the top of the Expenses page and its tab counts. */
export const expenseSummaryResponseSchema: z.ZodMiniType<ExpenseSummary> = z.object({
  owed: z.object({ count: z.number(), total: z.number() }),
  month: z.object({ fromDay: z.string(), toDay: z.string(), count: z.number(), total: z.number() }),
  counts: z.object({ unpaid: z.number(), paid: z.number(), void: z.number() }),
});
