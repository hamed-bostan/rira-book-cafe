import type { AuditHook } from "./AuditHook";
import type { AccountMovement } from "../entities/AccountingReports";
import type { Account, AccountingSettings, AccountType, JournalEntry, JournalSource, NewJournalEntry } from "../entities/Ledger";
import type { Page, PageRequest } from "../entities/Pagination";

/**
 * Entries a write produces, computed from its result inside the same transaction
 * (so the books and the change commit together or not at all). `settings` is read
 * in that transaction too — the VAT rate in force at the moment of posting.
 */
export type LedgerHook<T> = (result: T, settings: AccountingSettings) => NewJournalEntry[];

export type NewAccount = Pick<Account, "code" | "name" | "nameFa" | "type">;

export type JournalFilters = {
  fromDay?: string;
  toDay?: string;
  source?: JournalSource;
  /** Only entries touching this account. */
  accountCode?: string;
};

/** One line of an account's history, before running balances are computed. */
export type RawLedgerLine = {
  entryId: string;
  number: number;
  date: string;
  description: string;
  source: JournalSource;
  debit: number;
  credit: number;
  memo?: string;
};

/** VAT payable (2200) movement over a span, split by what caused it. */
export type VatMovement = {
  /** Net credits from sales (and their reversals). */
  output: number;
  /** Net debits from expenses (and their reversals). */
  input: number;
  /** Net debits from manual entries — payments to the tax office. */
  settled: number;
};

/**
 * Units, revenue and cost per item from completed orders. `gross` is VAT-inclusive;
 * `taxableGross` is the part of it that carried VAT (exempt lines — books — don't).
 */
export type ItemSalesCost = {
  productId: string;
  name: string;
  quantity: number;
  gross: number;
  taxableGross: number;
  cost: number;
  costKnown: boolean;
};

export type ILedgerRepository = {
  listAccounts(): Promise<Account[]>;
  getAccount(code: string): Promise<Account | null>;
  /** `UniqueConstraintError` for a code already in use. */
  createAccount(input: NewAccount, audit?: AuditHook<Account>): Promise<Account>;
  /** System accounts can't be deactivated (`ConflictError`). */
  setAccountActive(code: string, active: boolean, audit?: AuditHook<Account>): Promise<Account>;

  getSettings(): Promise<AccountingSettings>;
  updateSettings(settings: AccountingSettings, audit?: AuditHook<AccountingSettings>): Promise<AccountingSettings>;

  /**
   * Post one entry in its own transaction. Refuses an unbalanced entry
   * (`ConflictError("UNBALANCED")`), a date in a closed period (`PERIOD_CLOSED`),
   * an inactive account (`ACCOUNT_INACTIVE`), or a repeated unique key (`ALREADY_POSTED`).
   */
  post(entry: NewJournalEntry, audit?: AuditHook<JournalEntry>): Promise<JournalEntry>;
  /** Post the reversal and mark the original, atomically; `ALREADY_REVERSED` the second time. */
  reverse(
    entryId: string,
    reversal: (original: JournalEntry) => NewJournalEntry,
    audit?: AuditHook<JournalEntry>,
  ): Promise<JournalEntry>;

  getEntry(id: string): Promise<JournalEntry | null>;
  listEntries(filters: JournalFilters, page: PageRequest): Promise<Page<JournalEntry>>;
  /** Entries posted for one source document (an order, an expense), oldest first. */
  entriesFor(sourceId: string): Promise<JournalEntry[]>;

  /** Total debits/credits per account for entries dated within `[fromDay, toDay]` (either bound optional). */
  movements(fromDay?: string, toDay?: string): Promise<AccountMovement[]>;
  /** One account's lines within the span, in posting order. */
  accountLines(code: string, fromDay: string, toDay: string): Promise<RawLedgerLine[]>;
  vatMovement(fromDay: string, toDay: string): Promise<VatMovement>;
  /** Units, revenue and cost per item for orders completed (sale posted) within the span. */
  itemSalesCost(fromDay: string, toDay: string): Promise<ItemSalesCost[]>;
};

export type { AccountType };
