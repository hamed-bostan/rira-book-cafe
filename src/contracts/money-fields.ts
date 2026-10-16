import { z } from "zod";

import { isCafeDay } from "@/src/domain/entities/CafeTime";

/**
 * Field types shared by the accounting and expense forms. Inputs arrive as the
 * strings form controls emit; outputs are whole Toman (numbers) and cafe days.
 */

/** Ten trillion Toman — far above any cafe amount, far below 2^53. */
export const MAX_MONEY_AMOUNT = 10_000_000_000_000;

const DIGITS = /^\d+$/;

/** A required amount in whole Toman, more than zero. */
export const moneyField = z
  .string()
  .trim()
  .min(1, "amountRequired")
  .regex(DIGITS, "amountInvalid")
  .transform(Number)
  .refine((n) => n > 0 && n <= MAX_MONEY_AMOUNT, "amountInvalid");

/** An optional amount: blank means zero. */
export const optionalMoneyField = z
  .string()
  .trim()
  .refine((value) => value === "" || DIGITS.test(value), "amountInvalid")
  .transform((value) => (value === "" ? 0 : Number(value)))
  .refine((n) => n <= MAX_MONEY_AMOUNT, "amountInvalid");

/** A cafe day, `YYYY-MM-DD` (what a date input emits). */
export const dayField = z.string().trim().min(1, "dateRequired").refine(isCafeDay, "dateInvalid");

/** Optional free text: trimmed, blank becomes `undefined`. */
export function optionalTextField(max: number) {
  return z
    .string()
    .trim()
    .max(max, "textTooLong")
    .transform((value) => (value.length > 0 ? value : undefined));
}
