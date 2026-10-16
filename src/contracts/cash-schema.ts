import { z } from "zod";

import { countedMoneyField, dayField, optionalMoneyField, optionalTextField } from "./money-fields";

/**
 * Closing the till for a day: what was counted, what goes to the bank tonight
 * (blank: nothing), and a note on any difference. `expectedSeen` is sent only by
 * a manager's form that showed the expected amount, so the server can refuse the
 * close if cash moved since. The server recomputes everything else from the books.
 */
export const cashCloseSchema = z
  .object({
    day: dayField,
    counted: countedMoneyField,
    deposited: optionalMoneyField,
    note: optionalTextField(300),
    expectedSeen: z.number().int().optional(),
  })
  .refine((value) => value.deposited <= value.counted, { path: ["deposited"], message: "depositExceedsCount" });

export type CashCloseFormInput = z.input<typeof cashCloseSchema>;
export type CashCloseValues = z.output<typeof cashCloseSchema>;
