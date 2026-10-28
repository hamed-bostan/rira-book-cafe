import { z } from "zod/mini";

import type {
  AccountBalance,
  AccountLedger,
  BalanceSheet,
  MarginReport,
  ProfitAndLoss,
  StatementSection,
  TrialBalance,
  VatReport,
} from "@/src/domain/entities/AccountingReports";
import { EXPENSE_STATUSES, PAYMENT_SOURCES, type Expense, type Supplier } from "@/src/domain/entities/Expense";
import {
  ACCOUNT_TYPES,
  JOURNAL_SOURCES,
  type Account,
  type AccountingSettings,
  type JournalEntry,
} from "@/src/domain/entities/Ledger";
import type { Page } from "@/src/domain/entities/Pagination";
import { pageResponseSchema } from "@/src/lib/api/page-response-schema";

/** What the accounting and expense endpoints return, checked at the BFF boundary. */

export const accountResponseSchema: z.ZodMiniType<Account> = z.object({
  code: z.string(),
  name: z.string(),
  nameFa: z.string(),
  type: z.enum(ACCOUNT_TYPES),
  isSystem: z.boolean(),
  isActive: z.boolean(),
});
export const accountListResponseSchema = z.array(accountResponseSchema);

export const journalEntryResponseSchema: z.ZodMiniType<JournalEntry> = z.object({
  id: z.string(),
  number: z.number(),
  date: z.string(),
  description: z.string(),
  source: z.enum(JOURNAL_SOURCES),
  sourceId: z.optional(z.string()),
  lines: z.array(
    z.object({ accountCode: z.string(), debit: z.number(), credit: z.number(), memo: z.optional(z.string()) }),
  ),
  createdById: z.string(),
  createdByName: z.string(),
  createdAt: z.string(),
  reversedById: z.optional(z.string()),
  reversesId: z.optional(z.string()),
});
export const journalPageResponseSchema: z.ZodMiniType<Page<JournalEntry>> =
  pageResponseSchema(journalEntryResponseSchema);

export const accountingSettingsResponseSchema: z.ZodMiniType<AccountingSettings> = z.object({
  vatRateBps: z.number(),
  booksClosedThrough: z.optional(z.string()),
});

const balanceSchema: z.ZodMiniType<AccountBalance> = z.object({
  account: accountResponseSchema,
  debit: z.number(),
  credit: z.number(),
  balance: z.number(),
});
const sectionSchema: z.ZodMiniType<StatementSection> = z.object({ rows: z.array(balanceSchema), total: z.number() });

export const trialBalanceResponseSchema: z.ZodMiniType<TrialBalance> = z.object({
  asOfDay: z.string(),
  rows: z.array(balanceSchema),
  totalDebit: z.number(),
  totalCredit: z.number(),
  balanced: z.boolean(),
});

export const profitAndLossResponseSchema: z.ZodMiniType<ProfitAndLoss> = z.object({
  fromDay: z.string(),
  toDay: z.string(),
  revenue: sectionSchema,
  costOfSales: sectionSchema,
  grossProfit: z.number(),
  expenses: sectionSchema,
  netProfit: z.number(),
});

export const balanceSheetResponseSchema: z.ZodMiniType<BalanceSheet> = z.object({
  asOfDay: z.string(),
  assets: sectionSchema,
  liabilities: sectionSchema,
  equity: sectionSchema,
  currentEarnings: z.number(),
  totalEquity: z.number(),
  balanced: z.boolean(),
});

export const vatReportResponseSchema: z.ZodMiniType<VatReport> = z.object({
  fromDay: z.string(),
  toDay: z.string(),
  outputVat: z.number(),
  inputVat: z.number(),
  settled: z.number(),
  netForPeriod: z.number(),
  closingBalance: z.number(),
});

export const marginReportResponseSchema: z.ZodMiniType<MarginReport> = z.object({
  fromDay: z.string(),
  toDay: z.string(),
  rows: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      quantity: z.number(),
      netRevenue: z.number(),
      cost: z.number(),
      grossProfit: z.number(),
      marginRate: z.nullable(z.number()),
    }),
  ),
  totalNetRevenue: z.number(),
  totalCost: z.number(),
  totalGrossProfit: z.number(),
  revenueWithoutCost: z.number(),
});

export const accountLedgerResponseSchema: z.ZodMiniType<AccountLedger> = z.object({
  account: accountResponseSchema,
  fromDay: z.string(),
  toDay: z.string(),
  openingBalance: z.number(),
  lines: z.array(
    z.object({
      entryId: z.string(),
      number: z.number(),
      date: z.string(),
      description: z.string(),
      source: z.enum(JOURNAL_SOURCES),
      debit: z.number(),
      credit: z.number(),
      memo: z.optional(z.string()),
      runningBalance: z.number(),
    }),
  ),
  closingBalance: z.number(),
});

export const supplierResponseSchema: z.ZodMiniType<Supplier> = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.optional(z.string()),
  note: z.optional(z.string()),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export const supplierListResponseSchema = z.array(supplierResponseSchema);

export const expenseResponseSchema: z.ZodMiniType<Expense> = z.object({
  id: z.string(),
  number: z.number(),
  date: z.string(),
  supplierId: z.optional(z.string()),
  supplierName: z.optional(z.string()),
  accountCode: z.string(),
  description: z.string(),
  amount: z.number(),
  vatAmount: z.number(),
  status: z.enum(EXPENSE_STATUSES),
  paidFrom: z.optional(z.enum(PAYMENT_SOURCES)),
  paidOn: z.optional(z.string()),
  receiptUrl: z.optional(z.string()),
  createdById: z.string(),
  createdByName: z.string(),
  createdAt: z.string(),
});

export type ExpensePageWire = Page<Expense> & { totalUnpaid: number };
export const expensePageResponseSchema: z.ZodMiniType<ExpensePageWire> = z.object({
  items: z.array(expenseResponseSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalUnpaid: z.number(),
});

export type ExpenseDetailWire = { expense: Expense; entries: JournalEntry[] };
export const expenseDetailResponseSchema: z.ZodMiniType<ExpenseDetailWire> = z.object({
  expense: expenseResponseSchema,
  entries: z.array(journalEntryResponseSchema),
});
