import type { BookLoan } from "@/src/domain/entities/BookLoan";
import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import type { BookLoanCounts, BookLoanView, LendableBook } from "@/src/domain/repositories/IBookLoanRepository";
import { serverApiGet } from "@/src/lib/api/server-client";
import {
  bookLoanListResponseSchema,
  lendableBookListResponseSchema,
} from "@/src/presentation/book-loans/book-loan-response-schema";
import { bookWaitlistEntryListResponseSchema } from "@/src/presentation/book-loans/book-waitlist-response-schema";

import { bookLoanCountsResponseSchema } from "./book-loan-counts-response-schema";

/** Server-side lending reads for the dashboard (BFF), fetched during server render. */
export const bookLoansServerApi = {
  /** The lending book in one view, optionally searched. */
  list(view: BookLoanView, q?: string): Promise<BookLoan[]> {
    return serverApiGet("/admin/book-loans", bookLoanListResponseSchema, { params: q ? { view, q } : { view } });
  },

  /** How many loans each view holds, over every loan whatever the search — the tabs' counts. */
  getCounts(): Promise<BookLoanCounts> {
    return serverApiGet("/admin/book-loans/counts", bookLoanCountsResponseSchema);
  },

  /** Every book in the catalog, for the lend form's picker. */
  listBooks(): Promise<LendableBook[]> {
    return serverApiGet("/admin/book-loans/books", lendableBookListResponseSchema);
  },

  /** Everyone in line for a book, grouped by book. */
  listWaitlist(): Promise<BookWaitlistEntry[]> {
    return serverApiGet("/admin/book-waitlist", bookWaitlistEntryListResponseSchema);
  },

  /** Holds that closed in the last two months (borrowed or cancelled), newest first. */
  listClosedWaitlist(): Promise<BookWaitlistEntry[]> {
    return serverApiGet("/admin/book-waitlist", bookWaitlistEntryListResponseSchema, { params: { view: "closed" } });
  },
};
