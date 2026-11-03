/**
 * A book lent from the cafe's shelf: staff hand a guest a book, note who took it
 * and when it's due back, and close the loan when it comes home (or is lost).
 * The record is the answer to "who has this book?".
 */

/**
 * - `out` — the guest has the book. Overdue is derived (past `dueAt`), not stored.
 * - `returned` — back on the shelf. Terminal.
 * - `lost` — written off, and its copy off the shelf. Can still turn into
 *   `returned` if it reappears, which puts the copy back.
 */
export const BOOK_LOAN_STATUSES = ["out", "returned", "lost"] as const;
export type BookLoanStatus = (typeof BOOK_LOAN_STATUSES)[number];

/** How long a loan runs when staff don't pick a date. */
export const DEFAULT_LOAN_DAYS = 14;
/** The longest loan staff can set. */
export const MAX_LOAN_DAYS = 60;
export const MAX_BORROWER_NAME_LENGTH = 80;
export const MAX_LOAN_NOTE_LENGTH = 300;

/** Where a deposit was paid into, and handed back from. */
export const LOAN_DEPOSIT_METHODS = ["cash", "bank"] as const;
export type LoanDepositMethod = (typeof LOAN_DEPOSIT_METHODS)[number];

/**
 * A deposit left against the book. It isn't the cafe's money while the loan runs:
 * - `held` — the book is out; the deposit sits on Deposits held.
 * - `returned` — the book came back, and the deposit was handed back.
 * - `kept` — the book was lost; the deposit became income.
 */
export const LOAN_DEPOSIT_STATES = ["held", "returned", "kept"] as const;
export type LoanDepositState = (typeof LOAN_DEPOSIT_STATES)[number];

/** Where a deposit stands once a loan moves to `status`. */
export function depositStateFor(status: BookLoanStatus): LoanDepositState {
  if (status === "lost") return "kept";
  return status === "returned" ? "returned" : "held";
}

export type BookLoan = {
  id: string;
  /** Short sequential number staff refer to (`L-12`). */
  reference: number;
  productId: string;
  /** The book's title and author, snapshotted when it was lent. */
  bookTitle: string;
  bookAuthor?: string;
  /** The guest's account, when their phone matches one — lets them see their loans. */
  userId?: string;
  borrowerName: string;
  borrowerPhone: string;
  /** ISO 8601 (UTC). */
  lentAt: string;
  /** ISO 8601 (UTC): the end of the due day on the cafe calendar. */
  dueAt: string;
  status: BookLoanStatus;
  /** When it came back. */
  returnedAt?: string;
  /** Condition when lent, etc. */
  note?: string;
  /** Whole Toman left against the book; 0 when none was taken. */
  depositAmount: number;
  depositMethod?: LoanDepositMethod;
  depositState?: LoanDepositState;
  /** Who handed it over. */
  lentById: string;
  lentByName: string;
  createdAt: string;
  updatedAt: string;
};

const TRANSITIONS: Record<BookLoanStatus, readonly BookLoanStatus[]> = {
  out: ["returned", "lost"],
  lost: ["returned"],
  returned: [],
};

export function canTransitionBookLoan(from: BookLoanStatus, to: BookLoanStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * How closing a loan moves its book's copies to lend: a copy written off comes off
 * the shelf (-1), and one that turns up after being written off goes back on (+1).
 * A book that simply comes back was never taken off, so it moves nothing.
 */
export function lendingCopiesChange(from: BookLoanStatus, to: BookLoanStatus): number {
  if (from === "out" && to === "lost") return -1;
  if (from === "lost" && to === "returned") return 1;
  return 0;
}

/** The statuses staff may move a loan to from here, in the order the UI offers them. */
export function nextBookLoanStatuses(status: BookLoanStatus): readonly BookLoanStatus[] {
  return TRANSITIONS[status];
}

/** Still out and past its due time. */
export function isBookLoanOverdue(loan: Pick<BookLoan, "status" | "dueAt">, now: Date): boolean {
  return loan.status === "out" && new Date(loan.dueAt) < now;
}
