/**
 * The request was well-formed but the current state refuses it: a table already
 * booked for that time, an event that's full, a status change the workflow
 * doesn't allow. Nothing was changed. `code` is the machine-readable reason the
 * client localizes; the presentation layer answers 409. `fields` names the form
 * fields the refusal is about (`unit`, `lines.2.ingredientId`), when it's about
 * some, so a form can show it on them.
 */
export class ConflictError extends Error {
  public readonly fields: readonly string[];

  constructor(
    public readonly code: ConflictCode,
    message: string,
    options?: { cause?: unknown; fields?: readonly string[] },
  ) {
    super(message, options);
    this.name = "ConflictError";
    this.fields = options?.fields ?? [];
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
  // A message to a guest whose phone on the booking, loan or order isn't the one staff saw.
  | "GUEST_CHANGED"
  | "INVALID_TRANSITION"
  // A no-show or a check-in before the guest was due (a booking's start, a stay's arrival day).
  | "NOT_DUE_YET"
  | "ALREADY_POSTED"
  | "ALREADY_REVERSED"
  | "NOT_REVERSIBLE"
  | "PERIOD_CLOSED"
  | "ACCOUNT_INACTIVE"
  | "UNBALANCED"
  | "NOT_PAYABLE"
  | "PAYMENT_IN_PROGRESS"
  | "STOCK_USED"
  // A refund of an order whose sale was never booked.
  | "NOT_REFUNDABLE"
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
  // A guest borrowing from the site: every copy is out or held, or guests wait for one.
  | "NO_FREE_COPY"
  // "Lend now" for a hold that's no longer the guest's to collect.
  | "HOLD_NOT_READY"
  // A guest already holding as many books as one may (MAX_OPEN_HOLDS_PER_GUEST).
  | "HOLD_LIMIT"
  // A book still out on loan or with guests in line can't be deleted.
  | "BOOK_IN_USE"
  // A book's copies to lend can't go below the copies of it out on loan.
  | "COPIES_BELOW_ON_LOAN"
  // Cash shifts.
  | "SHIFT_ALREADY_OPEN"
  | "NO_OPEN_SHIFT"
  // Bank reconciliation.
  | "STATEMENT_OVERLAP"
  | "STATEMENT_RECONCILED"
  | "ALREADY_MATCHED"
  | "MATCH_UNBALANCED"
  | "NOT_RECONCILED"
  | "PREVIOUS_NOT_RECONCILED"
  // Changing an order after it was placed. Lines change only while it's unpaid and
  // being worked; table and service until it's served. A line that went out stays,
  // an order can't be left empty, and a change its promo code or the points it spent
  // can't price is refused — the order is cancelled and placed again instead.
  | "ORDER_LINES_LOCKED"
  | "ORDER_CLOSED"
  | "ITEM_SERVED"
  | "ORDER_EMPTY"
  | "PROMO_NO_LONGER_APPLIES"
  | "POINTS_EXCEED_TOTAL"
  // Stock items. Every quantity on record is in the item's unit, so it's fixed once
  // the item holds stock or has moved; an item holding stock, or in a published
  // item's recipe, can't be switched off; opening stock is only for an item with
  // no history yet.
  | "UNIT_LOCKED"
  | "STOCK_ON_HAND"
  | "INGREDIENT_IN_RECIPE"
  | "STOCK_HAS_HISTORY";
