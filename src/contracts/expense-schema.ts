import { isReceiptUrl, MAX_EXPENSE_DESCRIPTION_LENGTH, PAYMENT_SOURCES } from "@/src/domain/entities/Expense";
import * as z from "@/src/lib/zod";

import { fieldsParsed } from "./fields-parsed";
import { dayField, moneyField, optionalMoneyField, optionalTextField } from "./money-fields";

/** How an expense was settled when it was recorded: on account, or paid now. */
export const EXPENSE_PAYMENT_CHOICES = ["unpaid", ...PAYMENT_SOURCES] as const;

/** A receipt in the receipts folder; blank or left out means none. */
const receiptUrlField = z
  .pipe(
    z.optional(z.string().check(z.trim())),
    z.transform((value) => value || undefined),
  )
  .check(z.refine((value) => value === undefined || isReceiptUrl(value), "imageInvalid"));

/** What a bill says, whether it's being recorded or set up to recur. */
export const billFields = {
  supplierId: z.pipe(
    z.string().check(z.trim()),
    z.transform((value) => (value === "" ? undefined : value)),
  ),
  accountCode: z.string().check(z.trim(), z.minLength(1, "accountRequired")),
  description: z
    .string()
    .check(z.trim(), z.minLength(1, "descriptionRequired"), z.maxLength(MAX_EXPENSE_DESCRIPTION_LENGTH, "textTooLong")),
  amount: moneyField,
  vatAmount: optionalMoneyField,
};

/** The VAT is part of the total, so it must be less than it. */
export const vatBelowTotal = z.refine<{ amount: number; vatAmount: number }>(
  (value) => value.vatAmount < value.amount,
  {
    path: ["vatAmount"],
    error: "vatTooHigh",
    when: fieldsParsed("amount", "vatAmount"),
  },
);

/**
 * Recording a bill or purchase. `amount` is the total paid or owed, VAT included;
 * `vatAmount` is the VAT on the invoice (blank: none), which must be less than it.
 */
export const expenseSchema = z.pipe(
  z
    .object({
      date: dayField,
      ...billFields,
      payment: z.enum(EXPENSE_PAYMENT_CHOICES, { error: "paymentInvalid" }),
      receiptUrl: receiptUrlField,
    })
    .check(vatBelowTotal),
  z.transform(({ payment, ...rest }) => ({ ...rest, paidFrom: payment === "unpaid" ? undefined : payment })),
);

export type ExpenseFormInput = z.input<typeof expenseSchema>;

/** Attaching a receipt to a recorded expense, replacing its receipt, or (blank) removing it. */
export const expenseReceiptSchema = z.object({ receiptUrl: receiptUrlField });

/** Paying an owed expense; a blank amount pays all of it. */
export const payExpenseSchema = z.object({
  source: z.enum(PAYMENT_SOURCES, { error: "paymentInvalid" }),
  paidOn: dayField,
  amount: z._default(optionalMoneyField, 0),
});

export type PayExpenseInput = z.input<typeof payExpenseSchema>;

/** Voiding an expense entered by mistake; the reason goes on the reversing entries. */
export const voidExpenseSchema = z.object({
  reason: z.string().check(z.trim(), z.maxLength(200, "textTooLong")),
});

export const supplierSchema = z.object({
  name: z.string().check(z.trim(), z.minLength(1, "nameRequired"), z.maxLength(120, "textTooLong")),
  phone: optionalTextField(30),
  note: optionalTextField(300),
  isActive: z.boolean(),
});

export type SupplierFormInput = z.input<typeof supplierSchema>;
