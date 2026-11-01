import type { Account } from "./Ledger";
import type { PaymentMethod } from "./Order";

/**
 * Money that came in outside an order: event tickets, a suite stay, a room hire, a
 * book-club fee. It's the counterpart of an expense — booked to a revenue account,
 * with the VAT inside it to VAT payable, and into the cash register or the bank on
 * the spot. Orders post their own revenue; this is for everything else.
 */

/** How it was received. Online payments only ever come in through an order. */
export const INCOME_METHODS = ["cash", "card", "transfer"] as const satisfies readonly PaymentMethod[];
export type IncomeMethod = (typeof INCOME_METHODS)[number];

/**
 * - `received` — booked.
 * - `void` — entered by mistake, or handed back; its entry was reversed. Terminal.
 */
export const INCOME_STATUSES = ["received", "void"] as const;
export type IncomeStatus = (typeof INCOME_STATUSES)[number];

/** What a payment can be for, beyond a free description. */
export const INCOME_SOURCE_TYPES = ["eventRegistration", "suiteBooking"] as const;
export type IncomeSourceType = (typeof INCOME_SOURCE_TYPES)[number];

export const MAX_INCOME_DESCRIPTION_LENGTH = 300;
export const MAX_PAYER_NAME_LENGTH = 80;

export type Income = {
  id: string;
  /** Sequential number staff refer to ("IN-14"). */
  number: number;
  /** The cafe day it was received, `YYYY-MM-DD`. */
  date: string;
  /** The revenue account it's booked to. */
  accountCode: string;
  description: string;
  /** Total received, VAT included, in whole Toman. */
  amount: number;
  /** The VAT inside `amount`. */
  vatAmount: number;
  method: IncomeMethod;
  payerName?: string;
  sourceType?: IncomeSourceType;
  sourceId?: string;
  status: IncomeStatus;
  createdById: string;
  createdByName: string;
  createdAt: string;
};

/** What's been received in the month and how many entries sit in each status. */
export type IncomeSummary = {
  month: { fromDay: string; toDay: string; count: number; total: number };
  counts: Record<IncomeStatus, number>;
};

/** Income is booked to a revenue account. */
export function isIncomeTarget(account: Pick<Account, "type">): boolean {
  return account.type === "revenue";
}
