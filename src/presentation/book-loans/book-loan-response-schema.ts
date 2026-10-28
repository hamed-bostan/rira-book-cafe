import { z } from "zod/mini";

import { BOOK_LOAN_STATUSES, type BookLoan } from "@/src/domain/entities/BookLoan";
import type { LendableBook } from "@/src/domain/repositories/IBookLoanRepository";

/** What the book-loan endpoints return, validated at the typed-service boundary. */
export const bookLoanResponseSchema = z.object({
  id: z.string(),
  reference: z.number(),
  productId: z.string(),
  bookTitle: z.string(),
  bookAuthor: z.optional(z.string()),
  userId: z.optional(z.string()),
  borrowerName: z.string(),
  borrowerPhone: z.string(),
  lentAt: z.string(),
  dueAt: z.string(),
  status: z.enum(BOOK_LOAN_STATUSES),
  returnedAt: z.optional(z.string()),
  note: z.optional(z.string()),
  lentById: z.string(),
  lentByName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodMiniType<BookLoan>;

export const bookLoanListResponseSchema = z.array(bookLoanResponseSchema);

export const lendableBookListResponseSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    author: z.optional(z.string()),
    onLoan: z.number(),
    copies: z.number(),
  }) satisfies z.ZodMiniType<LendableBook>,
);
