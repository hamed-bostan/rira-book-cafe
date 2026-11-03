import type { Income, IncomeMethod, IncomeSourceType } from "./Income";

/**
 * Money handed back from what a guest paid for a suite stay or an event sign-up —
 * all of it, or part. Each refund is drawn from one payment (an income row): its
 * entry takes the amount back out of that payment's revenue account, with the VAT
 * inside it out of VAT payable, and out of the cash register or the bank. A refund
 * bigger than one payment has left is drawn from several, one row each.
 */

export const MAX_REFUND_REASON_LENGTH = 200;

export type IncomeRefund = {
  id: string;
  /** Sequential number staff refer to ("RF-7"). */
  number: number;
  /** The payment it's drawn from, and that payment's number ("IN-14"). */
  incomeId: string;
  incomeNumber: number;
  /** The booking that payment was for. */
  sourceType: IncomeSourceType;
  sourceId: string;
  /** The cafe day it was handed back, `YYYY-MM-DD`. */
  date: string;
  /** The payment's revenue account, which the refund comes back out of. */
  accountCode: string;
  /** Handed back, VAT included, in whole Toman. */
  amount: number;
  /** The VAT inside `amount`. */
  vatAmount: number;
  /** How it went back — not necessarily how it came in. */
  method: IncomeMethod;
  reason?: string;
  /** Who it went back to, from the payment. */
  payerName?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
};

/** A payment on a booking, with what has already been handed back from it. */
export type RefundablePayment = Pick<
  Income,
  "id" | "number" | "accountCode" | "amount" | "vatAmount" | "payerName" | "createdAt"
> & {
  refunded: number;
  refundedVat: number;
};

/** One payment's share of a refund. */
export type RefundPortion = {
  payment: RefundablePayment;
  amount: number;
  vatAmount: number;
};

/** What can still be handed back from these payments. */
export function refundableOf(payments: readonly RefundablePayment[]): number {
  return payments.reduce((sum, payment) => sum + Math.max(payment.amount - payment.refunded, 0), 0);
}

/**
 * How a refund of `amount` is drawn from a booking's payments: the newest payment
 * first, each up to what it has left. Each share hands back the VAT inside it in
 * the payment's own proportion — worked out on the running total, so a payment
 * refunded in full, in however many parts, gives back exactly the VAT it carried.
 * `null` when `amount` is more than the payments have left.
 */
export function planRefund(payments: readonly RefundablePayment[], amount: number): RefundPortion[] | null {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > refundableOf(payments)) return null;
  const newestFirst = [...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.number - a.number);

  const portions: RefundPortion[] = [];
  let left = amount;
  for (const payment of newestFirst) {
    if (left === 0) break;
    const share = Math.min(payment.amount - payment.refunded, left);
    if (share <= 0) continue;
    const vatThrough = Math.round(((payment.refunded + share) * payment.vatAmount) / payment.amount);
    const vatAmount = Math.min(
      Math.max(vatThrough - payment.refundedVat, 0),
      share,
      payment.vatAmount - payment.refundedVat,
    );
    portions.push({ payment, amount: share, vatAmount });
    left -= share;
  }
  return portions;
}

/** What a booking has taken and given back, from the payment reads on the staff lists. */
export type PaidAndRefunded = { paidAmount?: number; refundedAmount?: number };

/** What the guest has paid and not had back. */
export function netPaid(booking: PaidAndRefunded): number {
  return Math.max((booking.paidAmount ?? 0) - (booking.refundedAmount ?? 0), 0);
}
