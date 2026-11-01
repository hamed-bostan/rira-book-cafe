import { z } from "zod/mini";

import {
  INCOME_METHODS,
  INCOME_SOURCE_TYPES,
  INCOME_STATUSES,
  type Income,
  type IncomeSummary,
} from "@/src/domain/entities/Income";
import type { Page } from "@/src/domain/entities/Pagination";

/** What the income endpoints return, validated at the typed-service boundary. */
export const incomeResponseSchema: z.ZodMiniType<Income> = z.object({
  id: z.string(),
  number: z.number(),
  date: z.string(),
  accountCode: z.string(),
  description: z.string(),
  amount: z.number(),
  vatAmount: z.number(),
  method: z.enum(INCOME_METHODS),
  payerName: z.optional(z.string()),
  sourceType: z.optional(z.enum(INCOME_SOURCE_TYPES)),
  sourceId: z.optional(z.string()),
  status: z.enum(INCOME_STATUSES),
  createdById: z.string(),
  createdByName: z.string(),
  createdAt: z.string(),
});

export type IncomePageWire = Page<Income> & { summary: IncomeSummary };

export const incomePageResponseSchema: z.ZodMiniType<IncomePageWire> = z.object({
  items: z.array(incomeResponseSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  summary: z.object({
    month: z.object({ fromDay: z.string(), toDay: z.string(), count: z.number(), total: z.number() }),
    counts: z.object({ received: z.number(), void: z.number() }),
  }),
});
