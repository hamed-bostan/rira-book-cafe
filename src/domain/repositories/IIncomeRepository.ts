import type { AuditHook } from "./AuditHook";
import type { LedgerHook } from "./ILedgerRepository";
import type { Income, IncomeStatus, IncomeSummary } from "../entities/Income";
import type { JournalEntry, NewJournalEntry } from "../entities/Ledger";
import type { Page, PageRequest } from "../entities/Pagination";

export type NewIncome = Omit<Income, "id" | "number" | "createdAt" | "status">;

export type IncomeFilters = {
  status?: IncomeStatus;
  /** Words in the description or the payer's name, or the entry's number ("14", "IN-14"). */
  query?: string;
};

export type IIncomeRepository = {
  getIncome(id: string): Promise<Income | null>;
  listIncomes(filters: IncomeFilters, page: PageRequest): Promise<Page<Income>>;
  /** What was received in `month` (voids aside), and each status's count. */
  summary(month: { fromDay: string; toDay: string }): Promise<IncomeSummary>;
  /** Record money in and post its entry, in one transaction. */
  create(input: NewIncome, ledger: LedgerHook<Income>, audit?: AuditHook<Income>): Promise<Income>;
  /** Reverse its entry and mark it void, in one transaction; `INVALID_TRANSITION` the second time. */
  void(id: string, reverse: (entry: JournalEntry) => NewJournalEntry, audit?: AuditHook<Income>): Promise<Income>;
};
