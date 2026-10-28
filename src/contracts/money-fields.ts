import { isCafeDay } from "@/src/domain/entities/CafeTime";
import * as z from "@/src/lib/zod";

/**
 * Field types shared by the accounting and expense forms. Inputs arrive as the
 * strings form controls emit; outputs are whole Toman (numbers) and cafe days.
 */

/** Ten trillion Toman — far above any cafe amount, far below 2^53. */
export const MAX_MONEY_AMOUNT = 10_000_000_000_000;

const DIGITS = /^\d+$/;

/** A required amount in whole Toman, more than zero. */
export const moneyField = z
  .pipe(
    z.string().check(z.trim(), z.minLength(1, "amountRequired"), z.regex(DIGITS, "amountInvalid")),
    z.transform(Number),
  )
  .check(z.refine((n) => n > 0 && n <= MAX_MONEY_AMOUNT, "amountInvalid"));

/** An optional amount: blank means zero. */
export const optionalMoneyField = z
  .pipe(
    z.string().check(
      z.trim(),
      z.refine((value) => value === "" || DIGITS.test(value), "amountInvalid"),
    ),
    z.transform((value) => (value === "" ? 0 : Number(value))),
  )
  .check(z.refine((n) => n <= MAX_MONEY_AMOUNT, "amountInvalid"));

const SIGNED_DIGITS = /^-?\d+$/;

/** A required signed amount — a balance, which can be overdrawn. "-" is money out. */
export const balanceField = z
  .pipe(
    z.string().check(z.trim(), z.minLength(1, "amountRequired"), z.regex(SIGNED_DIGITS, "amountInvalid")),
    z.transform(Number),
  )
  .check(z.refine((n) => Math.abs(n) <= MAX_MONEY_AMOUNT, "amountInvalid"));

/** A signed movement: positive in, negative out, never zero. */
export const signedAmountField = balanceField.check(z.refine((n) => n !== 0, "amountInvalid"));

/** A cafe day, `YYYY-MM-DD` (what a date input emits). */
export const dayField = z.string().check(z.trim(), z.minLength(1, "dateRequired"), z.refine(isCafeDay, "dateInvalid"));

/** Optional free text: trimmed, blank becomes `undefined`. */
export function optionalTextField(max: number) {
  return z.pipe(
    z.string().check(z.trim(), z.maxLength(max, "textTooLong")),
    z.transform((value) => (value.length > 0 ? value : undefined)),
  );
}

/** A quantity above zero as typed: "18", "0.5", "1000" (up to 3 decimals). */
export const quantityField = z
  .pipe(z.string().check(z.trim(), z.regex(/^\d+(\.\d{1,3})?$/, "quantityInvalid")), z.transform(Number))
  .check(z.refine((n) => n > 0 && n <= 10_000_000, "quantityInvalid"));

/** A counted quantity: zero or more. */
export const countField = z
  .pipe(z.string().check(z.trim(), z.regex(/^\d+(\.\d{1,3})?$/, "quantityInvalid")), z.transform(Number))
  .check(z.refine((n) => n <= 10_000_000, "quantityInvalid"));
