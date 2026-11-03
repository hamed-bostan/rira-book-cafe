import { z } from "zod/mini";

import { INCOME_METHODS, INCOME_SOURCE_TYPES } from "@/src/domain/entities/Income";
import type { IncomeRefund } from "@/src/domain/entities/IncomeRefund";

/** What the refund endpoints return — one row per payment the refund was drawn from. */
export const incomeRefundResponseSchema: z.ZodMiniType<IncomeRefund> = z.object({
  id: z.string(),
  number: z.number(),
  incomeId: z.string(),
  incomeNumber: z.number(),
  sourceType: z.enum(INCOME_SOURCE_TYPES),
  sourceId: z.string(),
  date: z.string(),
  accountCode: z.string(),
  amount: z.number(),
  vatAmount: z.number(),
  method: z.enum(INCOME_METHODS),
  reason: z.optional(z.string()),
  payerName: z.optional(z.string()),
  createdById: z.string(),
  createdByName: z.string(),
  createdAt: z.string(),
});

export const incomeRefundListResponseSchema = z.array(incomeRefundResponseSchema);
