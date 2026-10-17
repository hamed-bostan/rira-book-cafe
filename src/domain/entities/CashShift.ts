/**
 * A till shift: the drawer is opened with a float, and at the end of the shift
 * it's counted. What it *should* hold is the float plus everything the Cash
 * account moved while the shift was open (cash payments in, cash refunds and
 * cash-paid bills out); the count against that is the shift's over or short,
 * which is booked when the shift closes. One drawer, so one open shift at a time.
 */

export const CASH_SHIFT_STATUSES = ["open", "closed"] as const;
export type CashShiftStatus = (typeof CASH_SHIFT_STATUSES)[number];

/** A generous ceiling on a float or a count, in Toman — a typo guard, not a policy. */
export const MAX_DRAWER_AMOUNT = 10_000_000_000;
export const MAX_SHIFT_NOTE_LENGTH = 300;

export type CashShift = {
  id: string;
  /** Sequential number staff refer to (`Z-12`). */
  number: number;
  status: CashShiftStatus;
  /** ISO 8601 (UTC). */
  openedAt: string;
  openedById: string;
  openedByName: string;
  /** Cash in the drawer when it opened, Toman. */
  openingFloat: number;
  closedAt?: string;
  closedByName?: string;
  /** At close: what the drawer should hold, what was counted, and counted − expected. */
  expectedCash?: number;
  countedCash?: number;
  difference?: number;
  note?: string;
};

/**
 * What moved during a shift, from the books. `cash` is the Cash account's net
 * movement (in − out); `bank` and `online` are what order payments put into the
 * bank (card, card-to-card) and the gateway, net of refunds — the "Z report".
 */
export type ShiftMovements = {
  cash: number;
  bank: number;
  online: number;
  /** Payments taken (net of reversals) — how many orders were settled. */
  payments: number;
};

/** A shift with its live (or final) figures. */
export type CashShiftReport = {
  shift: CashShift;
  movements: ShiftMovements;
  /** Float + cash movement: what the drawer should hold now (or held at close). */
  expectedCash: number;
};

export function expectedDrawer(openingFloat: number, movements: Pick<ShiftMovements, "cash">): number {
  return openingFloat + movements.cash;
}
