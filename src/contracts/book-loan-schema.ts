import { z } from "zod";

import { BOOK_LOAN_STATUSES, MAX_BORROWER_NAME_LENGTH, MAX_LOAN_NOTE_LENGTH } from "@/src/domain/entities/BookLoan";
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

/** Staff closing a loan. */
export const bookLoanUpdateSchema = z.object({
  status: z.enum(BOOK_LOAN_STATUSES, { message: "statusInvalid" }),
});

export type BookLoanUpdateInput = z.input<typeof bookLoanUpdateSchema>;
