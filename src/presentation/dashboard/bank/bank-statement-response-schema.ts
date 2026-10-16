import { z } from "zod";

import {
  BANK_STATEMENT_STATUSES,
  type BankStatement,
  type BankStatementSummary,
  type LedgerCandidate,
  type ReconciliationSummary,
} from "@/src/domain/entities/BankReconciliation";
import { JOURNAL_SOURCES } from "@/src/domain/entities/Ledger";
import type { BankReconciliationView } from "@/src/domain/use-cases/accounting/BankReconciliation";

/** What the bank reconciliation endpoints return, checked at the BFF boundary. */

const statementFields = {
  id: z.string(),
  accountCode: z.string(),
  fromDay: z.string(),
  toDay: z.string(),
  openingBalance: z.number(),
  closingBalance: z.number(),
  status: z.enum(BANK_STATEMENT_STATUSES),
  createdByName: z.string(),
  createdAt: z.string(),
  reconciledByName: z.string().optional(),
  reconciledAt: z.string().optional(),
};

export const bankStatementResponseSchema: z.ZodType<BankStatement> = z.object({
  ...statementFields,
  lines: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      description: z.string(),
      reference: z.string().optional(),
      amount: z.number(),
      matchId: z.string().optional(),
    }),
  ),
});

export const bankStatementListResponseSchema: z.ZodType<BankStatementSummary[]> = z.array(
  z.object({ ...statementFields, lineCount: z.number(), unmatchedCount: z.number() }),
);

const candidateSchema: z.ZodType<LedgerCandidate> = z.object({
  lineId: z.string(),
  entryId: z.string(),
  entryNumber: z.number(),
  date: z.string(),
  description: z.string(),
  source: z.enum(JOURNAL_SOURCES),
  memo: z.string().optional(),
  amount: z.number(),
  matchId: z.string().optional(),
});

const summarySchema: z.ZodType<ReconciliationSummary> = z.object({
  bookBalance: z.number(),
  outstanding: z.number(),
  outstandingCount: z.number(),
  clearedAfter: z.number(),
  statementTotal: z.number(),
  statementGap: z.number(),
  adjustedBook: z.number(),
  difference: z.number(),
  unmatchedLines: z.number(),
  canReconcile: z.boolean(),
});

export const bankReconciliationResponseSchema: z.ZodType<BankReconciliationView> = z.object({
  statement: bankStatementResponseSchema,
  candidates: z.array(candidateSchema),
  summary: summarySchema,
  suggestions: z.array(z.object({ statementLineId: z.string(), ledgerLineId: z.string() })),
});

export const autoMatchResponseSchema = z.object({ matched: z.number() });
