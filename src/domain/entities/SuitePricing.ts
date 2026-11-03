import { netPaid } from "./IncomeRefund";
import { suiteNights, type SuiteBooking } from "./SuiteBooking";

/**
 * What a suite stay costs. The suite has one nightly price, set in the dashboard's
 * pricing settings; each stay snapshots it when it's made (or confirmed, for one
 * from before the suite had a price), and staff who keep the books can change it
 * for one stay. A stay's total is never stored: it's always its nights times its
 * own rate, so a stay moved to other dates prices itself.
 */

/** What a night costs until the dashboard says otherwise. */
export const DEFAULT_SUITE_NIGHTLY_RATE = 2_500_000;
/** A billion Toman a night — far above any real price, well inside a BIGINT. */
export const MAX_SUITE_NIGHTLY_RATE = 1_000_000_000;

export type SuiteSettings = {
  /** Whole Toman a night; what new stays are priced at. */
  nightlyRate: number;
};

/** Whether a rate is one a stay or the suite can be priced at: whole Toman, zero (free) or more. */
export function isSuiteNightlyRate(rate: number): boolean {
  return Number.isSafeInteger(rate) && rate >= 0 && rate <= MAX_SUITE_NIGHTLY_RATE;
}

type PricedStay = Pick<SuiteBooking, "checkIn" | "checkOut" | "nightlyRate">;

/** The stay's total: its nights times its rate. `undefined` for a stay with no rate. */
export function suiteStayTotal(stay: PricedStay): number | undefined {
  if (stay.nightlyRate === undefined) return undefined;
  return suiteNights(stay.checkIn, stay.checkOut) * stay.nightlyRate;
}

/** A stay's money as the desk reads it. */
export type SuiteStayMoney = {
  /** Nights × rate; absent for a stay with no rate. */
  total?: number;
  paid: number;
  refunded: number;
  /** What the guest still owes (negative: paid more than the stay costs); absent without a total. */
  balance?: number;
};

/**
 * What a stay costs, what's been paid and handed back, and what's left to pay. A
 * stay that ended without the guest staying (cancelled, no-show) owes nothing.
 */
export function suiteStayMoney(
  stay: PricedStay & Pick<SuiteBooking, "status" | "paidAmount" | "refundedAmount">,
): SuiteStayMoney {
  const total = suiteStayTotal(stay);
  const paid = stay.paidAmount ?? 0;
  const refunded = stay.refundedAmount ?? 0;
  const owed = stay.status === "cancelled" || stay.status === "noShow" ? 0 : total;
  return { total, paid, refunded, balance: owed === undefined ? undefined : owed - netPaid(stay) };
}
