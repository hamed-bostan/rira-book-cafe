import { describe, expect, it } from "vitest";

import { parseStatementAmount, parseStatementCsv, parseStatementDate } from "../parseStatementCsv";

describe("parseStatementDate", () => {
  it("reads Gregorian and Persian dates", () => {
    expect(parseStatementDate("2026-10-16")).toBe("2026-10-16");
    expect(parseStatementDate("2026/1/5")).toBe("2026-01-05");
    expect(parseStatementDate("1405/07/24")).toBe("2026-10-16");
    expect(parseStatementDate("۱۴۰۵/۰۷/۲۴")).toBe("2026-10-16");
  });

  it("refuses impossible dates", () => {
    expect(parseStatementDate("2026-02-30")).toBeNull();
    expect(parseStatementDate("1405/07/31")).toBeNull();
    expect(parseStatementDate("tarikh")).toBeNull();
  });
});

describe("parseStatementAmount", () => {
  it("reads separators, Persian digits and the ways banks write money out", () => {
    expect(parseStatementAmount("2,500,000")).toBe(2_500_000);
    expect(parseStatementAmount("۲٬۵۰۰٬۰۰۰")).toBe(2_500_000);
    expect(parseStatementAmount("-12000")).toBe(-12_000);
    expect(parseStatementAmount("12000-")).toBe(-12_000);
    expect(parseStatementAmount("(12,000)")).toBe(-12_000);
    expect(parseStatementAmount("")).toBe(0);
    expect(parseStatementAmount("12.5")).toBeNull();
  });
});

describe("parseStatementCsv", () => {
  it("reads signed-amount rows and skips a header", () => {
    const parsed = parseStatementCsv(
      'Date,Description,Amount,Ref\n1405/07/01,POS batch,2500000,111\n1405/07/02,"Rent, Mehr",-30000000,222\n',
    );
    expect(parsed.skippedRows).toEqual([]);
    expect(parsed.lines).toEqual([
      { date: "2026-09-23", description: "POS batch", reference: "111", amount: "2500000" },
      { date: "2026-09-24", description: "Rent, Mehr", reference: "222", amount: "-30000000" },
    ]);
  });

  it("reads the withdrawal/deposit layout, tab separated", () => {
    const parsed = parseStatementCsv("1405/07/03\tSMS fee\t12000\t0\tR9\n1405/07/04\tZarinpal\t\t990000\tR10");
    expect(parsed.lines.map((line) => line.amount)).toEqual(["-12000", "990000"]);
  });

  it("reports rows it can't read instead of guessing", () => {
    const parsed = parseStatementCsv("2026-10-01,Deposit,100\n2026-10-02,Broken,abc\nnot a row");
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.skippedRows).toEqual([2, 3]);
  });
});
