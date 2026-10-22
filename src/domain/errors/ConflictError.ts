/**
 * The request was well-formed but the current state refuses it: a table already
 * booked for that time, an event that's full, a status change the workflow
 * doesn't allow. Nothing was changed. `code` is the machine-readable reason the
 * client localizes; the presentation layer answers 409.
 */
export class ConflictError extends Error {
  constructor(
    public readonly code: ConflictCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ConflictError";
  }
}

export type ConflictCode =
  | "TABLE_TAKEN"
  // A guest booking asked for a table an event holds at that time.
  | "TABLE_HELD"
  | "SUITE_TAKEN"
  | "ALREADY_ON_LOAN"
  | "EVENT_FULL"
  | "EVENT_CLOSED"
  | "ALREADY_REGISTERED"
  | "INVALID_TRANSITION"
  | "ALREADY_POSTED"
  | "ALREADY_REVERSED"
  | "NOT_REVERSIBLE"
  | "PERIOD_CLOSED"
  | "ACCOUNT_INACTIVE"
  | "UNBALANCED"
  | "NOT_PAYABLE"
  | "PAYMENT_IN_PROGRESS"
  | "STOCK_USED"
  | "YEAR_NOT_ENDED"
  // Reviews: only guests who've had the item may review it.
  | "NOT_PURCHASED"
  // Promo codes and loyalty points at checkout.
  | "PROMO_INVALID"
  | "PROMO_EXPIRED"
  | "PROMO_USED_UP"
  | "PROMO_MIN_SUBTOTAL"
  | "NOT_ENOUGH_POINTS"
  | "LOYALTY_DISABLED"
  // The book waitlist.
  | "ALREADY_WAITING"
  | "BOOK_ON_SHELF"
  // Every copy of the book is out — the guest joins its line instead.
  | "ALL_COPIES_OUT"
  // Cash shifts.
  | "SHIFT_ALREADY_OPEN"
  | "NO_OPEN_SHIFT"
  // Bank reconciliation.
  | "STATEMENT_OVERLAP"
  | "STATEMENT_RECONCILED"
  | "ALREADY_MATCHED"
  | "MATCH_UNBALANCED"
  | "NOT_RECONCILED"
  | "PREVIOUS_NOT_RECONCILED";
