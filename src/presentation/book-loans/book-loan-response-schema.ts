import { z } from "zod";

import { BOOK_LOAN_STATUSES, type BookLoan } from "@/src/domain/entities/BookLoan";
import type { LendableBook } from "@/src/domain/repositories/IBookLoanRepository";

/** What the book-loan endpoints return, validated at the typed-service boundary. */
export const bookLoanResponseSchema = z.object({
  id: z.string(),
  reference: z.number(),
  productId: z.string(),
  bookTitle: z.string(),
  bookAuthor: z.string().optional(),
  userId: z.string().optional(),
  borrowerName: z.string(),
  borrowerPhone: z.string(),
  lentAt: z.string(),
  dueAt: z.string(),
  status: z.enum(BOOK_LOAN_STATUSES),
  returnedAt: z.string().optional(),
  note: z.string().optional(),
  lentById: z.string(),
  lentByName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodType<BookLoan>;

export const bookLoanListResponseSchema = z.array(bookLoanResponseSchema);

export const lendableBookListResponseSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    author: z.string().optional(),
    onLoan: z.number(),
    copies: z.number(),
  }) satisfies z.ZodType<LendableBook>,
);
