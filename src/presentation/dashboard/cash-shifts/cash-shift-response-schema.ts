import { z } from "zod/mini";

import { CASH_SHIFT_STATUSES, type CashShift, type CashShiftReport } from "@/src/domain/entities/CashShift";

/** What the cash-shift endpoints return, validated at the typed-service boundary. */
export const cashShiftResponseSchema = z.object({
  id: z.string(),
  number: z.number(),
  status: z.enum(CASH_SHIFT_STATUSES),
  openedAt: z.string(),
  openedById: z.string(),
  openedByName: z.string(),
  openingFloat: z.number(),
  closedAt: z.optional(z.string()),
  closedByName: z.optional(z.string()),
  expectedCash: z.optional(z.number()),
  countedCash: z.optional(z.number()),
  difference: z.optional(z.number()),
  note: z.optional(z.string()),
}) satisfies z.ZodMiniType<CashShift>;

export const cashShiftOverviewResponseSchema = z.object({
  current: z.nullable(
    z.object({
      shift: cashShiftResponseSchema,
      movements: z.object({ cash: z.number(), bank: z.number(), online: z.number(), payments: z.number() }),
      expectedCash: z.number(),
    }),
  ) satisfies z.ZodMiniType<CashShiftReport | null>,
  recent: z.array(cashShiftResponseSchema),
});

export type CashShiftOverview = z.infer<typeof cashShiftOverviewResponseSchema>;
