import {
  BOOK_LOAN_STATUSES,
  LOAN_DEPOSIT_METHODS,
  MAX_LOAN_DAYS,
  MAX_LOAN_NOTE_LENGTH,
} from "@/src/domain/entities/BookLoan";
import { isCafeDay } from "@/src/domain/entities/CafeTime";
import * as z from "@/src/lib/zod";

import { fieldsParsed } from "./fields-parsed";
import { guestNameField, guestPhoneField } from "./guest-schema";
import { optionalMoneyField } from "./money-fields";

/**
 * Book-loan contracts shared by the route handlers and the dashboard form. The due
 * date travels as a cafe day (`YYYY-MM-DD`). Messages are `formErrors` keys.
 */

/** How a book goes out, whoever takes it: when it's due back, a note, and a deposit if one was taken. */
const loanTermsFields = z.object({
  dueOn: z.string().check(z.refine(isCafeDay, "dateInvalid")),
  note: z.pipe(
    z.optional(z.string().check(z.trim(), z.maxLength(MAX_LOAN_NOTE_LENGTH, "noteTooLong"))),
    z.transform((value) => (value ? value : undefined)),
  ),
  depositAmount: z._default(optionalMoneyField, 0),
  depositMethod: z.optional(z.enum(LOAN_DEPOSIT_METHODS, { error: "paymentInvalid" })),
});

/** A deposit, when one was taken, says how it was paid. */
const depositNeedsMethod = {
  check: (value: { depositAmount: number; depositMethod?: string }): boolean =>
    value.depositAmount === 0 || value.depositMethod !== undefined,
  issue: { path: ["depositMethod"], error: "paymentInvalid", when: fieldsParsed("depositAmount", "depositMethod") },
};

/** Staff lending a book to the guest `GuestField` found by phone — with their name, when it's a new one. */
export const lendBookSchema = z
  .extend(loanTermsFields, {
    productId: z.string().check(z.minLength(1, "bookRequired")),
    borrowerPhone: guestPhoneField,
    borrowerName: guestNameField,
  })
  .check(z.refine(depositNeedsMethod.check, depositNeedsMethod.issue));

export type LendBookInput = z.input<typeof lendBookSchema>;

/** Staff handing a told guest the book held for them ("Lend now"): the guest is the hold's. */
export const lendHoldSchema = loanTermsFields.check(z.refine(depositNeedsMethod.check, depositNeedsMethod.issue));

export type LendHoldInput = z.input<typeof lendHoldSchema>;

/**
 * Staff closing a loan (`status`), giving the borrower more time (`extendDays`),
 * or taking that back from its toast (`undoExtend`: the due time before, and the
 * one the extension set — ISO instants).
 */
export const bookLoanUpdateSchema = z
  .object({
    status: z.optional(z.enum(BOOK_LOAN_STATUSES, { error: "statusInvalid" })),
    extendDays: z.optional(
      z.number().check(z.int("extendInvalid"), z.gte(1, "extendInvalid"), z.lte(MAX_LOAN_DAYS, "extendInvalid")),
    ),
    undoExtend: z.optional(
      z.object({
        dueAt: z.string().check(z.iso.datetime({ error: "dateInvalid" })),
        extendedDueAt: z.string().check(z.iso.datetime({ error: "dateInvalid" })),
      }),
    ),
  })
  // One change at a time: close the loan, extend it, or take an extension back.
  .check(
    z.refine((data) => [data.status, data.extendDays, data.undoExtend].filter((v) => v !== undefined).length === 1, {
      error: "nothingToChange",
    }),
  );

export type BookLoanUpdateInput = z.input<typeof bookLoanUpdateSchema>;

/** Staff adding a guest who asked at the counter or by phone to a book's line, found by phone as a loan's is. */
export const addBookHoldSchema = z.object({
  productId: z.string().check(z.minLength(1, "bookRequired")),
  guestPhone: guestPhoneField,
  guestName: guestNameField,
});

export type AddBookHoldInput = z.input<typeof addBookHoldSchema>;
