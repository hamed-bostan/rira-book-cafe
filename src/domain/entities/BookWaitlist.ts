/**
 * A guest waiting for a book from the shelf that's out on loan. The queue is first
 * come, first served: when a copy comes back, the guest at the front is told it's
 * on the shelf and it's held for them; lending it to them closes their place in
 * line, and lending it to anyone else skips them.
 */

/**
 * - `waiting` — in line.
 * - `notified` — told the book is back; it's theirs to collect.
 * - `fulfilled` — they borrowed it. Terminal.
 * - `cancelled` — they left the line, or staff took them off it. Terminal.
 */
export const WAITLIST_STATUSES = ["waiting", "notified", "fulfilled", "cancelled"] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

/** Statuses that hold a place in line. */
export const OPEN_WAITLIST_STATUSES = ["waiting", "notified"] as const satisfies readonly WaitlistStatus[];

export type BookWaitlistEntry = {
  id: string;
  productId: string;
  /** The book's title when they joined. */
  bookTitle: string;
  /** The guest's account; absent for a hold staff added for a guest at the counter or by phone. */
  userId?: string;
  guestName: string;
  guestPhone: string;
  status: WaitlistStatus;
  /** ISO 8601 (UTC): when they were told it's back. */
  notifiedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export function isOpenWaitlistEntry(entry: Pick<BookWaitlistEntry, "status">): boolean {
  return (OPEN_WAITLIST_STATUSES as readonly WaitlistStatus[]).includes(entry.status);
}

/** Who a book is being lent to, as a hold knows them: their phone (normalized), and their account when they have one. */
export type HoldBorrower = { userId?: string; phone: string };

/** Whether `entry` is the hold of the guest the book is being lent to — the same phone, or the same account. */
export function isHoldFor(entry: Pick<BookWaitlistEntry, "userId" | "guestPhone">, borrower: HoldBorrower): boolean {
  return entry.guestPhone === borrower.phone || (borrower.userId !== undefined && entry.userId === borrower.userId);
}

/**
 * The told guests a loan leaves without a copy, told longest ago first. Each told
 * guest holds one of the `free` copies, so lending one to anyone else takes the
 * copy of the guest told first (more of them, if more were told than copies are
 * free). The borrower's own hold isn't among them: lending to them fulfils it.
 */
export function holdsSkippedByLoan<T extends Pick<BookWaitlistEntry, "userId" | "guestPhone">>(
  free: number,
  told: readonly T[],
  borrower: HoldBorrower,
): T[] {
  const others = told.filter((entry) => !isHoldFor(entry, borrower));
  return others.slice(0, Math.max(0, others.length - (free - 1)));
}

/** A book's line as a guest sees it: how many copies are out, how long the line is, and their place in it. */
export type BookWaitlistStatus = {
  onLoan: number;
  /** Guests in line (waiting or notified). */
  queueLength: number;
  /** The signed-in guest's open entry, if they're in line. */
  entry: BookWaitlistEntry | null;
  /** 1-based place in line of that entry. */
  position: number | null;
};
