import { describe, expect, it } from "vitest";

import { ConflictError } from "../../errors/ConflictError";
import { ValidationError } from "../../errors/ValidationError";
import { buildCashClose, cashCloseEntry, cashDayFigures, unclosedCashDays, type CashDaySnapshot } from "../CashClose";
import { assertBalanced } from "../Ledger";

const ACTOR = { id: "u1", name: "Sara" };

/** A day that opened with 500k: 1.2m of cash sales, a 100k refund and a 150k bill paid from the till. */
const SNAPSHOT: CashDaySnapshot = {
  day: "2026-10-15",
  openingFloat: 500_000,
  lines: [
    { entryId: "e1", number: 1, description: "Order #1", source: "orderPayment", debit: 700_000, credit: 0 },
    { entryId: "e2", number: 2, description: "Order #2", source: "orderPayment", debit: 500_000, credit: 0 },
    { entryId: "e3", number: 3, description: "Order #1 refund", source: "orderRefund", debit: 0, credit: 100_000 },
    { entryId: "e4", number: 4, description: "Milk", source: "expense", debit: 0, credit: 150_000 },
  ],
};

describe("cashDayFigures", () => {
  it("expects the opening float plus cash in minus cash out", () => {
    const figures = cashDayFigures(SNAPSHOT);
    expect(figures).toMatchObject({ openingFloat: 500_000, cashIn: 1_200_000, cashOut: 250_000, expected: 1_450_000 });
    expect(figures.breakdown).toEqual({ sales: 1_200_000, refunds: -100_000, expenses: -150_000, other: 0 });
  });

  it("is just the float on a day with no cash movements", () => {
    expect(cashDayFigures({ day: "2026-10-15", openingFloat: 300_000, lines: [] }).expected).toBe(300_000);
  });
});

describe("cashCloseEntry", () => {
  it("posts nothing when the count was exact and nothing was deposited", () => {
    expect(cashCloseEntry({ day: "2026-10-15", difference: 0, deposited: 0 }, ACTOR)).toBeNull();
  });

  it("books a short as an expense against the till", () => {
    const entry = cashCloseEntry({ day: "2026-10-15", difference: -20_000, deposited: 0 }, ACTOR);
    expect(entry?.lines).toEqual([
      { accountCode: "6800", debit: 20_000, credit: 0, memo: "Cash short" },
      { accountCode: "1110", debit: 0, credit: 20_000 },
    ]);
    expect(entry).toMatchObject({ source: "cashClose", uniqueKey: "cashClose:2026-10-15", date: "2026-10-15" });
  });

  it("books an over back into the till", () => {
    const entry = cashCloseEntry({ day: "2026-10-15", difference: 5_000, deposited: 0 }, ACTOR);
    expect(entry?.lines).toEqual([
      { accountCode: "6800", debit: 0, credit: 5_000, memo: "Cash over" },
      { accountCode: "1110", debit: 5_000, credit: 0 },
    ]);
  });

  it("moves a deposit from the till to the bank, netted with the difference", () => {
    const entry = cashCloseEntry({ day: "2026-10-15", difference: -20_000, deposited: 1_000_000 }, ACTOR);
    expect(entry?.lines).toEqual([
      { accountCode: "6800", debit: 20_000, credit: 0, memo: "Cash short" },
      { accountCode: "1120", debit: 1_000_000, credit: 0, memo: "Cash deposit" },
      { accountCode: "1110", debit: 0, credit: 1_020_000 },
    ]);
  });

  it("drops the till line when an over exactly pays for the deposit", () => {
    const entry = cashCloseEntry({ day: "2026-10-15", difference: 50_000, deposited: 50_000 }, ACTOR);
    expect(entry?.lines.map((line) => line.accountCode)).toEqual(["1120", "6800"]);
  });

  it("always balances", () => {
    for (const difference of [-30_000, -1, 0, 1, 30_000]) {
      for (const deposited of [0, 1, 30_000, 900_000]) {
        const entry = cashCloseEntry({ day: "2026-10-15", difference, deposited }, ACTOR);
        if (entry) expect(() => assertBalanced(entry)).not.toThrow();
      }
    }
  });
});

describe("buildCashClose", () => {
  it("records the count, the over/short and what stays in the till", () => {
    const { close, entry } = buildCashClose(SNAPSHOT, { counted: 1_430_000, deposited: 1_000_000, note: "  float kept  " }, ACTOR);
    expect(close).toMatchObject({
      day: "2026-10-15",
      expected: 1_450_000,
      counted: 1_430_000,
      difference: -20_000,
      deposited: 1_000_000,
      closingFloat: 430_000,
      note: "float kept",
      closedByName: "Sara",
    });
    expect(entry?.lines.find((line) => line.accountCode === "1110")?.credit).toBe(1_020_000);
  });

  it("refuses to deposit more than was counted", () => {
    expect(() => buildCashClose(SNAPSHOT, { counted: 100, deposited: 101 }, ACTOR)).toThrow(ValidationError);
  });

  it("refuses an amount that isn't whole Toman", () => {
    expect(() => buildCashClose(SNAPSHOT, { counted: 10.5, deposited: 0 }, ACTOR)).toThrow(ValidationError);
    expect(() => buildCashClose(SNAPSHOT, { counted: -1, deposited: 0 }, ACTOR)).toThrow(ValidationError);
  });

  it("refuses a manager's count when cash moved since the expected amount was shown", () => {
    expect(() => buildCashClose(SNAPSHOT, { counted: 1_450_000, deposited: 0, expectedSeen: 1_300_000 }, ACTOR)).toThrow(ConflictError);
    expect(buildCashClose(SNAPSHOT, { counted: 1_450_000, deposited: 0, expectedSeen: 1_450_000 }, ACTOR).entry).toBeNull();
  });
});

describe("unclosedCashDays", () => {
  it("lists past days with cash activity after the last close, oldest first", () => {
    expect(unclosedCashDays(["2026-10-16", "2026-10-12", "2026-10-14", "2026-10-14", "2026-10-10"], "2026-10-11", "2026-10-16")).toEqual([
      "2026-10-12",
      "2026-10-14",
    ]);
  });

  it("counts every active day before the first close", () => {
    expect(unclosedCashDays(["2026-10-14"], undefined, "2026-10-16")).toEqual(["2026-10-14"]);
  });
});
