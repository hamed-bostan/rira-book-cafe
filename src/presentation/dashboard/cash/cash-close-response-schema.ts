import { z } from "zod";

import { CASH_GROUPS, type CashClose, type CashCloseStatus, type CashDayFigures, type CashGroup } from "@/src/domain/entities/CashClose";
import { JOURNAL_SOURCES } from "@/src/domain/entities/Ledger";
import type { Page } from "@/src/domain/entities/Pagination";
import { pageResponseSchema } from "@/src/lib/api/page-response-schema";

/** What the cash register endpoints return, checked at the BFF boundary. */

export const cashCloseResponseSchema: z.ZodType<CashClose> = z.object({
  id: z.string(),
  day: z.string(),
  openingFloat: z.number(),
  cashIn: z.number(),
  cashOut: z.number(),
  expected: z.number(),
  counted: z.number(),
  difference: z.number(),
  deposited: z.number(),
  closingFloat: z.number(),
  entryId: z.string().optional(),
  entryNumber: z.number().optional(),
  note: z.string().optional(),
  closedById: z.string(),
  closedByName: z.string(),
  closedAt: z.string(),
});
export const cashClosePageResponseSchema: z.ZodType<Page<CashClose>> = pageResponseSchema(cashCloseResponseSchema);

export const cashCloseStatusResponseSchema: z.ZodType<CashCloseStatus> = z.object({
  today: z.string(),
  lastClosedDay: z.string().optional(),
  todayClosed: z.boolean(),
  unclosedDays: z.array(z.string()),
});

const breakdownSchema = z.object(Object.fromEntries(CASH_GROUPS.map((group) => [group, z.number()])) as Record<CashGroup, z.ZodNumber>);

export const cashDayResponseSchema: z.ZodType<CashDayFigures> = z.object({
  day: z.string(),
  openingFloat: z.number(),
  cashIn: z.number(),
  cashOut: z.number(),
  expected: z.number(),
  breakdown: breakdownSchema,
  lines: z.array(
    z.object({
      entryId: z.string(),
      number: z.number(),
      description: z.string(),
      source: z.enum(JOURNAL_SOURCES),
      debit: z.number(),
      credit: z.number(),
    }),
  ),
});
