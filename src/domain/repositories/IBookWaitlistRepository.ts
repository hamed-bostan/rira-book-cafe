import type { BookWaitlistEntry } from "../entities/BookWaitlist";

/** A guest joining the line. Status and timestamps are the repository's. */
export type NewWaitlistEntry = Pick<BookWaitlistEntry, "productId" | "bookTitle" | "userId" | "guestName" | "guestPhone">;

export type IBookWaitlistRepository = {
  /**
   * Put the guest in line. A guest already in line for the book is refused
   * (`ConflictError("ALREADY_WAITING")`) — enforced by a unique index.
   */
  join(input: NewWaitlistEntry): Promise<BookWaitlistEntry>;
  getById(id: string): Promise<BookWaitlistEntry | null>;
  /** One guest's entries, newest first. */
  listForUser(userId: string): Promise<BookWaitlistEntry[]>;
  /** Everyone in line for one book, front of the line first. */
  listOpenForBook(productId: string): Promise<BookWaitlistEntry[]>;
  /** Everyone in line for anything, grouped by book, front of each line first — the dashboard's view. */
  listOpen(): Promise<BookWaitlistEntry[]>;
  /** Take an open entry out of line. Returns `null` when it was no longer open. */
  cancel(id: string): Promise<BookWaitlistEntry | null>;
  /**
   * A copy came back: move the guest at the front of the line who hasn't been told
   * yet to `notified`. Serialized per book, so two returns tell two guests.
   * `null` when nobody is waiting.
   */
  notifyNext(productId: string, at: Date): Promise<BookWaitlistEntry | null>;
  /** The book was lent to this guest (by account or phone): their open entry is `fulfilled`. */
  fulfill(productId: string, borrower: { userId?: string; phone: string }): Promise<void>;
};
