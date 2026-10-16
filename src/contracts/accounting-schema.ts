import { z } from "zod";

import { ACCOUNT_TYPES, MAX_VAT_RATE_BPS } from "@/src/domain/entities/Ledger";

import { dayField, optionalMoneyField, optionalTextField } from "./money-fields";

/** The most lines one manual entry may have — a payroll split fits comfortably. */
export const MAX_ENTRY_LINES = 20;

const entryLineSchema = z.object({
  accountCode: z.string().trim().min(1, "accountRequired"),
  debit: optionalMoneyField,
  credit: optionalMoneyField,
  memo: optionalTextField(200),
});

/**
 * A manual journal entry: a date, what it's for, and at least two lines that each
 * sit on one side and together balance. The server re-checks everything (and the
 * database does again) — this is so the form can say what's wrong where.
 */
export const manualEntrySchema = z
  .object({
    date: dayField,
    description: z.string().trim().min(1, "descriptionRequired").max(200, "textTooLong"),
    lines: z.array(entryLineSchema).min(2, "linesTooFew").max(MAX_ENTRY_LINES, "linesTooMany"),
  })
  .superRefine((value, ctx) => {
    value.lines.forEach((line, index) => {
      if ((line.debit > 0) === (line.credit > 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lines", index, "debit"], message: "lineOneSide" });
      }
    });
    const debits = value.lines.reduce((sum, line) => sum + line.debit, 0);
    const credits = value.lines.reduce((sum, line) => sum + line.credit, 0);
    if (debits !== credits) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "entryUnbalanced" });
    }
  });

export type ManualEntryFormInput = z.input<typeof manualEntrySchema>;
export type ManualEntryValues = z.output<typeof manualEntrySchema>;

/** Reversing a manual entry: the day the reversal is booked and why. */
export const reverseEntrySchema = z.object({
  date: dayField,
  reason: z.string().trim().min(1, "reasonRequired").max(200, "textTooLong"),
});

export type ReverseEntryInput = z.input<typeof reverseEntrySchema>;

/** A new account in the chart of accounts. */
export const ledgerAccountSchema = z.object({
  code: z.string().trim().regex(/^\d{4}$/, "accountCodeInvalid"),
  name: z.string().trim().min(1, "nameRequired").max(80, "textTooLong"),
  nameFa: z.string().trim().min(1, "nameRequired").max(80, "textTooLong"),
  type: z.enum(ACCOUNT_TYPES, { message: "accountTypeInvalid" }),
});

export type LedgerAccountInput = z.input<typeof ledgerAccountSchema>;

export const ledgerAccountActiveSchema = z.object({ isActive: z.boolean() });

/**
 * VAT rate as a percentage the owner types ("10", "9.5"), stored in basis points;
 * and the day the books are closed through (blank: nothing closed).
 */
export const accountingSettingsSchema = z.object({
  vatRate: z
    .string()
    .trim()
    .regex(/^\d{1,2}(\.\d{1,2})?$/, "vatRateInvalid")
    .transform((value) => Math.round(Number(value) * 100))
    .refine((bps) => bps <= MAX_VAT_RATE_BPS, "vatRateInvalid"),
  booksClosedThrough: z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(dayField.optional()),
});

export type AccountingSettingsInput = z.input<typeof accountingSettingsSchema>;
