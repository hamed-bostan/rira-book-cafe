/**
 * The general ledger: double-entry bookkeeping in whole Toman.
 *
 * Every money event — a sale, a payment, a refund, an expense — is written as a
 * journal entry whose lines debit and credit accounts by equal totals. Entries are
 * immutable once posted: a mistake is corrected by posting the reversing entry,
 * never by editing or deleting, so the books always explain how they got here.
 */

export const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/**
 * Which side increases an account. Assets and expenses grow with debits;
 * liabilities, equity and revenue with credits.
 */
export function normalSide(type: AccountType): "debit" | "credit" {
  return type === "asset" || type === "expense" ? "debit" : "credit";
}

/** The chart's numbering is its structure: 1 assets, 2 liabilities, 3 equity, 4 revenue, 5–9 expenses. */
export function typeForCode(code: string): AccountType {
  switch (code[0]) {
    case "1":
      return "asset";
    case "2":
      return "liability";
    case "3":
      return "equity";
    case "4":
      return "revenue";
    default:
      return "expense";
  }
}

/** An account's balance on its normal side (positive = the usual direction). */
export function signedBalance(type: AccountType, debit: number, credit: number): number {
  return normalSide(type) === "debit" ? debit - credit : credit - debit;
}

export type Account = {
  /** Stable code, e.g. "1110". The first digit is the account type (1 asset … 6 expense). */
  code: string;
  name: string;
  nameFa: string;
  type: AccountType;
  /** System accounts are used by automatic postings and can't be deactivated. */
  isSystem: boolean;
  isActive: boolean;
};

/**
 * The accounts automatic postings rely on. The full starting chart (including
 * these) is created by the accounting migration; operators can add more.
 */
export const SYSTEM_ACCOUNTS = {
  cash: "1110",
  bank: "1120",
  gatewayClearing: "1130",
  guestReceivables: "1150",
  inventory: "1200",
  accountsPayable: "2100",
  vatPayable: "2200",
  ownerCapital: "3100",
  retainedEarnings: "3200",
  salesDrinks: "4100",
  salesFood: "4200",
  salesBooks: "4300",
  costOfSales: "5100",
  gatewayFees: "6700",
} as const;

/** What an automatic posting or a manual entry came from — for drill-down and duplicate protection. */
export const JOURNAL_SOURCES = [
  "orderSale",
  "orderCost",
  "orderPayment",
  "orderPaymentReversal",
  "orderRefund",
  "expense",
  "expensePayment",
  "gatewaySettlement",
  "stockWaste",
  "stockCount",
  "stockOpening",
  "yearClose",
  "manual",
  "reversal",
] as const;
export type JournalSource = (typeof JOURNAL_SOURCES)[number];

export type JournalLine = {
  accountCode: string;
  /** Whole Toman; exactly one of debit/credit is positive. */
  debit: number;
  credit: number;
  memo?: string;
};

export type JournalEntry = {
  id: string;
  /** Sequential, gap-tolerant number staff refer to ("JE-128"). */
  number: number;
  /** The accounting date, a cafe day (`YYYY-MM-DD`). */
  date: string;
  description: string;
  source: JournalSource;
  /** The id of what it came from (an order, an expense, the entry it reverses). */
  sourceId?: string;
  lines: JournalLine[];
  createdById: string;
  createdByName: string;
  createdAt: string;
  /** Set on an entry that has been reversed: the reversing entry's id. */
  reversedById?: string;
  /** Set on a reversing entry: the entry it reverses. */
  reversesId?: string;
};

/** An entry about to be posted; numbering, id and timestamps are the repository's. */
export type NewJournalEntry = Omit<JournalEntry, "id" | "number" | "createdAt" | "reversedById"> & {
  /**
   * A unique key for postings that must happen at most once (an order's sale, its
   * cost of sales). The ledger refuses a second entry with the same key, so a
   * retried or racing request can't book revenue twice.
   */
  uniqueKey?: string;
};

export class UnbalancedEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnbalancedEntryError";
  }
}

/**
 * Check an entry's shape: at least two lines, each a positive whole-Toman debit
 * or credit (not both), and total debits equal to total credits. Throws
 * `UnbalancedEntryError`; returns the entry with zero lines dropped.
 */
export function assertBalanced<T extends Pick<NewJournalEntry, "lines">>(entry: T): T {
  const lines = entry.lines.filter((line) => line.debit !== 0 || line.credit !== 0);
  for (const line of lines) {
    const bothSides = line.debit > 0 && line.credit > 0;
    const invalid = [line.debit, line.credit].some((value) => !Number.isSafeInteger(value) || value < 0);
    if (bothSides || invalid) {
      throw new UnbalancedEntryError(`Line on ${line.accountCode} must be one positive whole amount, debit or credit.`);
    }
  }
  if (lines.length < 2) throw new UnbalancedEntryError("An entry needs at least two lines.");
  const debits = lines.reduce((sum, line) => sum + line.debit, 0);
  const credits = lines.reduce((sum, line) => sum + line.credit, 0);
  if (debits !== credits) {
    throw new UnbalancedEntryError(`Debits (${debits}) and credits (${credits}) must be equal.`);
  }
  return { ...entry, lines };
}

/** The entry that undoes another: same accounts, sides swapped. */
export function reversalOf(entry: JournalEntry, date: string, reason: string, actor: { id: string; name: string }): NewJournalEntry {
  return {
    date,
    description: reason.trim() ? `Reversal of JE-${entry.number}: ${reason.trim()}` : `Reversal of JE-${entry.number}`,
    source: "reversal",
    // Same source document, so an order or expense history shows its reversals too.
    sourceId: entry.sourceId,
    reversesId: entry.id,
    uniqueKey: `reversal:${entry.id}`,
    lines: entry.lines.map((line) => ({ accountCode: line.accountCode, debit: line.credit, credit: line.debit, memo: line.memo })),
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/**
 * Split `amount` across `weights` in whole units, so the parts always add up to
 * exactly `amount` (largest-remainder method). This is how a VAT-inclusive total is
 * split into revenue lines without a stray Toman of rounding difference.
 */
export function allocate(amount: number, weights: readonly number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return weights.map(() => 0);
  const exact = weights.map((weight) => (amount * weight) / total);
  const parts = exact.map(Math.floor);
  let remainder = amount - parts.reduce((sum, part) => sum + part, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of order) {
    if (remainder <= 0) break;
    parts[index] += 1;
    remainder -= 1;
  }
  return parts;
}

/** VAT rates are stored in basis points: 1000 = 10%. */
export const DEFAULT_VAT_RATE_BPS = 1000;
export const MAX_VAT_RATE_BPS = 5000;

/** The VAT inside a VAT-inclusive amount, rounded to the nearest Toman. */
export function vatIncluded(gross: number, rateBps: number): number {
  if (rateBps <= 0) return 0;
  return Math.round((gross * rateBps) / (10000 + rateBps));
}

/** The cafe's accounting configuration. */
export type AccountingSettings = {
  /** VAT rate included in menu prices, in basis points (1000 = 10%). */
  vatRateBps: number;
  /**
   * The last day of a closed period: nothing may be posted on or before it. Closing
   * a month locks its numbers for reporting; corrections go into the open period.
   */
  booksClosedThrough?: string;
};

/**
 * Entries that are corrected by reversing them in the journal. Everything an order
 * or an expense posted is corrected from that order or expense instead (cancel,
 * unmark, void), so the document and the books can't disagree.
 */
export function isReversibleSource(source: JournalSource): boolean {
  return source === "manual" || source === "gatewaySettlement";
}
