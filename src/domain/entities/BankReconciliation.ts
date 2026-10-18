import { ConflictError } from "../errors/ConflictError";
import { ValidationError } from "../errors/ValidationError";

import { shiftCafeDay } from "./CafeTime";
import { completeMonthsBefore, jalaliMonthDays, toJalali } from "./JalaliCalendar";
import { SYSTEM_ACCOUNTS, type JournalSource, type NewJournalEntry } from "./Ledger";

/**
 * Bank reconciliation: proving the Bank account (1120) against the bank's own
 * statement.
 *
 * A statement covers a period (usually a Persian month) and lists every movement
 * the bank saw, with its opening and closing balance. Each statement line is
 * matched to the ledger lines on 1120 that are the same money — one card-terminal
 * batch on the statement can be many card payments in the books, so a match joins
 * any number of lines on each side whose totals agree. What the bank did that the
 * books don't know yet (fees, interest, a gateway payout) is posted straight from
 * the statement line and matched in the same step.
 *
 * The proof is the classic one:
 *
 *     book balance at the period end
 *   − outstanding items (ledger lines in the books, not yet on any statement)
 *   + items the bank cleared in the period that the books date after it
 *   = adjusted book balance, which must equal the statement's closing balance.
 *
 * A statement whose lines are all matched and whose difference is zero can be
 * marked reconciled; from then on its lines and matches are frozen. Statements are
 * reconciled in order, each opening where the previous one closed.
 */

export const BANK_STATEMENT_STATUSES = ["open", "reconciled"] as const;
export type BankStatementStatus = (typeof BANK_STATEMENT_STATUSES)[number];

export type BankStatementLine = {
  id: string;
  date: string;
  description: string;
  reference?: string;
  /** Whole Toman, signed: positive is money into the account, negative out. */
  amount: number;
  /** The match this line belongs to; absent while unmatched. */
  matchId?: string;
};

export type BankStatement = {
  id: string;
  accountCode: string;
  fromDay: string;
  toDay: string;
  openingBalance: number;
  closingBalance: number;
  status: BankStatementStatus;
  lines: BankStatementLine[];
  createdByName: string;
  createdAt: string;
  reconciledByName?: string;
  reconciledAt?: string;
};

/** A statement in the list: totals instead of its lines. */
export type BankStatementSummary = Omit<BankStatement, "lines"> & { lineCount: number; unmatchedCount: number };

/** A line on the Bank account that can be matched to the statement. */
export type LedgerCandidate = {
  /** The journal line's id. */
  lineId: string;
  entryId: string;
  entryNumber: number;
  date: string;
  description: string;
  source: JournalSource;
  memo?: string;
  /** Signed like a statement line: debit − credit. */
  amount: number;
  /** Set when matched (on this statement). */
  matchId?: string;
};

export type NewStatementLine = Omit<BankStatementLine, "id" | "matchId">;

export type NewBankStatement = {
  fromDay: string;
  toDay: string;
  openingBalance: number;
  closingBalance: number;
  lines: NewStatementLine[];
  createdById: string;
  createdByName: string;
};

/** The ledger side of the proof, computed by the repository for one statement. */
export type BookFigures = {
  /** Bank (1120) balance as of the statement's last day. */
  bookBalance: number;
  /**
   * Ledger lines dated from the first statement's start to this one's last day
   * that this and earlier statements haven't cleared, net — deposits in transit,
   * payments the bank hasn't seen yet.
   */
  outstanding: number;
  outstandingCount: number;
  /** Ledger lines dated after the last day that this or an earlier statement already cleared, net. */
  clearedAfter: number;
};

export type ReconciliationSummary = BookFigures & {
  /** Opening balance plus the statement's lines. */
  statementTotal: number;
  /** Closing balance − statementTotal: non-zero means the lines entered don't add up to the statement. */
  statementGap: number;
  adjustedBook: number;
  /** Closing balance − adjusted book balance. */
  difference: number;
  unmatchedLines: number;
  canReconcile: boolean;
};

export function reconciliationSummary(
  statement: Pick<BankStatement, "openingBalance" | "closingBalance" | "lines">,
  book: BookFigures,
): ReconciliationSummary {
  const statementTotal = statement.openingBalance + statement.lines.reduce((sum, line) => sum + line.amount, 0);
  const adjustedBook = book.bookBalance - book.outstanding + book.clearedAfter;
  const unmatchedLines = statement.lines.filter((line) => !line.matchId).length;
  const statementGap = statement.closingBalance - statementTotal;
  const difference = statement.closingBalance - adjustedBook;
  return {
    ...book,
    statementTotal,
    statementGap,
    adjustedBook,
    difference,
    unmatchedLines,
    canReconcile: unmatchedLines === 0 && statementGap === 0 && difference === 0,
  };
}

/**
 * A new statement continues the last one: its period starts after the previous
 * period ends, and it opens at the previous closing balance — otherwise money went
 * missing between the two.
 */
export function assertStatementFollows(
  previous: Pick<BankStatement, "toDay" | "closingBalance"> | null,
  next: Pick<NewBankStatement, "fromDay" | "toDay" | "openingBalance">,
): void {
  if (next.fromDay > next.toDay) throw new ValidationError("toDay", "periodEndsBeforeStart");
  if (!previous) return;
  if (next.fromDay <= previous.toDay) {
    throw new ConflictError("STATEMENT_OVERLAP", `A statement already covers up to ${previous.toDay}; start after it.`);
  }
  if (next.openingBalance !== previous.closingBalance) {
    throw new ValidationError("openingBalance", "openingMustMatchPrevious");
  }
}

/** A match needs at least one line on each side, and both sides must total the same. */
export function assertMatchBalances(statementAmounts: readonly number[], ledgerAmounts: readonly number[]): void {
  if (statementAmounts.length === 0 || ledgerAmounts.length === 0) {
    throw new ConflictError("MATCH_UNBALANCED", "Pick at least one statement line and one ledger line.");
  }
  const bank = statementAmounts.reduce((sum, amount) => sum + amount, 0);
  const books = ledgerAmounts.reduce((sum, amount) => sum + amount, 0);
  if (bank !== books)
    throw new ConflictError(
      "MATCH_UNBALANCED",
      `The statement lines (${bank}) and ledger lines (${books}) don't add up to the same amount.`,
    );
}

/** How many days apart a statement line and a ledger line may be and still be suggested as a match. */
export const MATCH_WINDOW_DAYS = 7;

const dayNumber = (day: string): number => Date.parse(`${day}T00:00:00Z`) / 86_400_000;

export type MatchPair = { statementLineId: string; ledgerLineId: string };

/**
 * One-to-one matches it's safe to make without asking: a statement line and a
 * ledger line with exactly the same amount, within the window, where neither has
 * another candidate. Anything ambiguous is left for a person.
 */
export function suggestMatches(
  lines: readonly BankStatementLine[],
  candidates: readonly LedgerCandidate[],
  windowDays: number = MATCH_WINDOW_DAYS,
): MatchPair[] {
  const openLines = lines.filter((line) => !line.matchId);
  const openCandidates = candidates.filter((candidate) => !candidate.matchId);
  const near = (line: BankStatementLine, candidate: LedgerCandidate): boolean =>
    line.amount === candidate.amount && Math.abs(dayNumber(line.date) - dayNumber(candidate.date)) <= windowDays;

  const pairs: MatchPair[] = [];
  for (const line of openLines) {
    const options = openCandidates.filter((candidate) => near(line, candidate));
    if (options.length !== 1) continue;
    const [candidate] = options;
    const rivals = openLines.filter((other) => near(other, candidate));
    if (rivals.length !== 1) continue;
    pairs.push({ statementLineId: line.id, ledgerLineId: candidate.lineId });
  }
  return pairs;
}

type Actor = { id: string; name: string };

/** What the bank did on its own that a statement line records. */
export const BANK_LINE_POSTINGS = ["fee", "interest", "gatewayPayout"] as const;
export type BankLinePosting = (typeof BANK_LINE_POSTINGS)[number];

const lineLabel = (line: Pick<BankStatementLine, "description" | "reference">): string =>
  line.reference ? `${line.description} (${line.reference})` : line.description;

/** A bank charge from the statement: Dr Bank and gateway fees / Cr Bank. */
export function bankFeeEntry(
  line: Pick<BankStatementLine, "date" | "amount" | "description" | "reference">,
  actor: Actor,
): NewJournalEntry {
  const amount = -line.amount;
  return {
    date: line.date,
    description: `Bank fee — ${lineLabel(line)}`,
    source: "bankFee",
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.gatewayFees, debit: amount, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.bank, debit: 0, credit: amount, memo: line.reference },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/** Interest the bank paid: Dr Bank / Cr Bank interest income. */
export function bankInterestEntry(
  line: Pick<BankStatementLine, "date" | "amount" | "description" | "reference">,
  actor: Actor,
): NewJournalEntry {
  return {
    date: line.date,
    description: `Bank interest — ${lineLabel(line)}`,
    source: "bankInterest",
    lines: [
      { accountCode: SYSTEM_ACCOUNTS.bank, debit: line.amount, credit: 0, memo: line.reference },
      { accountCode: SYSTEM_ACCOUNTS.bankInterest, debit: 0, credit: line.amount },
    ],
    createdById: actor.id,
    createdByName: actor.name,
  };
}

/**
 * The period a new statement most likely covers: the rest of the Persian month
 * after the previous statement ends, or the last full Persian month when this is
 * the first statement. Never past today.
 */
export function suggestedStatementPeriod(
  previousToDay: string | undefined,
  today: string,
): { fromDay: string; toDay: string } {
  if (!previousToDay) return completeMonthsBefore(toJalali(today), 1);
  const fromDay = shiftCafeDay(previousToDay, 1);
  const month = toJalali(fromDay);
  const monthEnd = jalaliMonthDays(month.jy, month.jm).toDay;
  const toDay = monthEnd < today ? monthEnd : today;
  return { fromDay, toDay: toDay < fromDay ? fromDay : toDay };
}
