import { z } from "zod/mini";

import { PAYMENT_SOURCES } from "@/src/domain/entities/Expense";
import type { JournalEntry } from "@/src/domain/entities/Ledger";
import { PAY_RUN_STATUSES, type Employee, type PayRun, type PayRunDraft } from "@/src/domain/entities/Payroll";
import { journalEntryResponseSchema } from "@/src/presentation/dashboard/accounting/accounting-response-schema";

/** What the payroll endpoints return, checked at the BFF boundary. */

export const employeeResponseSchema: z.ZodMiniType<Employee> = z.object({
  id: z.string(),
  name: z.string(),
  position: z.optional(z.string()),
  phone: z.optional(z.string()),
  monthlySalary: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export const employeeListResponseSchema = z.array(employeeResponseSchema);

const payRunLineSchema = z.object({
  employeeId: z.string(),
  employeeName: z.string(),
  gross: z.number(),
  employeeInsurance: z.number(),
  incomeTax: z.number(),
  employerInsurance: z.number(),
});

export const payRunResponseSchema: z.ZodMiniType<PayRun> = z.object({
  id: z.string(),
  period: z.string(),
  date: z.string(),
  status: z.enum(PAY_RUN_STATUSES),
  lines: z.array(payRunLineSchema),
  paidAmount: z.number(),
  paidFrom: z.optional(z.enum(PAYMENT_SOURCES)),
  paidOn: z.optional(z.string()),
  createdById: z.string(),
  createdByName: z.string(),
  createdAt: z.string(),
});
export const payRunListResponseSchema = z.array(payRunResponseSchema);

export type PayRunDetailWire = { run: PayRun; entries: JournalEntry[] };
export const payRunDetailResponseSchema: z.ZodMiniType<PayRunDetailWire> = z.object({
  run: payRunResponseSchema,
  entries: z.array(journalEntryResponseSchema),
});

export const payRunDraftResponseSchema: z.ZodMiniType<PayRunDraft> = z.object({
  periods: z.array(z.object({ period: z.string(), date: z.string() })),
  lines: z.array(
    z.object({
      employeeId: z.string(),
      employeeName: z.string(),
      position: z.optional(z.string()),
      gross: z.number(),
      employeeInsurance: z.number(),
      incomeTax: z.number(),
      employerInsurance: z.number(),
    }),
  ),
});
