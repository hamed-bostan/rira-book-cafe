import { describe, expect, it } from "vitest";

import {
  MAX_MONEY_AMOUNT,
  balanceField,
  countField,
  dayField,
  moneyField,
  optionalMoneyField,
  optionalTextField,
  quantityField,
  signedAmountField,
} from "../money-fields";

import { messagesAt } from "./zod-issues";

describe("moneyField", () => {
  it("trims and converts whole Toman to a number", () => {
    expect(moneyField.parse(" 185000 ")).toBe(185000);
    expect(moneyField.parse(String(MAX_MONEY_AMOUNT))).toBe(MAX_MONEY_AMOUNT);
  });

  it("says a blank amount is required", () => {
    expect(messagesAt(moneyField.safeParse("  "), "")).toContain("amountRequired");
  });

  it("refuses fractions, signs, zero and amounts past the cap", () => {
    for (const value of ["12.5", "-5", "1e3", "0", String(MAX_MONEY_AMOUNT + 1)]) {
      expect(messagesAt(moneyField.safeParse(value), "")).toEqual(["amountInvalid"]);
    }
  });
});

describe("optionalMoneyField", () => {
  it("reads blank as zero", () => {
    expect(optionalMoneyField.parse("")).toBe(0);
    expect(optionalMoneyField.parse("   ")).toBe(0);
    expect(optionalMoneyField.parse(" 25 ")).toBe(25);
  });

  it("refuses non-digits and amounts past the cap", () => {
    expect(messagesAt(optionalMoneyField.safeParse("-5"), "")).toContain("amountInvalid");
    expect(messagesAt(optionalMoneyField.safeParse("abc"), "")).toContain("amountInvalid");
    expect(messagesAt(optionalMoneyField.safeParse(String(MAX_MONEY_AMOUNT + 1)), "")).toEqual(["amountInvalid"]);
  });
});

describe("balanceField", () => {
  it("accepts signed amounts, zero included", () => {
    expect(balanceField.parse("-300")).toBe(-300);
    expect(balanceField.parse(" 0 ")).toBe(0);
    expect(balanceField.parse(String(-MAX_MONEY_AMOUNT))).toBe(-MAX_MONEY_AMOUNT);
  });

  it("requires a value and refuses malformed or oversized ones", () => {
    expect(messagesAt(balanceField.safeParse(""), "")).toContain("amountRequired");
    expect(messagesAt(balanceField.safeParse("1-2"), "")).toEqual(["amountInvalid"]);
    expect(messagesAt(balanceField.safeParse(`-${MAX_MONEY_AMOUNT + 1}`), "")).toEqual(["amountInvalid"]);
  });
});

describe("signedAmountField", () => {
  it("keeps the sign and refuses zero", () => {
    expect(signedAmountField.parse("-5")).toBe(-5);
    expect(signedAmountField.parse("7")).toBe(7);
    expect(messagesAt(signedAmountField.safeParse("0"), "")).toEqual(["amountInvalid"]);
  });
});

describe("dayField", () => {
  it("accepts a trimmed YYYY-MM-DD", () => {
    expect(dayField.parse(" 2026-10-17 ")).toBe("2026-10-17");
  });

  it("separates a missing date from a malformed one", () => {
    expect(messagesAt(dayField.safeParse(""), "")).toContain("dateRequired");
    expect(messagesAt(dayField.safeParse("17/10/2026"), "")).toEqual(["dateInvalid"]);
    expect(messagesAt(dayField.safeParse("2026-13-01"), "")).toEqual(["dateInvalid"]);
  });
});

describe("optionalTextField", () => {
  const field = optionalTextField(5);

  it("trims, and turns blank into undefined", () => {
    expect(field.parse(" hi ")).toBe("hi");
    expect(field.parse("   ")).toBeUndefined();
  });

  it("caps the length after trimming", () => {
    expect(field.parse("  abcde  ")).toBe("abcde");
    expect(messagesAt(field.safeParse("abcdef"), "")).toEqual(["textTooLong"]);
  });
});

describe("quantityField", () => {
  it("accepts whole and decimal quantities up to three places", () => {
    expect(quantityField.parse("18")).toBe(18);
    expect(quantityField.parse(" 0.5 ")).toBe(0.5);
    expect(quantityField.parse("1.125")).toBe(1.125);
    expect(quantityField.parse("10000000")).toBe(10_000_000);
  });

  it("refuses zero, four decimals, signs and oversized quantities", () => {
    for (const value of ["0", "0.000", "1.2345", "-1", ".5", "10000001", ""]) {
      expect(messagesAt(quantityField.safeParse(value), "")).toContain("quantityInvalid");
    }
  });
});

describe("countField", () => {
  it("allows zero", () => {
    expect(countField.parse("0")).toBe(0);
    expect(countField.parse("12.5")).toBe(12.5);
  });

  it("refuses non-numbers and oversized counts", () => {
    expect(messagesAt(countField.safeParse("x"), "")).toContain("quantityInvalid");
    expect(messagesAt(countField.safeParse("10000001"), "")).toEqual(["quantityInvalid"]);
  });
});
