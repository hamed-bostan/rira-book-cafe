import { describe, expect, it } from "vitest";

import { billPeriodSchema, recurringBillSchema, type RecurringBillFormInput } from "../recurring-bill-schema";

import { flattened } from "./zod-issues";

const BILL: RecurringBillFormInput = {
  description: " Rent ",
  accountCode: "6100",
  supplierId: "",
  amount: "30000000",
  vatAmount: "",
  dayOfMonth: 1,
  isActive: true,
};

const fieldErrorsOf = (input: unknown): Record<string, string[] | undefined> | undefined =>
  flattened(recurringBillSchema.safeParse(input).error)?.fieldErrors;

describe("recurringBillSchema", () => {
  it("parses a bill the way an expense's figures parse", () => {
    expect(recurringBillSchema.parse(BILL)).toEqual({
      description: "Rent",
      accountCode: "6100",
      supplierId: undefined,
      amount: 30_000_000,
      vatAmount: 0,
      dayOfMonth: 1,
      isActive: true,
    });
  });

  it.each([0, 32, 1.5, Number.NaN, "1"])("refuses day %s", (dayOfMonth) => {
    expect(fieldErrorsOf({ ...BILL, dayOfMonth })?.dayOfMonth).toEqual(["billDayInvalid"]);
  });

  it("takes the last day any month can have", () => {
    expect(recurringBillSchema.parse({ ...BILL, dayOfMonth: 31 }).dayOfMonth).toBe(31);
  });

  it("refuses VAT that isn't less than the total", () => {
    expect(fieldErrorsOf({ ...BILL, vatAmount: "30000000" })?.vatAmount).toEqual(["vatTooHigh"]);
  });

  it("requires a description, an account and an amount", () => {
    const errors = fieldErrorsOf({ ...BILL, description: " ", accountCode: "", amount: "" });
    expect(errors?.description).toEqual(["descriptionRequired"]);
    expect(errors?.accountCode).toEqual(["accountRequired"]);
    expect(errors?.amount).toBeDefined();
  });
});

describe("billPeriodSchema", () => {
  it("takes a Persian month", () => {
    expect(billPeriodSchema.parse({ period: "1405-08" })).toEqual({ period: "1405-08" });
  });

  it.each(["1405-13", "soon", "", 1405])("refuses %j", (period) => {
    expect(billPeriodSchema.safeParse({ period }).success).toBe(false);
  });
});
