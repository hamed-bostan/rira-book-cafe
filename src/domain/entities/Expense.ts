import { SYSTEM_ACCOUNTS, type Account } from "./Ledger";

/**
 * What the cafe spends: rent, salaries, utilities, and stock bought to sell
 * (books, beans, milk). An expense is booked against an account — an expense
 * account, or Inventory for stock — and is either paid on the spot or owed to a
 * supplier (accounts payable) until it's paid.
 */

/** Where an expense's money comes from when it's paid. */
export const PAYMENT_SOURCES = ["cash", "bank"] as const;
export type PaymentSource = (typeof PAYMENT_SOURCES)[number];

/**
 * - `unpaid` — booked and owed (to a supplier).
 * - `paid` — settled from cash or the bank.
 * - `void` — entered by mistake; its entries were reversed. Terminal.
 */
export const EXPENSE_STATUSES = ["unpaid", "paid", "void"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const MAX_EXPENSE_DESCRIPTION_LENGTH = 300;

export type Supplier = {
  id: string;
  name: string;
  phone?: string;
  note?: string;
  isActive: boolean;
  createdAt: string;
};

export type Expense = {
  id: string;
  /** Sequential number staff refer to ("EX-14"). */
  number: number;
  /** The day the cost was incurred (invoice date), a cafe day `YYYY-MM-DD`. */
  date: string;
  supplierId?: string;
  /** Supplier name snapshotted, so the expense reads correctly after a rename. */
  supplierName?: string;
  /** The account it's booked to: an expense account (6xxx) or Inventory (1200) for stock. */
  accountCode: string;
  description: string;
  /** Total paid or owed, VAT included, in whole Toman. */
  amount: number;
  /** The VAT inside `amount` that the cafe can offset against VAT it collected. */
  vatAmount: number;
  status: ExpenseStatus;
  /** Paid so far, in whole Toman: part of an `unpaid` bill, all of a `paid` one. */
  paidAmount: number;
  /** Set once paid in full. */
  paidFrom?: PaymentSource;
  paidOn?: string;
  /** An optional receipt or invoice image. */
  receiptUrl?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
};

/** What's still owed on an expense. */
export function amountOwed(expense: Pick<Expense, "amount" | "paidAmount" | "status">): number {
  return expense.status === "unpaid" ? expense.amount - expense.paidAmount : 0;
}

/** Where image storage keeps a receipt: a random name in the private receipts folder. */
const RECEIPT_URL = /^\/uploads\/receipts\/[0-9a-f-]{36}\.(?:jpg|png|webp|avif)$/;

/** Whether a URL is a receipt this app stored, not an address a client made up. */
export function isReceiptUrl(value: string): boolean {
  return RECEIPT_URL.test(value);
}

/**
 * The figures across the top of the Expenses page and the counts on its tabs:
 * what's owed to suppliers now, what was recorded this month, and how many
 * expenses sit in each status.
 */
export type ExpenseSummary = {
  /** Bills still owed, and their total. */
  owed: { count: number; total: number };
  /** Expenses dated in the month (voids aside) and their total, VAT included. */
  month: { fromDay: string; toDay: string; count: number; total: number };
  counts: Record<ExpenseStatus, number>;
};

/** What's left to pay on a set of unpaid bills, part payments taken off. */
export type AmountOwed = { billCount: number; owed: number };

export type SupplierBalance = AmountOwed & { supplierId: string };

/**
 * What's owed to each supplier. Bills with no supplier named are kept apart rather
 * than dropped, so `total` is the same figure as the Expenses page's "owed".
 */
export type SupplierBalances = {
  /** Only suppliers something is owed to. */
  suppliers: SupplierBalance[];
  noSupplier: AmountOwed;
  total: number;
};

/** Turn each supplier's unpaid total into the balances the Suppliers page shows. */
export function buildSupplierBalances(rows: readonly (AmountOwed & { supplierId?: string })[]): SupplierBalances {
  const suppliers: SupplierBalance[] = [];
  const noSupplier: AmountOwed = { billCount: 0, owed: 0 };
  for (const { supplierId, billCount, owed } of rows) {
    if (supplierId) suppliers.push({ supplierId, billCount, owed });
    else {
      noSupplier.billCount += billCount;
      noSupplier.owed += owed;
    }
  }
  return { suppliers, noSupplier, total: rows.reduce((sum, row) => sum + row.owed, 0) };
}

/** Accounts that hold money or what guests owe — never what an expense is spent *on*. */
const MONEY_ACCOUNTS: readonly string[] = [
  SYSTEM_ACCOUNTS.cash,
  SYSTEM_ACCOUNTS.bank,
  SYSTEM_ACCOUNTS.gatewayClearing,
  SYSTEM_ACCOUNTS.guestReceivables,
  // Inventory only moves with stock — goods for stock come in as deliveries.
  SYSTEM_ACCOUNTS.inventory,
];

/**
 * What an expense can be booked to: an expense account (rent, salaries, …) or an
 * asset it buys — equipment. Not money accounts, inventory (deliveries come in
 * through stock, so stock and the books stay equal), liabilities,
 * equity or revenue.
 */
export function isExpenseTarget(account: Pick<Account, "code" | "type">): boolean {
  return account.type === "expense" || (account.type === "asset" && !MONEY_ACCOUNTS.includes(account.code));
}
