import type { PaymentMethod } from "./Order";
import type { ReservationStatus } from "./Reservation";

/**
 * Money a guest leaves against a table booking — for a big party, a busy night or
 * a set menu. Like a book loan's deposit, it isn't the cafe's while the booking
 * runs: it sits on Deposits held until the booking is over, then it's handed back
 * or kept (a no-show fee, a late cancellation, or towards the bill, as agreed).
 */

/** How it was paid, at the counter — a deposit is never taken online. */
export const RESERVATION_DEPOSIT_METHODS = ["cash", "card", "transfer"] as const satisfies readonly PaymentMethod[];
export type ReservationDepositMethod = (typeof RESERVATION_DEPOSIT_METHODS)[number];

/**
 * - `held` — the cafe holds it, a liability, until the booking is over.
 * - `returned` — handed back to the guest. Terminal.
 * - `kept` — the cafe kept it, as income. Terminal.
 */
export const RESERVATION_DEPOSIT_STATES = ["held", "returned", "kept"] as const;
export type ReservationDepositState = (typeof RESERVATION_DEPOSIT_STATES)[number];

/** What a held deposit can become. */
export type ReservationDepositSettlement = Exclude<ReservationDepositState, "held">;

export type ReservationDeposit = {
  /** Whole Toman, more than zero. */
  amount: number;
  method: ReservationDepositMethod;
  state: ReservationDepositState;
};

/** A deposit can be taken any time before the party has left or failed to come. */
export const DEPOSIT_TAKING_STATUSES = [
  "requested",
  "confirmed",
  "seated",
] as const satisfies readonly ReservationStatus[];

/** A held deposit is settled once the booking is over: the party left, never came, or it was cancelled. */
export const DEPOSIT_SETTLING_STATUSES = [
  "completed",
  "noShow",
  "cancelled",
] as const satisfies readonly ReservationStatus[];

type WithDeposit = { status: ReservationStatus; deposit?: ReservationDeposit };

/** Whether staff may take a deposit on this booking: it's still on, and it has none yet. */
export function canTakeReservationDeposit(reservation: WithDeposit): boolean {
  return !reservation.deposit && (DEPOSIT_TAKING_STATUSES as readonly string[]).includes(reservation.status);
}

/** Whether the booking's deposit is held and the booking is over, so it can be handed back or kept. */
export function canSettleReservationDeposit(reservation: WithDeposit): boolean {
  return (
    reservation.deposit?.state === "held" &&
    (DEPOSIT_SETTLING_STATUSES as readonly string[]).includes(reservation.status)
  );
}
