import { z } from "zod";

import { MAX_DRAWER_AMOUNT, MAX_SHIFT_NOTE_LENGTH } from "@/src/domain/entities/CashShift";

/**
 * Cash-shift contracts shared by the dashboard forms and the route handlers.
 * Amounts are whole Toman. Messages are `formErrors` keys.
 */

const amount = z.number().int("amountWhole").min(0, "amountInvalid").max(MAX_DRAWER_AMOUNT, "amountTooLarge");
const note = z
  .string()
  .trim()
  .max(MAX_SHIFT_NOTE_LENGTH, "noteTooLong")
  .optional()
  .transform((value) => (value ? value : undefined));

export const openCashShiftSchema = z.object({ openingFloat: amount, note });
export type OpenCashShiftInput = z.input<typeof openCashShiftSchema>;

export const closeCashShiftSchema = z.object({ countedCash: amount, note });
export type CloseCashShiftInput = z.input<typeof closeCashShiftSchema>;
