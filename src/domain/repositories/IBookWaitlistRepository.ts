import type { AuditHook } from "./AuditHook";
import type { BookWaitlistEntry } from "../entities/BookWaitlist";

/** A guest joining the line. Status and timestamps are the repository's. */
export type NewWaitlistEntry = Pick<
  BookWaitlistEntry,
  "productId" | "bookTitle" | "userId" | "guestName" | "guestPhone"
>;

export type IBookWaitlistRepository = {
  /**
   * Put the guest in line. A guest already in line for the book — by account or
   * by phone — is refused (`ConflictError("ALREADY_WAITING")`), enforced by unique indexes.
   */
  join(input: NewWaitlistEntry): Promise<BookWaitlistEntry>;
  /**
   * A guest borrows a copy from the site: their hold starts told — `notified` at
   * `at`, to collect by `holdPickupDeadline(at)` — and holds that copy. Decided
   * under the book's lending lock against the shelf as it is: refused with
   * `ConflictError("NO_FREE_COPY")` unless a copy is free that nobody holds or
   * waits for (`canBorrowBook`), `ALREADY_WAITING` for a guest already in its line,
   * and `ALREADY_ON_LOAN` for one who has it out — by phone, or by account.
   */
  borrow(input: NewWaitlistEntry, at: Date): Promise<BookWaitlistEntry>;
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
