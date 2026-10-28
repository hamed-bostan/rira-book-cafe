import { BANK_LINE_POSTINGS } from "@/src/domain/entities/BankReconciliation";
import * as z from "@/src/lib/zod";

import { fieldsParsed } from "./fields-parsed";
import { balanceField, dayField, optionalMoneyField, optionalTextField, signedAmountField } from "./money-fields";

/** The most lines one statement or import may carry. */
export const MAX_STATEMENT_LINES = 2000;
/** The most lines one match may join on either side. */
const MAX_MATCH_LINES = 500;

/** One movement as the bank statement shows it; amounts are signed (− money out). */
export const statementLineSchema = z.object({
  date: dayField,
  description: z.string().check(z.trim(), z.minLength(1, "descriptionRequired"), z.maxLength(200, "textTooLong")),
  reference: optionalTextField(80),
  amount: signedAmountField,
});

export type StatementLineFormInput = z.input<typeof statementLineSchema>;

const statementFieldsParsed = fieldsParsed("openingBalance", "closingBalance", "lines.*.reference", "lines.*.amount");

/**
 * A bank statement for a period (usually a Persian month): its balances and its
 * lines, typed or imported. Lines must fall inside the period. The server also
 * checks it continues the previous statement.
 */
export const bankStatementSchema = z
  .object({
    fromDay: dayField,
    toDay: dayField,
    openingBalance: balanceField,
    closingBalance: balanceField,
    lines: z.array(statementLineSchema).check(z.maxLength(MAX_STATEMENT_LINES, "linesTooMany")),
  })
  .check(
    z.refine((value) => value.fromDay <= value.toDay, {
      path: ["toDay"],
      error: "periodEndsBeforeStart",
      when: statementFieldsParsed,
    }),
    z.refine((value) => value.lines.every((line) => line.date >= value.fromDay && line.date <= value.toDay), {
      path: ["lines"],
      error: "lineOutsidePeriod",
      when: statementFieldsParsed,
    }),
  );

export type BankStatementFormInput = z.input<typeof bankStatementSchema>;

/** More lines for an open statement (a second export, a line that was missed). */
export const statementLinesSchema = z.object({
  lines: z
    .array(statementLineSchema)
    .check(z.minLength(1, "linesRequired"), z.maxLength(MAX_STATEMENT_LINES, "linesTooMany")),
});

export type StatementLinesInput = z.input<typeof statementLinesSchema>;

const idList = z
  .array(z.string().check(z.trim(), z.minLength(1)))
  .check(z.minLength(1, "linesRequired"), z.maxLength(MAX_MATCH_LINES, "linesTooMany"));

/** Statement lines and ledger lines that are the same money. */
export const bankMatchSchema = z.object({ statementLineIds: idList, ledgerLineIds: idList });

export type BankMatchInput = z.input<typeof bankMatchSchema>;

/** Book what a statement line shows the bank did: a fee, interest, or a gateway payout (with its fee). */
export const recordStatementLineSchema = z.object({
  kind: z.enum(BANK_LINE_POSTINGS, { error: "postingKindInvalid" }),
  fee: optionalMoneyField,
});

export type RecordStatementLineInput = z.input<typeof recordStatementLineSchema>;
