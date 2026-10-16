import type { BookLoanUpdateInput, LendBookInput } from "@/src/contracts/book-loan-schema";
import type { BookLoan } from "@/src/domain/entities/BookLoan";
import { apiPatch, apiPost } from "@/src/lib/api/client";
import { bookLoanResponseSchema } from "@/src/presentation/book-loans/book-loan-response-schema";

/** Typed client for the dashboard's lending mutations; components `router.refresh()` after. */
export const bookLoansApi = {
  /** Record a loan. 409 `ALREADY_ON_LOAN` when that borrower already has the book. */
  create(values: LendBookInput): Promise<BookLoan> {
    return apiPost("/admin/book-loans", values, bookLoanResponseSchema);
  },

  /** Mark returned or lost. 409 for a refused transition. */
  update(id: string, values: BookLoanUpdateInput): Promise<BookLoan> {
    return apiPatch(`/admin/book-loans/${id}`, values, bookLoanResponseSchema);
  },
};
