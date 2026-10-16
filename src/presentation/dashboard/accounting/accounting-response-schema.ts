import { z } from "zod";

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
import { ACCOUNT_TYPES, JOURNAL_SOURCES, type Account, type AccountingSettings, type JournalEntry } from "@/src/domain/entities/Ledger";
import type { Page } from "@/src/domain/entities/Pagination";
import { pageResponseSchema } from "@/src/lib/api/page-response-schema";

/** What the accounting and expense endpoints return, checked at the BFF boundary. */

export const accountResponseSchema: z.ZodType<Account> = z.object({
  code: z.string(),
  name: z.string(),
  nameFa: z.string(),
  type: z.enum(ACCOUNT_TYPES),
  isSystem: z.boolean(),
  isActive: z.boolean(),
});
export const accountListResponseSchema = z.array(accountResponseSchema);

export const journalEntryResponseSchema: z.ZodType<JournalEntry> = z.object({
  id: z.string(),
  number: z.number(),
  date: z.string(),
  description: z.string(),
  source: z.enum(JOURNAL_SOURCES),
  sourceId: z.string().optional(),
  lines: z.array(
    z.object({ accountCode: z.string(), debit: z.number(), credit: z.number(), memo: z.string().optional() }),
  ),
  createdById: z.string(),
  createdByName: z.string(),
  createdAt: z.string(),
  reversedById: z.string().optional(),
  reversesId: z.string().optional(),
});
export const journalPageResponseSchema: z.ZodType<Page<JournalEntry>> = pageResponseSchema(journalEntryResponseSchema);

export const accountingSettingsResponseSchema: z.ZodType<AccountingSettings> = z.object({
  vatRateBps: z.number(),
  booksClosedThrough: z.string().optional(),
});

const balanceSchema: z.ZodType<AccountBalance> = z.object({
  account: accountResponseSchema,
  debit: z.number(),
  credit: z.number(),
  balance: z.number(),
});
const sectionSchema: z.ZodType<StatementSection> = z.object({ rows: z.array(balanceSchema), total: z.number() });

export const trialBalanceResponseSchema: z.ZodType<TrialBalance> = z.object({
  asOfDay: z.string(),
  rows: z.array(balanceSchema),
  totalDebit: z.number(),
  totalCredit: z.number(),
  balanced: z.boolean(),
});

export const profitAndLossResponseSchema: z.ZodType<ProfitAndLoss> = z.object({
  fromDay: z.string(),
  toDay: z.string(),
  revenue: sectionSchema,
  costOfSales: sectionSchema,
  grossProfit: z.number(),
  expenses: sectionSchema,
  netProfit: z.number(),
});

export const balanceSheetResponseSchema: z.ZodType<BalanceSheet> = z.object({
  asOfDay: z.string(),
  assets: sectionSchema,
  liabilities: sectionSchema,
  equity: sectionSchema,
  currentEarnings: z.number(),
  totalEquity: z.number(),
  balanced: z.boolean(),
});

export const vatReportResponseSchema: z.ZodType<VatReport> = z.object({
  fromDay: z.string(),
  toDay: z.string(),
  outputVat: z.number(),
  inputVat: z.number(),
  settled: z.number(),
  netForPeriod: z.number(),
  closingBalance: z.number(),
});

export const marginReportResponseSchema: z.ZodType<MarginReport> = z.object({
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
      marginRate: z.number().nullable(),
    }),
  ),
  totalNetRevenue: z.number(),
  totalCost: z.number(),
  totalGrossProfit: z.number(),
  revenueWithoutCost: z.number(),
});

export const accountLedgerResponseSchema: z.ZodType<AccountLedger> = z.object({
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
      memo: z.string().optional(),
      runningBalance: z.number(),
    }),
  ),
  closingBalance: z.number(),
});

export const supplierResponseSchema: z.ZodType<Supplier> = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().optional(),
  note: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export const supplierListResponseSchema = z.array(supplierResponseSchema);

export const expenseResponseSchema: z.ZodType<Expense> = z.object({
  id: z.string(),
  number: z.number(),
  date: z.string(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  accountCode: z.string(),
  description: z.string(),
  amount: z.number(),
  vatAmount: z.number(),
  status: z.enum(EXPENSE_STATUSES),
  paidFrom: z.enum(PAYMENT_SOURCES).optional(),
  paidOn: z.string().optional(),
  receiptUrl: z.string().optional(),
  createdById: z.string(),
  createdByName: z.string(),
  createdAt: z.string(),
});

export type ExpensePageWire = Page<Expense> & { totalUnpaid: number };
export const expensePageResponseSchema: z.ZodType<ExpensePageWire> = z.object({
  items: z.array(expenseResponseSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalUnpaid: z.number(),
});

export type ExpenseDetailWire = { expense: Expense; entries: JournalEntry[] };
export const expenseDetailResponseSchema: z.ZodType<ExpenseDetailWire> = z.object({
  expense: expenseResponseSchema,
  entries: z.array(journalEntryResponseSchema),
});
