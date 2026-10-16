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
  /** Set once paid. */
  paidFrom?: PaymentSource;
  paidOn?: string;
  /** An optional receipt or invoice image. */
  receiptUrl?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
};

/** Accounts that hold money or what guests owe — never what an expense is spent *on*. */
const MONEY_ACCOUNTS: readonly string[] = [
  SYSTEM_ACCOUNTS.cash,
  SYSTEM_ACCOUNTS.bank,
  SYSTEM_ACCOUNTS.gatewayClearing,
  SYSTEM_ACCOUNTS.guestReceivables,
];

/**
 * What an expense can be booked to: an expense account (rent, salaries, …) or an
 * asset it buys — stock (inventory) or equipment. Not money accounts, liabilities,
 * equity or revenue.
 */
export function isExpenseTarget(account: Pick<Account, "code" | "type">): boolean {
  return account.type === "expense" || (account.type === "asset" && !MONEY_ACCOUNTS.includes(account.code));
}
