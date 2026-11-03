import type { BookLoan } from "@/src/domain/entities/BookLoan";
import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import type { Page } from "@/src/domain/entities/Pagination";
import type { BookLoanCounts, LendableBook } from "@/src/domain/repositories/IBookLoanRepository";
import { pageResponseSchema } from "@/src/lib/api/page-response-schema";
import { serverApiGet } from "@/src/lib/api/server-client";
import {
  bookLoanResponseSchema,
  lendableBookListResponseSchema,
} from "@/src/presentation/book-loans/book-loan-response-schema";
import { bookWaitlistEntryListResponseSchema } from "@/src/presentation/book-loans/book-waitlist-response-schema";

import { bookLoanCountsResponseSchema } from "./book-loan-counts-response-schema";

const bookLoanPageResponseSchema = pageResponseSchema(bookLoanResponseSchema);

/** Server-side lending reads for the dashboard (BFF), fetched during server render. */
export const bookLoansServerApi = {
  /** One page of a view of the lending book: the view, search and paging the page's query string carries. */
  listPage(params: URLSearchParams): Promise<Page<BookLoan>> {
    return serverApiGet("/admin/book-loans", bookLoanPageResponseSchema, { params: Object.fromEntries(params) });
  },

  /** How many loans each view holds, over every loan whatever the search — the tabs' counts. */
  getCounts(): Promise<BookLoanCounts> {
    return serverApiGet("/admin/book-loans/counts", bookLoanCountsResponseSchema);
  },

  /** Every book in the catalog, for the lend form's picker — with its copies out, and the one due back first. */
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
