/**
 * A guest waiting for a book from the shelf that's out on loan. The queue is first
 * come, first served: when a copy comes back, the guest at the front is told it's
 * on the shelf, and lending it to them closes their place in line.
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
  userId: string;
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
