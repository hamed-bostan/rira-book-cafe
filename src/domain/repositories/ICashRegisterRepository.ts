import type { AuditHook } from "./AuditHook";
import type { CashClose, CashDaySnapshot, NewCashClose } from "../entities/CashClose";
import type { NewJournalEntry } from "../entities/Ledger";
import type { Page, PageRequest } from "../entities/Pagination";

/**
 * Turns the books' view of the day — read inside the closing transaction — into
 * the close record and its entry. Throwing aborts the close.
 */
export type CashCloseBuilder = (snapshot: CashDaySnapshot) => { close: NewCashClose; entry: NewJournalEntry | null };

export type ICashRegisterRepository = {
  /** Cash on hand at the start of `day` and the day's cash lines, as they stand now. */
  daySnapshot(day: string): Promise<CashDaySnapshot>;
  lastClose(): Promise<CashClose | null>;
  /** Closes, newest first. */
  listCloses(page: PageRequest): Promise<Page<CashClose>>;
  /** Days within `[fromDay, toDay]` that have lines on Cash on hand. */
  cashActivityDays(fromDay: string, toDay: string): Promise<string[]>;

  /**
   * Close the till for `day`, serialized with every other close: refuses a day
   * already closed (`ConflictError("DAY_ALREADY_CLOSED")`) or one before the latest
   * close (`CLOSE_OUT_OF_ORDER`), reads the snapshot, builds the close, posts its
   * entry through the ledger's single posting path, stores the close and its audit
   * entry — all in one transaction.
   */
  close(day: string, build: CashCloseBuilder, audit?: AuditHook<CashClose>): Promise<CashClose>;
};
