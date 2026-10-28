import { z } from "zod";

import {
  BOOK_LOAN_STATUSES,
  MAX_BORROWER_NAME_LENGTH,
  MAX_LOAN_DAYS,
  MAX_LOAN_NOTE_LENGTH,
} from "@/src/domain/entities/BookLoan";
import { isCafeDay } from "@/src/domain/entities/CafeTime";
import { isPlausiblePhone } from "@/src/domain/entities/Phone";

/**
 * Book-loan contracts shared by the route handlers and the dashboard form. The due
 * date travels as a cafe day (`YYYY-MM-DD`). Messages are `formErrors` keys.
 */

/** Staff lending a book. */
export const lendBookSchema = z.object({
  productId: z.string().min(1, "bookRequired"),
  borrowerName: z.string().trim().min(1, "nameRequired").max(MAX_BORROWER_NAME_LENGTH, "nameTooLong"),
  borrowerPhone: z.string().trim().refine(isPlausiblePhone, "phoneInvalid"),
  dueOn: z.string().refine(isCafeDay, "dateInvalid"),
  note: z
    .string()
    .trim()
    .max(MAX_LOAN_NOTE_LENGTH, "noteTooLong")
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type LendBookInput = z.input<typeof lendBookSchema>;

/**
 * Staff closing a loan (`status`), giving the borrower more time (`extendDays`),
 * or taking that back from its toast (`undoExtend`: the due time before, and the
 * one the extension set — ISO instants).
 */
export const bookLoanUpdateSchema = z
  .object({
    status: z.enum(BOOK_LOAN_STATUSES, { error: "statusInvalid" }).optional(),
    extendDays: z.number().int("extendInvalid").min(1, "extendInvalid").max(MAX_LOAN_DAYS, "extendInvalid").optional(),
    undoExtend: z
      .object({
        dueAt: z.string().datetime({ error: "dateInvalid" }),
        extendedDueAt: z.string().datetime({ error: "dateInvalid" }),
      })
      .optional(),
  })
  // One change at a time: close the loan, extend it, or take an extension back.
  .refine((data) => [data.status, data.extendDays, data.undoExtend].filter((v) => v !== undefined).length === 1, {
    error: "nothingToChange",
  });

export type BookLoanUpdateInput = z.input<typeof bookLoanUpdateSchema>;

/** Staff adding a guest who asked at the counter or by phone to a book's line. */
export const addBookHoldSchema = z.object({
  productId: z.string().min(1, "bookRequired"),
  guestName: z.string().trim().min(1, "nameRequired").max(MAX_BORROWER_NAME_LENGTH, "nameTooLong"),
  guestPhone: z.string().trim().refine(isPlausiblePhone, "phoneInvalid"),
});

export type AddBookHoldInput = z.input<typeof addBookHoldSchema>;
