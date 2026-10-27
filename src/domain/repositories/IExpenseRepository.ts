import type { AuditHook } from "./AuditHook";
import type { LedgerHook } from "./ILedgerRepository";
import type { Expense, ExpenseStatus, ExpenseSummary, PaymentSource, Supplier } from "../entities/Expense";
import type { JournalEntry, NewJournalEntry } from "../entities/Ledger";
import type { Page, PageRequest } from "../entities/Pagination";

export type NewSupplier = Pick<Supplier, "name" | "phone" | "note">;

export type NewExpense = Omit<
  Expense,
  "id" | "number" | "createdAt" | "supplierName" | "status" | "paidFrom" | "paidOn"
> & {
  /** Paid on the spot from cash or the bank; omitted means owed to the supplier. */
  paidFrom?: PaymentSource;
};

export type ExpenseFilters = {
  fromDay?: string;
  toDay?: string;
  status?: ExpenseStatus;
  supplierId?: string;
  accountCode?: string;
  /** Words in the description or supplier's name, or the expense's number ("1042", "EX-1042"). */
  query?: string;
};

export type IExpenseRepository = {
  listSuppliers(includeInactive: boolean): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | null>;
  createSupplier(input: NewSupplier): Promise<Supplier>;
  updateSupplier(id: string, input: NewSupplier & { isActive: boolean }): Promise<Supplier>;

  getExpense(id: string): Promise<Expense | null>;
  listExpenses(filters: ExpenseFilters, page: PageRequest): Promise<Page<Expense>>;
  /** Totals the list's footer shows: owed to suppliers right now. */
  totalUnpaid(): Promise<number>;
  /** What's owed now, what was recorded in `month` (voids aside), and each status's count. */
  summary(month: { fromDay: string; toDay: string }): Promise<ExpenseSummary>;

  /** Record an expense and post its entry, in one transaction. */
  create(input: NewExpense, ledger: LedgerHook<Expense>, audit?: AuditHook<Expense>): Promise<Expense>;
  /** Mark an owed expense paid and post the payment, guarded on it still being unpaid. */
  pay(
    id: string,
    source: PaymentSource,
    paidOn: string,
    ledger: LedgerHook<Expense>,
    audit?: AuditHook<Expense>,
  ): Promise<Expense>;
  /**
   * Void an expense: reverse every entry posted for it and mark it void, in one
   * transaction. `reverse` builds each reversal from the original entry.
   */
  void(id: string, reverse: (entry: JournalEntry) => NewJournalEntry, audit?: AuditHook<Expense>): Promise<Expense>;
};
