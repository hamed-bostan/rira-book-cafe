import { isBillPeriod, MAX_BILL_DAY } from "@/src/domain/entities/RecurringBill";
import * as z from "@/src/lib/zod";

import { billFields, vatBelowTotal } from "./expense-schema";

/** Setting up or editing a bill that comes round every Persian month. */
export const recurringBillSchema = z
  .object({
    ...billFields,
    dayOfMonth: z
      .int({ error: "billDayInvalid" })
      .check(z.gte(1, "billDayInvalid"), z.lte(MAX_BILL_DAY, "billDayInvalid")),
    isActive: z.boolean(),
  })
  .check(vatBelowTotal);

export type RecurringBillFormInput = z.input<typeof recurringBillSchema>;

/** Which month of a bill is being recorded or skipped: "1405-08". */
export const billPeriodSchema = z.object({
  period: z.string({ error: "billNotDue" }).check(z.refine(isBillPeriod, "billNotDue")),
});
