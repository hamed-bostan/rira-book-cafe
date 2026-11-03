import { INCOME_METHODS } from "@/src/domain/entities/Income";
import { MAX_REFUND_REASON_LENGTH } from "@/src/domain/entities/IncomeRefund";
import { RESERVATION_DEPOSIT_METHODS } from "@/src/domain/entities/ReservationDeposit";
import { isSuiteNightlyRate } from "@/src/domain/entities/SuitePricing";
import * as z from "@/src/lib/zod";

import { moneyField, optionalTextField } from "./money-fields";

/**
 * Money on bookings, shared by the route handlers and the dashboard dialogs: a
 * table deposit, the suite's nightly price, and a refund of a stay or a sign-up.
 * Amounts arrive as typed (digits, Latin by the time they're sent); messages are
 * `formErrors` keys.
 */

/** Taking a deposit on a table booking: how much, and how it was paid at the counter. */
export const reservationDepositSchema = z.object({
  amount: moneyField,
  method: z.enum(RESERVATION_DEPOSIT_METHODS, { error: "paymentInvalid" }),
});
export type ReservationDepositInput = z.input<typeof reservationDepositSchema>;

/** A held deposit, once the booking is over: handed back, or kept. */
export const reservationDepositSettleSchema = z.object({
  settle: z.enum(["returned", "kept"], { error: "statusInvalid" }),
});
export type ReservationDepositSettleInput = z.input<typeof reservationDepositSettleSchema>;

/** What a night costs, in whole Toman — zero for a stay on the house. */
export const suiteRateSchema = z.object({
  nightlyRate: z
    .pipe(
      z.string().check(z.trim(), z.minLength(1, "amountRequired"), z.regex(/^\d+$/, "amountInvalid")),
      z.transform(Number),
    )
    .check(z.refine(isSuiteNightlyRate, "amountInvalid")),
});
export type SuiteRateInput = z.input<typeof suiteRateSchema>;

/** Money handed back from a stay or a sign-up: how much, how, and why (optional). */
export const refundSchema = z.object({
  amount: moneyField,
  method: z.enum(INCOME_METHODS, { error: "paymentInvalid" }),
  reason: z.optional(optionalTextField(MAX_REFUND_REASON_LENGTH)),
});
export type RefundFormInput = z.input<typeof refundSchema>;
