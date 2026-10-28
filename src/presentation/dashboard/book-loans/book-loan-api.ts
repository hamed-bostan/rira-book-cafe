import type { AddBookHoldInput, BookLoanUpdateInput, LendBookInput } from "@/src/contracts/book-loan-schema";
import type { BookLoan } from "@/src/domain/entities/BookLoan";
import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import { apiDelete, apiPatch, apiPost } from "@/src/lib/api/client";
import { bookLoanResponseSchema } from "@/src/presentation/book-loans/book-loan-response-schema";
import { bookWaitlistEntryResponseSchema } from "@/src/presentation/book-loans/book-waitlist-response-schema";

/** Typed client for the dashboard's lending mutations; components `router.refresh()` after. */
export const bookLoansApi = {
  /** Record a loan. 409 `ALREADY_ON_LOAN` when that borrower has the book, `ALL_COPIES_OUT` when none is left. */
  create(values: LendBookInput): Promise<BookLoan> {
    return apiPost("/admin/book-loans", values, bookLoanResponseSchema);
  },

  /** Mark returned or lost, extend by `extendDays`, or take that back (`undoExtend`). 409 for a refused transition. */
  update(id: string, values: BookLoanUpdateInput): Promise<BookLoan> {
    return apiPatch(`/admin/book-loans/${id}`, values, bookLoanResponseSchema);
  },

  /** Add a counter or phone guest to a book's line. 409 `BOOK_ON_SHELF` / `ALREADY_WAITING`. */
  addHold(values: AddBookHoldInput): Promise<BookWaitlistEntry> {
    return apiPost("/admin/book-waitlist", values, bookWaitlistEntryResponseSchema);
  },

  /** Take a guest off a book's line; skipping someone who'd been told tells the next. */
  removeFromWaitlist(entryId: string): Promise<void> {
    return apiDelete(`/admin/book-waitlist/${entryId}`);
  },
};
