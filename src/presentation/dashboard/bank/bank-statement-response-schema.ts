import { z } from "zod/mini";

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
  reconciledByName: z.optional(z.string()),
  reconciledAt: z.optional(z.string()),
};

export const bankStatementResponseSchema: z.ZodMiniType<BankStatement> = z.object({
  ...statementFields,
  lines: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      description: z.string(),
      reference: z.optional(z.string()),
      amount: z.number(),
      matchId: z.optional(z.string()),
    }),
  ),
});

export const bankStatementListResponseSchema: z.ZodMiniType<BankStatementSummary[]> = z.array(
  z.object({ ...statementFields, lineCount: z.number(), unmatchedCount: z.number() }),
);

const candidateSchema: z.ZodMiniType<LedgerCandidate> = z.object({
  lineId: z.string(),
  entryId: z.string(),
  entryNumber: z.number(),
  date: z.string(),
  description: z.string(),
  source: z.enum(JOURNAL_SOURCES),
  memo: z.optional(z.string()),
  amount: z.number(),
  matchId: z.optional(z.string()),
});

const summarySchema: z.ZodMiniType<ReconciliationSummary> = z.object({
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

export const bankReconciliationResponseSchema: z.ZodMiniType<BankReconciliationView> = z.object({
  statement: bankStatementResponseSchema,
  candidates: z.array(candidateSchema),
  summary: summarySchema,
  suggestions: z.array(z.object({ statementLineId: z.string(), ledgerLineId: z.string() })),
});

export const autoMatchResponseSchema = z.object({ matched: z.number() });
