import { describe, expect, it } from "vitest";

import { ConflictError } from "../../errors/ConflictError";
import { ValidationError } from "../../errors/ValidationError";
import {
  assertMatchBalances,
  assertStatementFollows,
  bankFeeEntry,
  bankInterestEntry,
  reconciliationSummary,
  suggestedStatementPeriod,
  suggestMatches,
  type BankStatementLine,
  type LedgerCandidate,
} from "../BankReconciliation";
import { assertBalanced } from "../Ledger";

const ACTOR = { id: "u1", name: "Owner" };

const line = (id: string, date: string, amount: number, matchId?: string): BankStatementLine => ({
  id,
  date,
  description: id,
  amount,
  matchId,
});
const candidate = (lineId: string, date: string, amount: number, matchId?: string): LedgerCandidate => ({
  lineId,
  entryId: `e-${lineId}`,
  entryNumber: 1,
  date,
  description: lineId,
  source: "orderPayment",
  amount,
  matchId,
});

describe("reconciliationSummary", () => {
  it("reconciles when every line is matched and the adjusted book balance equals the closing balance", () => {
    const statement = {
      openingBalance: 1_000,
      closingBalance: 1_500,
      lines: [line("a", "2026-10-02", 700, "m1"), line("b", "2026-10-05", -200, "m2")],
    };
    // The books also hold a 300 deposit made on the last day that the bank shows next month.
    const summary = reconciliationSummary(statement, {
      bookBalance: 1_800,
      outstanding: 300,
      outstandingCount: 1,
      clearedAfter: 0,
    });
    expect(summary).toMatchObject({
      statementTotal: 1_500,
      statementGap: 0,
      adjustedBook: 1_500,
      difference: 0,
      unmatchedLines: 0,
      canReconcile: true,
    });
  });

  it("counts a line the bank cleared before the books recorded it", () => {
    const statement = { openingBalance: 0, closingBalance: 400, lines: [line("a", "2026-10-30", 400, "m1")] };
    const summary = reconciliationSummary(statement, {
      bookBalance: 0,
      outstanding: 0,
      outstandingCount: 0,
      clearedAfter: 400,
    });
    expect(summary.difference).toBe(0);
  });

  it("refuses while a line is unmatched, the lines don't add up, or there's a difference", () => {
    const base = { bookBalance: 1_500, outstanding: 0, outstandingCount: 0, clearedAfter: 0 };
    expect(
      reconciliationSummary(
        { openingBalance: 1_000, closingBalance: 1_500, lines: [line("a", "2026-10-02", 500)] },
        base,
      ).canReconcile,
    ).toBe(false);
    expect(
      reconciliationSummary(
        { openingBalance: 1_000, closingBalance: 1_500, lines: [line("a", "2026-10-02", 400, "m")] },
        base,
      ),
    ).toMatchObject({
      statementGap: 100,
      canReconcile: false,
    });
    expect(
      reconciliationSummary(
        { openingBalance: 1_000, closingBalance: 1_500, lines: [line("a", "2026-10-02", 500, "m")] },
        { ...base, bookBalance: 1_490 },
      ),
    ).toMatchObject({
      difference: 10,
      canReconcile: false,
    });
  });
});

describe("suggestMatches", () => {
  it("pairs a statement line with the one ledger line of the same amount nearby", () => {
    const pairs = suggestMatches(
      [line("s1", "2026-10-05", 990_000)],
      [candidate("l1", "2026-10-03", 990_000), candidate("l2", "2026-10-03", 10_000)],
    );
    expect(pairs).toEqual([{ statementLineId: "s1", ledgerLineId: "l1" }]);
  });

  it("leaves ambiguous amounts and far-apart dates for a person", () => {
    expect(
      suggestMatches(
        [line("s1", "2026-10-05", 50)],
        [candidate("l1", "2026-10-04", 50), candidate("l2", "2026-10-06", 50)],
      ),
    ).toEqual([]);
    expect(
      suggestMatches([line("s1", "2026-10-05", 50), line("s2", "2026-10-06", 50)], [candidate("l1", "2026-10-04", 50)]),
    ).toEqual([]);
    expect(suggestMatches([line("s1", "2026-10-20", 50)], [candidate("l1", "2026-10-04", 50)])).toEqual([]);
  });

  it("ignores lines already matched", () => {
    expect(suggestMatches([line("s1", "2026-10-05", 50, "m")], [candidate("l1", "2026-10-05", 50)])).toEqual([]);
    expect(suggestMatches([line("s1", "2026-10-05", 50)], [candidate("l1", "2026-10-05", 50, "m")])).toEqual([]);
  });
});

describe("assertMatchBalances", () => {
  it("accepts many-to-one matches whose totals agree", () => {
    expect(() => assertMatchBalances([3_000_000], [1_000_000, 1_500_000, 500_000])).not.toThrow();
  });

  it("refuses different totals or an empty side", () => {
    expect(() => assertMatchBalances([100], [99])).toThrow(ConflictError);
    expect(() => assertMatchBalances([], [100])).toThrow(ConflictError);
  });
});

describe("assertStatementFollows", () => {
  it("lets the first statement start anywhere", () => {
    expect(() =>
      assertStatementFollows(null, { fromDay: "2026-09-23", toDay: "2026-10-22", openingBalance: 5 }),
    ).not.toThrow();
  });

  it("refuses an overlapping period and a gap in the balance", () => {
    const previous = { toDay: "2026-09-22", closingBalance: 1_000 };
    expect(() =>
      assertStatementFollows(previous, { fromDay: "2026-09-22", toDay: "2026-10-22", openingBalance: 1_000 }),
    ).toThrow(ConflictError);
    expect(() =>
      assertStatementFollows(previous, { fromDay: "2026-09-23", toDay: "2026-10-22", openingBalance: 999 }),
    ).toThrow(ValidationError);
    expect(() =>
      assertStatementFollows(previous, { fromDay: "2026-09-23", toDay: "2026-10-22", openingBalance: 1_000 }),
    ).not.toThrow();
  });
});

describe("bank postings", () => {
  const statementLine = { date: "2026-10-10", description: "SMS charges", reference: "R1" };

  it("books a fee out of the bank to fees", () => {
    const entry = bankFeeEntry({ ...statementLine, amount: -12_000 }, ACTOR);
    expect(entry.lines).toEqual([
      { accountCode: "6700", debit: 12_000, credit: 0 },
      { accountCode: "1120", debit: 0, credit: 12_000, memo: "R1" },
    ]);
    expect(() => assertBalanced(entry)).not.toThrow();
  });

  it("books interest into the bank as income", () => {
    const entry = bankInterestEntry({ ...statementLine, amount: 80_000 }, ACTOR);
    expect(entry.lines.map((row) => [row.accountCode, row.debit, row.credit])).toEqual([
      ["1120", 80_000, 0],
      ["4800", 0, 80_000],
    ]);
    expect(entry.source).toBe("bankInterest");
  });
});

describe("suggestedStatementPeriod", () => {
  it("is the last full Persian month for the first statement", () => {
    // Today is 24 Mehr 1405: the last full month is Shahrivar.
    expect(suggestedStatementPeriod(undefined, "2026-10-16")).toEqual({ fromDay: "2026-08-23", toDay: "2026-09-22" });
  });

  it("continues the previous statement to the end of its Persian month, never past today", () => {
    expect(suggestedStatementPeriod("2026-08-22", "2026-10-16")).toEqual({
      fromDay: "2026-08-23",
      toDay: "2026-09-22",
    });
    expect(suggestedStatementPeriod("2026-09-22", "2026-10-16")).toEqual({
      fromDay: "2026-09-23",
      toDay: "2026-10-16",
    });
  });
});
