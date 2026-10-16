import type {
  AccountingSettingsInput,
  LedgerAccountInput,
  ManualEntryFormInput,
  ReverseEntryInput,
} from "@/src/contracts/accounting-schema";
import type { Account, AccountingSettings, JournalEntry } from "@/src/domain/entities/Ledger";
import { apiPatch, apiPost, apiPut } from "@/src/lib/api/client";

import { accountResponseSchema, accountingSettingsResponseSchema, journalEntryResponseSchema } from "./accounting-response-schema";

/**
 * Typed client for writes to the books. Payloads are the forms' input shapes; the
 * routes re-validate with the same schemas. Callers `router.refresh()` or navigate after.
 */
export const journalEntriesApi = {
  create(values: ManualEntryFormInput): Promise<JournalEntry> {
    return apiPost("/admin/accounting/journal", values, journalEntryResponseSchema);
  },

  /** Posts the mirror entry; 409 `NOT_REVERSIBLE` for order/expense postings. */
  reverse(id: string, values: ReverseEntryInput): Promise<JournalEntry> {
    return apiPost(`/admin/accounting/journal/${id}/reverse`, values, journalEntryResponseSchema);
  },
};

export const accountsApi = {
  create(values: LedgerAccountInput): Promise<Account> {
    return apiPost("/admin/accounting/accounts", values, accountResponseSchema);
  },

  setActive(code: string, isActive: boolean): Promise<Account> {
    return apiPatch(`/admin/accounting/accounts/${encodeURIComponent(code)}`, { isActive }, accountResponseSchema);
  },

  updateSettings(values: AccountingSettingsInput): Promise<AccountingSettings> {
    return apiPut("/admin/accounting/settings", values, accountingSettingsResponseSchema);
  },
};
