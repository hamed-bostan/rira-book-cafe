import { cafeDayOf, cafeDayRange, cafeDaysBetween, shiftCafeDay } from "./CafeTime";

/**
 * A guest's hold on a book from the shelf. A book that's out has a line, first
 * come, first served: when a copy comes back, the guest at the front is told it's
 * on the shelf and it's held for them. A copy on the shelf that nobody holds or
 * waits for, a guest borrows from the site instead: their hold starts out told.
 * Lending the book to them closes the hold, and lending it to anyone else skips them.
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
  /** The guest's profile (its id is their normalized phone); absent only on an old hold with no usable phone. */
  userId?: string;
  guestName: string;
  guestPhone: string;
  status: WaitlistStatus;
  /** ISO 8601 (UTC): when they were told it's back. */
  notifiedAt?: string;
  /** ISO 8601 (UTC): once told, the last instant they can collect it ({@link holdPickupDeadline}). */
  pickupBy?: string;
  /** ISO 8601 (UTC): when the jobs skipped them for not collecting it in time — the hold is `cancelled`. */
  expiredAt?: string;
  createdAt: string;
  updatedAt: string;
};

export function isOpenWaitlistEntry(entry: Pick<BookWaitlistEntry, "status">): boolean {
  return (OPEN_WAITLIST_STATUSES as readonly WaitlistStatus[]).includes(entry.status);
}

/**
 * How long a guest told their book is back has to collect it: until the end of
 * this many cafe days after the day they were told. Then the copy passes to the
 * next guest in line.
 */
export const HOLD_PICKUP_DAYS = 3;

/** The last instant a guest told at `notifiedAt` can collect the book: the end of the {@link HOLD_PICKUP_DAYS}th cafe day after. */
export function holdPickupDeadline(notifiedAt: Date): Date {
  const lastDay = shiftCafeDay(cafeDayOf(notifiedAt), HOLD_PICKUP_DAYS);
  return new Date(cafeDayRange(lastDay).to.getTime() - 1);
}

/**
 * Where a told guest's pickup deadline stands, for staff and the guest:
 * - `open` — days to go;
 * - `closing` — it's the last day or the one before it;
 * - `passed` — the deadline has gone and the jobs are about to skip them.
 */
export type HoldPickupState = "open" | "closing" | "passed";

/** Within this many cafe days of its last day a hold reads as `closing`. */
const HOLD_CLOSING_DAYS = 1;

export function holdPickupState(pickupBy: string, now: Date): HoldPickupState {
  const deadline = new Date(pickupBy);
  if (deadline < now) return "passed";
  return cafeDaysBetween(cafeDayOf(now), cafeDayOf(deadline)) <= HOLD_CLOSING_DAYS ? "closing" : "open";
}

/** Whether a told guest's time to collect has run out at `now`. */
export function isHoldPickupPassed(entry: Pick<BookWaitlistEntry, "status" | "pickupBy">, now: Date): boolean {
  return entry.status === "notified" && entry.pickupBy !== undefined && new Date(entry.pickupBy) < now;
}

/** Who a book is being lent to, as a hold knows them: their phone (normalized), and their account when they have one. */
export type HoldBorrower = { userId?: string; phone: string };

/** Whether `entry` is the hold of the guest the book is being lent to — the same phone, or the same account. */
export function isHoldFor(entry: Pick<BookWaitlistEntry, "userId" | "guestPhone">, borrower: HoldBorrower): boolean {
  return entry.guestPhone === borrower.phone || (borrower.userId !== undefined && entry.userId === borrower.userId);
}

/**
 * The told guests a loan leaves without a copy, told longest ago first. Each told
 * guest — one who borrowed from the site too — holds one of the `free` copies, so
 * lending one to anyone else takes the copy of the guest told first (more of them,
 * if more were told than copies are free). The borrower's own hold isn't among
 * them: lending to them fulfils it.
 */
export function holdsSkippedByLoan<T extends Pick<BookWaitlistEntry, "userId" | "guestPhone">>(
  free: number,
  told: readonly T[],
  borrower: HoldBorrower,
): T[] {
  const others = told.filter((entry) => !isHoldFor(entry, borrower));
  return others.slice(0, Math.max(0, others.length - (free - 1)));
}

/**
 * Whether a book's line takes another guest. Each told guest holds one of the free
 * copies, so a book with every copy out or held has a line, and so does one with
 * guests already waiting. A copy free beyond the held ones, with nobody waiting, is
 * for borrowing ({@link canBorrowBook}), not a hold.
 */
export function bookHasLine(free: number, line: readonly Pick<BookWaitlistEntry, "status">[]): boolean {
  const told = line.filter((entry) => entry.status === "notified").length;
  return free - told <= 0 || line.length > told;
}

/**
 * Whether a guest can borrow a book from the site: a copy is on the shelf that
 * nobody holds or waits for — exactly when the book has no line. Borrowing holds
 * that copy for them, as a told guest's is held.
 */
export function canBorrowBook(free: number, line: readonly Pick<BookWaitlistEntry, "status">[]): boolean {
  return !bookHasLine(free, line);
}

/**
 * The most books one guest may hold at once, across the shelf: places in a line
 * and copies held for them to collect alike. Borrowing, joining a line and staff
 * adding them to one are refused past it (`HOLD_LIMIT`), so nobody ties up the shelf.
 */
export const MAX_OPEN_HOLDS_PER_GUEST = 3;

/** Whether a guest with `open` holds (waiting or ready, any book) may take another. */
export function canHoldAnother(open: number): boolean {
  return open < MAX_OPEN_HOLDS_PER_GUEST;
}

/** A book's line as a guest sees it: how many copies are out, how long the line is, and their place in it. */
export type BookWaitlistStatus = {
  onLoan: number;
  /** Copies free on the shelf right now — some may be held for guests who were told. */
  onShelf: number;
  /** Guests in line (waiting or notified). */
  queueLength: number;
  /** Whether the line takes another guest ({@link bookHasLine}) — joining is refused exactly when it doesn't. */
  canJoin: boolean;
  /** Whether a copy is free for the guest to borrow ({@link canBorrowBook}) — always the opposite of `canJoin`. */
  canBorrow: boolean;
  /** The signed-in guest's open holds across every book (0 when signed out) — at {@link MAX_OPEN_HOLDS_PER_GUEST} they can't take another. */
  guestHolds: number;
  /** The signed-in guest's open entry, if they're in line. */
  entry: BookWaitlistEntry | null;
  /** 1-based place in line of that entry. */
  position: number | null;
};
