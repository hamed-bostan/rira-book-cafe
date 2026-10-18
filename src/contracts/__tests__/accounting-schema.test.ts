import { describe, expect, it } from "vitest";

import {
  MAX_ENTRY_LINES,
  accountingSettingsSchema,
  ledgerAccountActiveSchema,
  ledgerAccountSchema,
  manualEntrySchema,
  reverseEntrySchema,
  type ManualEntryFormInput,
} from "../accounting-schema";

import { messagesAt } from "./zod-issues";

type EntryLine = ManualEntryFormInput["lines"][number];

const debitLine = (amount: string): EntryLine => ({ accountCode: "6100", debit: amount, credit: "", memo: "" });
const creditLine = (amount: string): EntryLine => ({ accountCode: "1010", debit: "", credit: amount, memo: "" });

const ENTRY: ManualEntryFormInput = {
  date: "2026-10-17",
  description: " October payroll ",
  lines: [
    { accountCode: " 6100 ", debit: "500000", credit: "", memo: " Barista wages " },
    { accountCode: "1010", debit: "", credit: "500000", memo: "" },
  ],
};

describe("manualEntrySchema", () => {
  it("parses a balanced entry into whole-Toman lines", () => {
    expect(manualEntrySchema.parse(ENTRY)).toEqual({
      date: "2026-10-17",
      description: "October payroll",
      lines: [
        { accountCode: "6100", debit: 500000, credit: 0, memo: "Barista wages" },
        { accountCode: "1010", debit: 0, credit: 500000, memo: undefined },
      ],
    });
  });

  it("flags each line that sits on both sides or neither", () => {
    const result = manualEntrySchema.safeParse({
      ...ENTRY,
      lines: [
        { accountCode: "6100", debit: "100", credit: "100", memo: "" },
        { accountCode: "1010", debit: "", credit: "", memo: "" },
      ],
    });
    expect(messagesAt(result, "lines.0.debit")).toEqual(["lineOneSide"]);
    expect(messagesAt(result, "lines.1.debit")).toEqual(["lineOneSide"]);
    // Still balanced (100 = 100), so no entry-level complaint.
    expect(messagesAt(result, "lines")).toEqual([]);
  });

  it("refuses an entry whose debits and credits differ", () => {
    const result = manualEntrySchema.safeParse({ ...ENTRY, lines: [debitLine("500"), creditLine("400")] });
    expect(messagesAt(result, "lines")).toEqual(["entryUnbalanced"]);
  });

  it("needs at least two lines and at most the cap", () => {
    expect(messagesAt(manualEntrySchema.safeParse({ ...ENTRY, lines: [debitLine("1")] }), "lines")).toContain(
      "linesTooFew",
    );

    const tooMany = Array.from({ length: MAX_ENTRY_LINES + 1 }, (_, index) =>
      index % 2 === 0 ? debitLine("10") : creditLine("10"),
    );
    expect(messagesAt(manualEntrySchema.safeParse({ ...ENTRY, lines: tooMany }), "lines")).toContain("linesTooMany");
  });

  it("requires an account on every line, and a description", () => {
    const result = manualEntrySchema.safeParse({
      ...ENTRY,
      description: "  ",
      lines: [{ ...debitLine("10"), accountCode: " " }, creditLine("10")],
    });
    expect(messagesAt(result, "lines.0.accountCode")).toEqual(["accountRequired"]);
    expect(result.error?.flatten().fieldErrors.description).toEqual(["descriptionRequired"]);
  });

  it("caps the description and line memos", () => {
    const result = manualEntrySchema.safeParse({
      ...ENTRY,
      description: "x".repeat(201),
      lines: [{ ...debitLine("10"), memo: "m".repeat(201) }, creditLine("10")],
    });
    expect(result.error?.flatten().fieldErrors.description).toEqual(["textTooLong"]);
    expect(messagesAt(result, "lines.0.memo")).toEqual(["textTooLong"]);
  });

  it("refuses a malformed date", () => {
    expect(manualEntrySchema.safeParse({ ...ENTRY, date: "yesterday" }).error?.flatten().fieldErrors.date).toEqual([
      "dateInvalid",
    ]);
  });
});

describe("reverseEntrySchema", () => {
  it("trims the reason", () => {
    expect(reverseEntrySchema.parse({ date: "2026-10-18", reason: " Typo in amount " })).toEqual({
      date: "2026-10-18",
      reason: "Typo in amount",
    });
  });

  it("requires a reason, within 200 characters", () => {
    expect(
      reverseEntrySchema.safeParse({ date: "2026-10-18", reason: " " }).error?.flatten().fieldErrors.reason,
    ).toEqual(["reasonRequired"]);
    expect(
      reverseEntrySchema.safeParse({ date: "2026-10-18", reason: "r".repeat(201) }).error?.flatten().fieldErrors.reason,
    ).toEqual(["textTooLong"]);
  });
});

describe("ledgerAccountSchema", () => {
  const ACCOUNT = { code: " 6150 ", name: " Cleaning ", nameFa: " نظافت ", type: "expense" } as const;

  it("trims a four-digit code and both names", () => {
    expect(ledgerAccountSchema.parse(ACCOUNT)).toEqual({
      code: "6150",
      name: "Cleaning",
      nameFa: "نظافت",
      type: "expense",
    });
  });

  it("refuses a code that isn't four digits", () => {
    for (const code of ["615", "61500", "61a0"]) {
      expect(ledgerAccountSchema.safeParse({ ...ACCOUNT, code }).error?.flatten().fieldErrors.code).toEqual([
        "accountCodeInvalid",
      ]);
    }
  });

  it("refuses an unknown account type", () => {
    expect(ledgerAccountSchema.safeParse({ ...ACCOUNT, type: "income" }).error?.flatten().fieldErrors.type).toEqual([
      "accountTypeInvalid",
    ]);
  });

  it("requires both names, each within 80 characters", () => {
    const fieldErrors = ledgerAccountSchema
      .safeParse({ ...ACCOUNT, name: "", nameFa: "n".repeat(81) })
      .error?.flatten().fieldErrors;
    expect(fieldErrors?.name).toEqual(["nameRequired"]);
    expect(fieldErrors?.nameFa).toEqual(["textTooLong"]);
  });
});

describe("ledgerAccountActiveSchema", () => {
  it("only takes a boolean", () => {
    expect(ledgerAccountActiveSchema.parse({ isActive: false })).toEqual({ isActive: false });
    expect(ledgerAccountActiveSchema.safeParse({ isActive: "false" }).success).toBe(false);
  });
});

describe("accountingSettingsSchema", () => {
  it("stores the VAT percentage in basis points and reads a blank close date as none", () => {
    expect(accountingSettingsSchema.parse({ vatRate: " 9.5 ", booksClosedThrough: "" })).toEqual({
      vatRate: 950,
      booksClosedThrough: undefined,
    });
    expect(accountingSettingsSchema.parse({ vatRate: "10", booksClosedThrough: " 2026-03-20 " })).toEqual({
      vatRate: 1000,
      booksClosedThrough: "2026-03-20",
    });
  });

  it("accepts the cap and refuses anything above or malformed", () => {
    expect(accountingSettingsSchema.parse({ vatRate: "50", booksClosedThrough: "" }).vatRate).toBe(5000);
    for (const vatRate of ["50.01", "100", "9.555", "-1", ""]) {
      expect(
        accountingSettingsSchema.safeParse({ vatRate, booksClosedThrough: "" }).error?.flatten().fieldErrors.vatRate,
      ).toEqual(["vatRateInvalid"]);
    }
  });

  it("refuses a malformed close date", () => {
    expect(
      accountingSettingsSchema.safeParse({ vatRate: "9", booksClosedThrough: "March" }).error?.flatten().fieldErrors
        .booksClosedThrough,
    ).toEqual(["dateInvalid"]);
  });
});
