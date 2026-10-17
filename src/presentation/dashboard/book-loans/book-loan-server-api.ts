import type { BookLoan } from "@/src/domain/entities/BookLoan";
import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import type { BookLoanView, LendableBook } from "@/src/domain/repositories/IBookLoanRepository";
import { serverApiGet } from "@/src/lib/api/server-client";
import {
  bookLoanListResponseSchema,
  lendableBookListResponseSchema,
} from "@/src/presentation/book-loans/book-loan-response-schema";
import { bookWaitlistEntryListResponseSchema } from "@/src/presentation/book-loans/book-waitlist-response-schema";

/** Server-side lending reads for the dashboard (BFF), fetched during server render. */
export const bookLoansServerApi = {
  /** The lending book in one view, optionally searched. */
  list(view: BookLoanView, q?: string): Promise<BookLoan[]> {
    return serverApiGet("/admin/book-loans", bookLoanListResponseSchema, { params: q ? { view, q } : { view } });
  },

  /** Every book in the catalog, for the lend form's picker. */
  listBooks(): Promise<LendableBook[]> {
    return serverApiGet("/admin/book-loans/books", lendableBookListResponseSchema);
  },

  /** Everyone in line for a book, grouped by book. */
  listWaitlist(): Promise<BookWaitlistEntry[]> {
    return serverApiGet("/admin/book-waitlist", bookWaitlistEntryListResponseSchema);
  },
};
