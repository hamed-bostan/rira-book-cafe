import { z } from "zod";

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
  closedAt: z.string().optional(),
  closedByName: z.string().optional(),
  expectedCash: z.number().optional(),
  countedCash: z.number().optional(),
  difference: z.number().optional(),
  note: z.string().optional(),
}) satisfies z.ZodType<CashShift>;

export const cashShiftOverviewResponseSchema = z.object({
  current: z
    .object({
      shift: cashShiftResponseSchema,
      movements: z.object({ cash: z.number(), bank: z.number(), online: z.number(), payments: z.number() }),
      expectedCash: z.number(),
    })
    .nullable() satisfies z.ZodType<CashShiftReport | null>,
  recent: z.array(cashShiftResponseSchema),
});

export type CashShiftOverview = z.infer<typeof cashShiftOverviewResponseSchema>;
