import { ConflictError } from "../errors/ConflictError";
import { ValidationError } from "../errors/ValidationError";

import { SYSTEM_ACCOUNTS, type JournalSource, type NewJournalEntry } from "./Ledger";

/**
 * The daily cash register close (Z-report).
 *
 * At the end of the day someone counts the till. The books already know how much
 * cash should be there: what the till held when the day began (Cash on hand, 1110,
 * as of the previous evening) plus every cash movement posted on the day — cash
 * sales in, refunds and expenses paid out of the till. The count is compared with
 * that, and any over/short is posted to its own expense account so Cash on hand is
 * brought back to what is physically there. Part of the count can go to the bank
 * the same evening (Dr Bank / Cr Cash).
 *
 * A close is a record, like the journal: one per day, in order, never edited.
 * Days are closed in sequence because a till can only be counted once — a day
 * that was skipped is carried into the next close's opening float, never counted
 * after a later day.
 */

/** One cash movement on the day being closed: a line on Cash on hand (1110). */
export type CashMovementLine = {
  entryId: string;
  number: number;
  description: string;
  source: JournalSource;
  /** Money into the till. */
  debit: number;
  /** Money out of the till. */
  credit: number;
};

/** What the books say about a day's cash, read before the count is entered. */
export type CashDaySnapshot = {
  day: string;
  /** Cash on hand as of the end of the previous day — what the till started with. */
  openingFloat: number;
  /** The day's lines on Cash on hand, in posting order. */
  lines: CashMovementLine[];
};

/** How the day's cash moved, grouped the way a Z-report reads. */
export const CASH_GROUPS = ["sales", "refunds", "expenses", "other"] as const;
export type CashGroup = (typeof CASH_GROUPS)[number];

export type CashDayFigures = {
  day: string;
  openingFloat: number;
  cashIn: number;
  cashOut: number;
  /** openingFloat + cashIn − cashOut: what the count should find. */
  expected: number;
  /** Net movement per group (positive = into the till). */
  breakdown: Record<CashGroup, number>;
  lines: CashMovementLine[];
};

export type CashClose = {
  id: string;
  day: string;
  openingFloat: number;
  cashIn: number;
  cashOut: number;
  expected: number;
  counted: number;
  /** counted − expected: positive is over, negative is short. */
  difference: number;
  /** Taken from the till to the bank at the close. */
  deposited: number;
  /** What stays in the till for tomorrow: counted − deposited. */
  closingFloat: number;
  /** The entry posting the over/short and the deposit; absent when there was neither. */
  entryId?: string;
  entryNumber?: number;
  note?: string;
  closedById: string;
  closedByName: string;
  closedAt: string;
};

export type NewCashClose = Omit<CashClose, "id" | "entryId" | "entryNumber" | "closedAt">;

/** What the person closing the till enters. */
export type CashCountInput = {
  day: string;
  counted: number;
  deposited: number;
  note?: string;
  /**
   * The expected amount the closer was shown, when they were shown one. If the
   * books moved since (a late cash sale), the close is refused so the count is
   * checked against the real figure. Absent for a blind count.
   */
  expectedSeen?: number;
};

/** The status a dashboard needs: when the till was last closed and which days are waiting. */
export type CashCloseStatus = {
  today: string;
  lastClosedDay?: string;
  todayClosed: boolean;
  /** Past days with cash activity and no close, oldest first. */
  unclosedDays: string[];
};

function groupOf(source: JournalSource): CashGroup {
  switch (source) {
    case "orderPayment":
      return "sales";
    case "orderRefund":
    case "orderPaymentReversal":
      return "refunds";
    case "expense":
    case "expensePayment":
      return "expenses";
    default:
      return "other";
  }
}

/** The day's expected cash and how it got there. */
export function cashDayFigures(snapshot: CashDaySnapshot): CashDayFigures {
  const breakdown: Record<CashGroup, number> = { sales: 0, refunds: 0, expenses: 0, other: 0 };
  let cashIn = 0;
  let cashOut = 0;
  for (const line of snapshot.lines) {
    cashIn += line.debit;
    cashOut += line.credit;
    breakdown[groupOf(line.source)] += line.debit - line.credit;
  }
  return {
    day: snapshot.day,
    openingFloat: snapshot.openingFloat,
    cashIn,
    cashOut,
    expected: snapshot.openingFloat + cashIn - cashOut,
    breakdown,
    lines: snapshot.lines,
  };
}

type Actor = { id: string; name: string };

/**
 * The close's journal entry: the over/short against Cash over/short (6800) and the
 * deposit from the till to the bank. `null` when the count matched exactly and
 * nothing was deposited — then the close is only the record.
 */
export function cashCloseEntry(close: Pick<NewCashClose, "day" | "difference" | "deposited">, actor: Actor): NewJournalEntry | null {
  if (close.difference === 0 && close.deposited === 0) return null;
  const lines: NewJournalEntry["lines"] = [];
  if (close.difference < 0) {
    lines.push({ accountCode: SYSTEM_ACCOUNTS.cashOverShort, debit: -close.difference, credit: 0, memo: "Cash short" });
  }
  if (close.deposited > 0) {
    lines.push({ accountCode: SYSTEM_ACCOUNTS.bank, debit: close.deposited, credit: 0, memo: "Cash deposit" });
  }
  if (close.difference > 0) {
    lines.push({ accountCode: SYSTEM_ACCOUNTS.cashOverShort, debit: 0, credit: close.difference, memo: "Cash over" });
  }
  // The till's side, netted: a short and a deposit both take cash out; an over puts it back.
  const tillNet = close.difference - close.deposited;
  if (tillNet > 0) lines.push({ accountCode: SYSTEM_ACCOUNTS.cash, debit: tillNet, credit: 0 });
  if (tillNet < 0) lines.push({ accountCode: SYSTEM_ACCOUNTS.cash, debit: 0, credit: -tillNet });
  return {
    date: close.day,
    description: `Cash close ${close.day}`,
    source: "cashClose",
    uniqueKey: `cashClose:${close.day}`,
    lines,
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/**
 * Turn a count into the close record and its entry, against the books as they are
 * at the moment of closing. Throws `ValidationError` for an impossible count and
 * `ConflictError("CASH_CHANGED")` when the expected amount the closer saw is no
 * longer right.
 */
export function buildCashClose(
  snapshot: CashDaySnapshot,
  input: Omit<CashCountInput, "day">,
  actor: Actor,
): { close: NewCashClose; entry: NewJournalEntry | null } {
  const amounts = [input.counted, input.deposited];
  if (amounts.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new ValidationError("counted", "amountInvalid");
  }
  if (input.deposited > input.counted) throw new ValidationError("deposited", "depositExceedsCount");

  const figures = cashDayFigures(snapshot);
  if (input.expectedSeen !== undefined && input.expectedSeen !== figures.expected) {
    throw new ConflictError("CASH_CHANGED", "Cash moved since the expected amount was shown; check the count again.");
  }

  const close: NewCashClose = {
    day: snapshot.day,
    openingFloat: figures.openingFloat,
    cashIn: figures.cashIn,
    cashOut: figures.cashOut,
    expected: figures.expected,
    counted: input.counted,
    difference: input.counted - figures.expected,
    deposited: input.deposited,
    closingFloat: input.counted - input.deposited,
    note: input.note?.trim() || undefined,
    closedById: actor.id,
    closedByName: actor.name,
  };
  return { close, entry: cashCloseEntry(close, actor) };
}

/**
 * Past days still waiting for a close: days after the last close (or, before any
 * close, any day in the window) that had cash movements, up to yesterday. Today is
 * still trading, so it isn't overdue.
 */
export function unclosedCashDays(activeDays: readonly string[], lastClosedDay: string | undefined, today: string): string[] {
  return [...new Set(activeDays)].filter((day) => day < today && (!lastClosedDay || day > lastClosedDay)).sort();
}
