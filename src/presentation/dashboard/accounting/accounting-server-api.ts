import type {
  AccountLedger,
  BalanceSheet,
  MarginReport,
  ProfitAndLoss,
  TrialBalance,
  VatReport,
} from "@/src/domain/entities/AccountingReports";
import type { Account, AccountingSettings, JournalEntry } from "@/src/domain/entities/Ledger";
import type { Page } from "@/src/domain/entities/Pagination";
import { ApiError } from "@/src/lib/api/ApiError";
import { serverApiGet } from "@/src/lib/api/server-client";

import {
  accountLedgerResponseSchema,
  accountListResponseSchema,
  accountingSettingsResponseSchema,
  balanceSheetResponseSchema,
  journalEntryResponseSchema,
  journalPageResponseSchema,
  marginReportResponseSchema,
  profitAndLossResponseSchema,
  trialBalanceResponseSchema,
  vatReportResponseSchema,
} from "./accounting-response-schema";

type Query = Record<string, string>;

/** Server-side reads of the books for the dashboard (BFF), fetched during server render. */
export const accountsServerApi = {
  list(): Promise<Account[]> {
    return serverApiGet("/admin/accounting/accounts", accountListResponseSchema);
  },

  getSettings(): Promise<AccountingSettings> {
    return serverApiGet("/admin/accounting/settings", accountingSettingsResponseSchema);
  },

  /** One account's lines over a span; `null` when the account doesn't exist. */
  async getLedger(code: string, params: Query): Promise<AccountLedger | null> {
    try {
      return await serverApiGet(
        `/admin/accounting/accounts/${encodeURIComponent(code)}/ledger`,
        accountLedgerResponseSchema,
        { params },
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
};

export const journalEntriesServerApi = {
  list(params: Query): Promise<Page<JournalEntry>> {
    return serverApiGet("/admin/accounting/journal", journalPageResponseSchema, { params });
  },

  async getById(id: string): Promise<JournalEntry | null> {
    try {
      return await serverApiGet(`/admin/accounting/journal/${id}`, journalEntryResponseSchema);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
};

export const statementsServerApi = {
  trialBalance(params: Query): Promise<TrialBalance> {
    return serverApiGet("/admin/accounting/reports/trial-balance", trialBalanceResponseSchema, { params });
  },
  balanceSheet(params: Query): Promise<BalanceSheet> {
    return serverApiGet("/admin/accounting/reports/balance-sheet", balanceSheetResponseSchema, { params });
  },
  profitAndLoss(params: Query): Promise<ProfitAndLoss> {
    return serverApiGet("/admin/accounting/reports/profit-and-loss", profitAndLossResponseSchema, { params });
  },
  vat(params: Query): Promise<VatReport> {
    return serverApiGet("/admin/accounting/reports/vat", vatReportResponseSchema, { params });
  },
  margins(params: Query): Promise<MarginReport> {
    return serverApiGet("/admin/accounting/reports/margins", marginReportResponseSchema, { params });
  },
};
