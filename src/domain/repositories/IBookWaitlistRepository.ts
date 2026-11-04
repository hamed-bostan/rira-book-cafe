import type { AuditHook } from "./AuditHook";
import type { BookWaitlistEntry } from "../entities/BookWaitlist";
import type { NewGuestProfile } from "../entities/GuestProfile";

/**
 * A guest taking a hold, on their profile. Status and timestamps are the
 * repository's. With `newGuest`, the profile is made in the hold's own
 * transaction, so a refused hold leaves none behind.
 */
export type NewWaitlistEntry = Pick<BookWaitlistEntry, "productId" | "bookTitle" | "guestName" | "guestPhone"> & {
  userId: string;
  newGuest?: NewGuestProfile;
};

export type IBookWaitlistRepository = {
  /**
   * Put the guest in the book's line, `waiting`. Decided under the guest's and the
   * book's locks against the shelf as it is, refusing:
   * - `ALREADY_ON_LOAN` for a guest who has the book out, by phone or by profile;
   * - `ALREADY_WAITING` for one already in its line (unique indexes back this up);
   * - `HOLD_LIMIT` for one already holding as many books as one may (`canHoldAnother`);
   * - `BOOK_ON_SHELF` when the book has no line to join (`bookHasLine`) — a copy is
   *   free that nobody holds or waits for: it's borrowed or lent instead.
   */
  join(input: NewWaitlistEntry): Promise<BookWaitlistEntry>;
  /**
   * A guest borrows a copy from the site: their hold starts told — `notified` at
   * `at`, to collect by `holdPickupDeadline(at)` — and holds that copy. Decided as
   * {@link join} is, refusing the same way except that the book must have a copy
   * free that nobody holds or waits for (`canBorrowBook`), else `NO_FREE_COPY`.
   */
  borrow(input: NewWaitlistEntry, at: Date): Promise<BookWaitlistEntry>;
  /** How many open holds (waiting or ready, any book) the guest has. */
  countOpenForUser(userId: string): Promise<number>;
  getById(id: string): Promise<BookWaitlistEntry | null>;
  /** One guest's entries, newest first. */
  listForUser(userId: string): Promise<BookWaitlistEntry[]>;
  /** Everyone in line for one book, front of the line first. */
  listOpenForBook(productId: string): Promise<BookWaitlistEntry[]>;
  /** Everyone in line for anything, grouped by book, front of each line first — the dashboard's view. Never capped. */
  listOpen(): Promise<BookWaitlistEntry[]>;
  /** Lines that closed (borrowed or cancelled) since `since`, newest first — the dashboard's Closed tab. */
  listClosedSince(since: Date): Promise<BookWaitlistEntry[]>;
  /**
   * Take an open entry out of line, under the book's lending lock. Returns the
   * cancelled entry — its `notifiedAt` says whether they'd been told — or `null`
   * when it was no longer open.
   */
  cancel(id: string): Promise<BookWaitlistEntry | null>;
  /**
   * Skip a told guest whose time to collect ran out: cancel the hold as expired at
   * `at` (`expiredAt`), under the book's lending lock — only while they're still
   * told and their `pickupBy` is before `at`, so one who borrowed it meanwhile is
   * left alone (`null`). The audit entry commits with it.
   */
  expireHold(id: string, at: Date, audit?: AuditHook<BookWaitlistEntry>): Promise<BookWaitlistEntry | null>;
  /**
   * A copy came back: move the guest at the front of the line who hasn't been told
   * yet to `notified`, with the day they must collect it by (`holdPickupDeadline`).
   * Serialized per book, so two returns tell two guests. `null` when nobody is waiting.
   */
  notifyNext(productId: string, at: Date): Promise<BookWaitlistEntry | null>;
};
