import type { AuditHook } from "./AuditHook";
import type { LedgerHook } from "./ILedgerRepository";
import type { Income, IncomeSourceType, IncomeStatus, IncomeSummary } from "../entities/Income";
import type { IncomeRefund, RefundablePayment, RefundPortion } from "../entities/IncomeRefund";
import type { JournalEntry, NewJournalEntry } from "../entities/Ledger";
import type { Page, PageRequest } from "../entities/Pagination";

export type NewIncome = Omit<Income, "id" | "number" | "createdAt" | "status">;

/** A refund about to be handed back from a booking's payments; each share's figures come from the plan. */
export type NewIncomeRefund = Pick<
  IncomeRefund,
  "sourceType" | "sourceId" | "date" | "method" | "reason" | "createdById" | "createdByName"
>;

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
  /**
   * Reverse its entries and mark it void, in one transaction; `INVALID_TRANSITION`
   * the second time. Refunds drawn from it are filed under it, so they're reversed
   * with it: what voiding hands back is what the guest hadn't had back already.
   */
  void(id: string, reverse: (entry: JournalEntry) => NewJournalEntry, audit?: AuditHook<Income>): Promise<Income>;
  /** A booking's payments still standing (voids aside), each with what's been handed back from it. */
  listRefundable(sourceType: IncomeSourceType, sourceId: string): Promise<RefundablePayment[]>;
  /**
   * Hand money back from a booking's payments, in one transaction with those
   * payments locked: `plan` draws the refund from them as they stand then (and
   * throws to refuse it — more than is left), each share is stored, posted through
   * `ledger` and audited. Returns the refund rows, one per payment drawn from.
   */
  refund(
    input: NewIncomeRefund,
    plan: (payments: RefundablePayment[]) => RefundPortion[],
    ledger: LedgerHook<IncomeRefund>,
    audit?: AuditHook<IncomeRefund>,
  ): Promise<IncomeRefund[]>;
};
