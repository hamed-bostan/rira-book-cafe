import type { AuditHook } from "./AuditHook";
import type { BookLoan, BookLoanStatus } from "../entities/BookLoan";

/** A loan about to be recorded. Id, reference, status, return time and timestamps are the repository's. */
export type NewBookLoan = Omit<BookLoan, "id" | "reference" | "status" | "returnedAt" | "createdAt" | "updatedAt">;

/** A book on the shelf staff can lend — the loan form's picker. */
export type LendableBook = {
  id: string;
  title: string;
  author?: string;
  /** Copies of it out right now. */
  onLoan: number;
  /** Copies the shelf lends (`lendingCopies`). */
  copies: number;
};

/** Which loans a list shows. `open` is everything still out, overdue or not. */
export const BOOK_LOAN_VIEWS = ["open", "overdue", "returned", "lost", "all"] as const;
export type BookLoanView = (typeof BOOK_LOAN_VIEWS)[number];

export type BookLoanFilters = {
  view: BookLoanView;
  /** Matches the borrower's name or phone, or the book's title. */
  q?: string;
};

export type IBookLoanRepository = {
  /**
   * Record a loan. Refuses a second open loan of the same book to the same phone
   * (`ConflictError("ALREADY_ON_LOAN")`) — enforced in the database, so two staff
   * recording the same hand-over can't both succeed — and a book whose every copy
   * is out (`ConflictError("ALL_COPIES_OUT")`), checked under the same per-book lock.
   */
  create(input: NewBookLoan, audit?: AuditHook<BookLoan>): Promise<BookLoan>;
  getById(id: string): Promise<BookLoan | null>;
  /** Loans for the dashboard, newest first; `open`/`overdue` soonest-due first. */
  list(filters: BookLoanFilters, now: Date): Promise<BookLoan[]>;
  /** One guest's loans (matched by account), newest first. */
  listForUser(userId: string): Promise<BookLoan[]>;
  /** Every book in the catalog, published or not, with how many copies are out. */
  listLendableBooks(): Promise<LendableBook[]>;
  /** How many copies of the book are out right now. */
  countOpenForBook(productId: string): Promise<number>;
  /** The book's title, author and lending copies, or `null` when the id isn't a book. */
  getBook(productId: string): Promise<{ title: string; author?: string; copies: number } | null>;
  /** Move an open loan's due time (`ConflictError("INVALID_TRANSITION")` once it's closed). */
  extend(id: string, dueAt: string, audit?: AuditHook<BookLoan>): Promise<BookLoan>;
  /**
   * Move a loan to a new status, guarded on `expectedStatus` so a concurrent change
   * can't be overwritten (`ConflictError("INVALID_TRANSITION")`). `returnedAt` is
   * set when it becomes `returned`.
   */
  applyStatus(
    id: string,
    expectedStatus: BookLoanStatus,
    status: BookLoanStatus,
    at: Date,
    audit?: AuditHook<BookLoan>,
  ): Promise<BookLoan>;
};
