import { describe, expect, it } from "vitest";

import { MAX_EXPENSE_DESCRIPTION_LENGTH } from "@/src/domain/entities/Expense";

import {
  EXPENSE_PAYMENT_CHOICES,
  expenseSchema,
  payExpenseSchema,
  supplierSchema,
  voidExpenseSchema,
  type ExpenseFormInput,
  type SupplierFormInput,
} from "../expense-schema";

import { flattened } from "./zod-issues";

const EXPENSE: ExpenseFormInput = {
  date: "2026-10-17",
  supplierId: " sup-1 ",
  accountCode: "6200",
  description: " Milk, October ",
  amount: "1100000",
  vatAmount: "100000",
  payment: "cash",
};

const fieldErrorsOf = (input: unknown): Record<string, string[] | undefined> | undefined =>
  flattened(expenseSchema.safeParse(input).error)?.fieldErrors;

describe("EXPENSE_PAYMENT_CHOICES", () => {
  it("offers on-account plus every payment source", () => {
    expect(EXPENSE_PAYMENT_CHOICES).toEqual(["unpaid", "cash", "bank"]);
  });
});

describe("expenseSchema", () => {
  it("parses amounts and turns the payment choice into a paying source", () => {
    expect(expenseSchema.parse(EXPENSE)).toEqual({
      date: "2026-10-17",
      supplierId: "sup-1",
      accountCode: "6200",
      description: "Milk, October",
      amount: 1100000,
      vatAmount: 100000,
      paidFrom: "cash",
    });
  });

  it("books an unpaid expense with no supplier and no VAT", () => {
    const parsed = expenseSchema.parse({ ...EXPENSE, supplierId: "  ", vatAmount: "", payment: "unpaid" });
    expect(parsed).toMatchObject({ supplierId: undefined, vatAmount: 0, paidFrom: undefined });
    expect(parsed).not.toHaveProperty("payment");
  });

  it("refuses VAT that isn't less than the total", () => {
    expect(fieldErrorsOf({ ...EXPENSE, vatAmount: "1100000" })?.vatAmount).toEqual(["vatTooHigh"]);
    expect(fieldErrorsOf({ ...EXPENSE, vatAmount: "1200000" })?.vatAmount).toEqual(["vatTooHigh"]);
  });

  it("maps each invalid field to its message key", () => {
    const fieldErrors = fieldErrorsOf({ ...EXPENSE, accountCode: " ", description: "", amount: "", payment: "card" });
    expect(fieldErrors?.accountCode).toEqual(["accountRequired"]);
    expect(fieldErrors?.description).toEqual(["descriptionRequired"]);
    expect(fieldErrors?.amount).toContain("amountRequired");
    expect(fieldErrors?.payment).toEqual(["paymentInvalid"]);
    // The VAT comparison is skipped while the amount itself is unreadable.
    expect(fieldErrors?.vatAmount).toBeUndefined();
  });

  it("caps the description", () => {
    expect(
      fieldErrorsOf({ ...EXPENSE, description: "d".repeat(MAX_EXPENSE_DESCRIPTION_LENGTH + 1) })?.description,
    ).toEqual(["textTooLong"]);
  });
});

describe("payExpenseSchema", () => {
  it("pays from cash or bank on a day", () => {
    expect(payExpenseSchema.parse({ source: "bank", paidOn: " 2026-10-20 " })).toEqual({
      source: "bank",
      paidOn: "2026-10-20",
    });
  });

  it("refuses paying from 'unpaid' and a missing day", () => {
    const fieldErrors = flattened(payExpenseSchema.safeParse({ source: "unpaid", paidOn: "" }).error)?.fieldErrors;
    expect(fieldErrors?.source).toEqual(["paymentInvalid"]);
    expect(fieldErrors?.paidOn).toContain("dateRequired");
  });
});

describe("voidExpenseSchema", () => {
  it("allows a blank reason and caps a long one", () => {
    expect(voidExpenseSchema.parse({ reason: "  " })).toEqual({ reason: "" });
    expect(voidExpenseSchema.parse({ reason: " Duplicate " })).toEqual({ reason: "Duplicate" });
    expect(flattened(voidExpenseSchema.safeParse({ reason: "r".repeat(201) }).error)?.fieldErrors.reason).toEqual([
      "textTooLong",
    ]);
  });
});

describe("supplierSchema", () => {
  const SUPPLIER: SupplierFormInput = { name: " Dairy Co ", phone: "", note: " Delivers Mondays ", isActive: true };

  it("trims the name and blanks optional text", () => {
    expect(supplierSchema.parse(SUPPLIER)).toEqual({
      name: "Dairy Co",
      phone: undefined,
      note: "Delivers Mondays",
      isActive: true,
    });
  });

  it("maps each invalid field to its message key", () => {
    const fieldErrors = flattened(
      supplierSchema.safeParse({ ...SUPPLIER, name: " ", phone: "1".repeat(31), note: "n".repeat(301) }).error,
    )?.fieldErrors;
    expect(fieldErrors).toEqual({ name: ["nameRequired"], phone: ["textTooLong"], note: ["textTooLong"] });
    expect(flattened(supplierSchema.safeParse({ ...SUPPLIER, name: "n".repeat(121) }).error)?.fieldErrors.name).toEqual(
      ["textTooLong"],
    );
  });
});
