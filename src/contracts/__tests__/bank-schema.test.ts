import { describe, expect, it } from "vitest";

import {
  MAX_STATEMENT_LINES,
  bankMatchSchema,
  bankStatementSchema,
  recordStatementLineSchema,
  statementLineSchema,
  statementLinesSchema,
  type BankStatementFormInput,
  type StatementLineFormInput,
} from "../bank-schema";

import { messagesAt } from "./zod-issues";

const LINE: StatementLineFormInput = {
  date: "2026-10-01",
  description: " Card terminal fee ",
  reference: "",
  amount: "-25000",
};

const STATEMENT: BankStatementFormInput = {
  fromDay: "2026-09-23",
  toDay: "2026-10-22",
  openingBalance: "1000000",
  closingBalance: "-50000",
  lines: [LINE],
};

describe("statementLineSchema", () => {
  it("trims text, blanks the reference and keeps the amount's sign", () => {
    expect(statementLineSchema.parse(LINE)).toEqual({
      date: "2026-10-01",
      description: "Card terminal fee",
      reference: undefined,
      amount: -25000,
    });
    expect(statementLineSchema.parse({ ...LINE, reference: " TRX-9 ", amount: "120000" })).toMatchObject({ reference: "TRX-9", amount: 120000 });
  });

  it("refuses a zero movement, a missing description and an oversized reference", () => {
    const fieldErrors = statementLineSchema.safeParse({ ...LINE, amount: "0", description: " ", reference: "r".repeat(81) }).error?.flatten()
      .fieldErrors;
    expect(fieldErrors?.amount).toEqual(["amountInvalid"]);
    expect(fieldErrors?.description).toEqual(["descriptionRequired"]);
    expect(fieldErrors?.reference).toEqual(["textTooLong"]);
  });

  it("caps the description at 200 characters", () => {
    expect(statementLineSchema.safeParse({ ...LINE, description: "d".repeat(201) }).error?.flatten().fieldErrors.description).toEqual([
      "textTooLong",
    ]);
  });
});

describe("bankStatementSchema", () => {
  it("parses signed balances and the period's lines", () => {
    expect(bankStatementSchema.parse(STATEMENT)).toMatchObject({
      fromDay: "2026-09-23",
      toDay: "2026-10-22",
      openingBalance: 1000000,
      closingBalance: -50000,
      lines: [{ amount: -25000 }],
    });
  });

  it("accepts an empty statement and lines on either boundary day", () => {
    expect(bankStatementSchema.safeParse({ ...STATEMENT, lines: [] }).success).toBe(true);
    const boundaries = [
      { ...LINE, date: STATEMENT.fromDay },
      { ...LINE, date: STATEMENT.toDay },
    ];
    const result = bankStatementSchema.safeParse({ ...STATEMENT, lines: boundaries });
    expect(result.success).toBe(true);
    expect(messagesAt(result, "lines")).toEqual([]);
  });

  it("refuses a period that ends before it starts", () => {
    const result = bankStatementSchema.safeParse({ ...STATEMENT, fromDay: "2026-10-22", toDay: "2026-09-23", lines: [] });
    expect(messagesAt(result, "toDay")).toEqual(["periodEndsBeforeStart"]);
  });

  it("refuses a line outside the period", () => {
    for (const date of ["2026-09-22", "2026-10-23"]) {
      const result = bankStatementSchema.safeParse({ ...STATEMENT, lines: [{ ...LINE, date }] });
      expect(messagesAt(result, "lines")).toEqual(["lineOutsidePeriod"]);
    }
  });

  it("requires both balances", () => {
    const fieldErrors = bankStatementSchema.safeParse({ ...STATEMENT, openingBalance: "", closingBalance: "1.5" }).error?.flatten().fieldErrors;
    expect(fieldErrors?.openingBalance).toContain("amountRequired");
    expect(fieldErrors?.closingBalance).toEqual(["amountInvalid"]);
  });

  it("caps the number of lines", () => {
    const lines = Array.from({ length: MAX_STATEMENT_LINES + 1 }, () => LINE);
    expect(messagesAt(bankStatementSchema.safeParse({ ...STATEMENT, lines }), "lines")).toContain("linesTooMany");
  });
});

describe("statementLinesSchema", () => {
  it("needs at least one line and at most the cap", () => {
    expect(statementLinesSchema.safeParse({ lines: [LINE] }).success).toBe(true);
    expect(statementLinesSchema.safeParse({ lines: [] }).error?.flatten().fieldErrors.lines).toEqual(["linesRequired"]);
    const lines = Array.from({ length: MAX_STATEMENT_LINES + 1 }, () => LINE);
    expect(statementLinesSchema.safeParse({ lines }).error?.flatten().fieldErrors.lines).toEqual(["linesTooMany"]);
  });
});

describe("bankMatchSchema", () => {
  it("trims the ids on both sides", () => {
    expect(bankMatchSchema.parse({ statementLineIds: [" s1 "], ledgerLineIds: ["l1", "l2"] })).toEqual({
      statementLineIds: ["s1"],
      ledgerLineIds: ["l1", "l2"],
    });
  });

  it("needs a line on each side, none blank, within the cap", () => {
    const empty = bankMatchSchema.safeParse({ statementLineIds: [], ledgerLineIds: [" "] });
    expect(messagesAt(empty, "statementLineIds")).toEqual(["linesRequired"]);
    expect(messagesAt(empty, "ledgerLineIds.0")).toHaveLength(1);

    const ids = Array.from({ length: 501 }, (_, index) => `l${index}`);
    expect(messagesAt(bankMatchSchema.safeParse({ statementLineIds: ["s1"], ledgerLineIds: ids }), "ledgerLineIds")).toEqual(["linesTooMany"]);
  });
});

describe("recordStatementLineSchema", () => {
  it("parses the posting kind and its fee (blank: none)", () => {
    expect(recordStatementLineSchema.parse({ kind: "gatewayPayout", fee: "1200" })).toEqual({ kind: "gatewayPayout", fee: 1200 });
    expect(recordStatementLineSchema.parse({ kind: "fee", fee: "" })).toEqual({ kind: "fee", fee: 0 });
  });

  it("refuses an unknown posting kind", () => {
    expect(recordStatementLineSchema.safeParse({ kind: "refund", fee: "" }).error?.flatten().fieldErrors.kind).toEqual(["postingKindInvalid"]);
  });
});
