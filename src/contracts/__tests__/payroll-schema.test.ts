import { describe, expect, it } from "vitest";

import { employeeSchema, payRunSchema, type PayRunFormInput } from "../payroll-schema";

import { flattened } from "./zod-issues";

const LINE = {
  employeeId: "e1",
  gross: "20000000",
  employeeInsurance: "1400000",
  incomeTax: "",
  employerInsurance: "4600000",
};

const RUN: PayRunFormInput = { period: "1405-08", date: "2026-11-05", lines: [LINE] };

describe("payRunSchema", () => {
  it("reads the figures as whole Toman, blanks as zero", () => {
    expect(payRunSchema.parse(RUN).lines).toEqual([
      { employeeId: "e1", gross: 20_000_000, employeeInsurance: 1_400_000, incomeTax: 0, employerInsurance: 4_600_000 },
    ]);
  });

  it.each(["1405-13", "soon", ""])("refuses month %j", (period) => {
    expect(flattened(payRunSchema.safeParse({ ...RUN, period }).error)?.fieldErrors.period).toEqual([
      "payRunMonthInvalid",
    ]);
  });

  it("refuses a run with nobody on it", () => {
    expect(flattened(payRunSchema.safeParse({ ...RUN, lines: [] }).error)?.fieldErrors.lines).toEqual(["payRunEmpty"]);
  });

  it("requires gross pay, and a number in every figure", () => {
    expect(payRunSchema.safeParse({ ...RUN, lines: [{ ...LINE, gross: "" }] }).success).toBe(false);
    expect(payRunSchema.safeParse({ ...RUN, lines: [{ ...LINE, gross: "0" }] }).success).toBe(false);
    expect(payRunSchema.safeParse({ ...RUN, lines: [{ ...LINE, incomeTax: "lots" }] }).success).toBe(false);
  });

  it("refuses deductions above gross, but not the employer's share, which is on top of it", () => {
    const line = (overrides: object) => ({ ...RUN, lines: [{ ...LINE, ...overrides }] });

    expect(payRunSchema.safeParse(line({ gross: "1000", employeeInsurance: "600", incomeTax: "401" })).success).toBe(
      false,
    );
    expect(payRunSchema.safeParse(line({ gross: "1000", employeeInsurance: "600", incomeTax: "400" })).success).toBe(
      true,
    );
    expect(
      payRunSchema.safeParse(line({ gross: "1000", employeeInsurance: "", incomeTax: "", employerInsurance: "5000" }))
        .success,
    ).toBe(true);
  });
});

describe("employeeSchema", () => {
  const EMPLOYEE = { name: " Sara ", position: "", phone: "", monthlySalary: "", isActive: true };

  it("trims the name and reads blanks as nothing set", () => {
    expect(employeeSchema.parse(EMPLOYEE)).toEqual({
      name: "Sara",
      position: undefined,
      phone: undefined,
      monthlySalary: 0,
      isActive: true,
    });
  });

  it("requires a name and a real salary", () => {
    expect(flattened(employeeSchema.safeParse({ ...EMPLOYEE, name: " " }).error)?.fieldErrors.name).toEqual([
      "nameRequired",
    ]);
    expect(employeeSchema.safeParse({ ...EMPLOYEE, monthlySalary: "lots" }).success).toBe(false);
  });
});
