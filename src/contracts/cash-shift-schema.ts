import { MAX_DRAWER_AMOUNT, MAX_SHIFT_NOTE_LENGTH } from "@/src/domain/entities/CashShift";
import * as z from "@/src/lib/zod";

/**
 * Cash-shift contracts shared by the dashboard forms and the route handlers.
 * Amounts are whole Toman. Messages are `formErrors` keys.
 */

const amount = z
  .number()
  .check(z.int("amountWhole"), z.gte(0, "amountInvalid"), z.lte(MAX_DRAWER_AMOUNT, "amountTooLarge"));
const note = z.pipe(
  z.optional(z.string().check(z.trim(), z.maxLength(MAX_SHIFT_NOTE_LENGTH, "noteTooLong"))),
  z.transform((value) => (value ? value : undefined)),
);

export const openCashShiftSchema = z.object({ openingFloat: amount, note });
export type OpenCashShiftInput = z.input<typeof openCashShiftSchema>;

export const closeCashShiftSchema = z.object({ countedCash: amount, note });
export type CloseCashShiftInput = z.input<typeof closeCashShiftSchema>;
