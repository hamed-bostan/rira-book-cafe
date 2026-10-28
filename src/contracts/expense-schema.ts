import { MAX_EXPENSE_DESCRIPTION_LENGTH, PAYMENT_SOURCES } from "@/src/domain/entities/Expense";
import * as z from "@/src/lib/zod";

import { fieldsParsed } from "./fields-parsed";
import { dayField, moneyField, optionalMoneyField, optionalTextField } from "./money-fields";

/** How an expense was settled when it was recorded: on account, or paid now. */
export const EXPENSE_PAYMENT_CHOICES = ["unpaid", ...PAYMENT_SOURCES] as const;

/**
 * Recording a bill or purchase. `amount` is the total paid or owed, VAT included;
 * `vatAmount` is the VAT on the invoice (blank: none), which must be less than it.
 */
export const expenseSchema = z.pipe(
  z
    .object({
      date: dayField,
      supplierId: z.pipe(
        z.string().check(z.trim()),
        z.transform((value) => (value === "" ? undefined : value)),
      ),
      accountCode: z.string().check(z.trim(), z.minLength(1, "accountRequired")),
      description: z
        .string()
        .check(
          z.trim(),
          z.minLength(1, "descriptionRequired"),
          z.maxLength(MAX_EXPENSE_DESCRIPTION_LENGTH, "textTooLong"),
        ),
      amount: moneyField,
      vatAmount: optionalMoneyField,
      payment: z.enum(EXPENSE_PAYMENT_CHOICES, { error: "paymentInvalid" }),
    })
    .check(
      z.refine((value) => value.vatAmount < value.amount, {
        path: ["vatAmount"],
        error: "vatTooHigh",
        when: fieldsParsed("amount", "vatAmount"),
      }),
    ),
  z.transform(({ payment, ...rest }) => ({ ...rest, paidFrom: payment === "unpaid" ? undefined : payment })),
);

export type ExpenseFormInput = z.input<typeof expenseSchema>;

/** Paying an owed expense. */
export const payExpenseSchema = z.object({
  source: z.enum(PAYMENT_SOURCES, { error: "paymentInvalid" }),
  paidOn: dayField,
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
