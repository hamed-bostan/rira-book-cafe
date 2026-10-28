import { ACCOUNT_TYPES, MAX_VAT_RATE_BPS } from "@/src/domain/entities/Ledger";
import * as z from "@/src/lib/zod";

import { fieldsParsed } from "./fields-parsed";
import { dayField, optionalMoneyField, optionalTextField } from "./money-fields";

/** The most lines one manual entry may have — a payroll split fits comfortably. */
export const MAX_ENTRY_LINES = 20;

const entryLineSchema = z.object({
  accountCode: z.string().check(z.trim(), z.minLength(1, "accountRequired")),
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
    description: z.string().check(z.trim(), z.minLength(1, "descriptionRequired"), z.maxLength(200, "textTooLong")),
    lines: z.array(entryLineSchema).check(z.minLength(2, "linesTooFew"), z.maxLength(MAX_ENTRY_LINES, "linesTooMany")),
  })
  .check(
    z.superRefine(
      (value, ctx) => {
        value.lines.forEach((line, index) => {
          if (line.debit > 0 === line.credit > 0) {
            ctx.addIssue({ code: "custom", path: ["lines", index, "debit"], message: "lineOneSide" });
          }
        });
        const debits = value.lines.reduce((sum, line) => sum + line.debit, 0);
        const credits = value.lines.reduce((sum, line) => sum + line.credit, 0);
        if (debits !== credits) {
          ctx.addIssue({ code: "custom", path: ["lines"], message: "entryUnbalanced" });
        }
      },
      { when: fieldsParsed("lines.*.debit", "lines.*.credit", "lines.*.memo") },
    ),
  );

export type ManualEntryFormInput = z.input<typeof manualEntrySchema>;
export type ManualEntryValues = z.output<typeof manualEntrySchema>;

/** Reversing a manual entry: the day the reversal is booked and why. */
export const reverseEntrySchema = z.object({
  date: dayField,
  reason: z.string().check(z.trim(), z.minLength(1, "reasonRequired"), z.maxLength(200, "textTooLong")),
});

export type ReverseEntryInput = z.input<typeof reverseEntrySchema>;

/** A new account in the chart of accounts. */
export const ledgerAccountSchema = z.object({
  code: z.string().check(z.trim(), z.regex(/^\d{4}$/, "accountCodeInvalid")),
  name: z.string().check(z.trim(), z.minLength(1, "nameRequired"), z.maxLength(80, "textTooLong")),
  nameFa: z.string().check(z.trim(), z.minLength(1, "nameRequired"), z.maxLength(80, "textTooLong")),
  type: z.enum(ACCOUNT_TYPES, { error: "accountTypeInvalid" }),
});

export type LedgerAccountInput = z.input<typeof ledgerAccountSchema>;

export const ledgerAccountActiveSchema = z.object({ isActive: z.boolean() });

/**
 * VAT rate as a percentage the owner types ("10", "9.5"), stored in basis points;
 * and the day the books are closed through (blank: nothing closed).
 */
export const accountingSettingsSchema = z.object({
  vatRate: z
    .pipe(
      z.string().check(z.trim(), z.regex(/^\d{1,2}(\.\d{1,2})?$/, "vatRateInvalid")),
      z.transform((value) => Math.round(Number(value) * 100)),
    )
    .check(z.refine((bps) => bps <= MAX_VAT_RATE_BPS, "vatRateInvalid")),
  booksClosedThrough: z.pipe(
    z.pipe(
      z.string().check(z.trim()),
      z.transform((value) => (value === "" ? undefined : value)),
    ),
    z.optional(dayField),
  ),
});

export type AccountingSettingsInput = z.input<typeof accountingSettingsSchema>;
