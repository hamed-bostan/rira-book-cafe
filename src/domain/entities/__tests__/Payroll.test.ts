import { describe, expect, it } from "vitest";

import { assertBalanced, SYSTEM_ACCOUNTS } from "../Ledger";
import { defaultPayDate, netPay, payRunOwed, payRunTotals, type PayRun, type PayRunLine } from "../Payroll";
import { payrollEntry, payrollPaymentEntry } from "../Postings";

const ACTOR = { id: "owner", name: "Rira" };

const SARA: PayRunLine = {
  employeeId: "e1",
  employeeName: "Sara",
  gross: 20_000_000,
  employeeInsurance: 1_400_000,
  incomeTax: 600_000,
  employerInsurance: 4_600_000,
};

const ALI: PayRunLine = {
  employeeId: "e2",
  employeeName: "Ali",
  gross: 15_000_000,
  employeeInsurance: 1_050_000,
  incomeTax: 0,
  employerInsurance: 3_450_000,
};

const RUN: PayRun = {
  id: "r1",
  period: "1405-08",
  date: "2026-11-21",
  status: "unpaid",
  lines: [SARA, ALI],
  paidAmount: 0,
  createdById: ACTOR.id,
  createdByName: ACTOR.name,
  createdAt: "",
};

describe("netPay", () => {
  it("takes the employee's insurance and tax off their gross, but not the employer's share", () => {
    expect(netPay(SARA)).toBe(18_000_000);
  });
});

describe("payRunTotals", () => {
  it("adds everyone up", () => {
    expect(payRunTotals(RUN.lines)).toEqual({
      gross: 35_000_000,
      employeeInsurance: 2_450_000,
      incomeTax: 600_000,
      employerInsurance: 8_050_000,
      net: 31_950_000,
    });
  });
});

describe("payRunOwed", () => {
  it("is what's left of the net pay", () => {
    expect(payRunOwed({ ...RUN, paidAmount: 10_000_000 })).toBe(21_950_000);
  });

  it.each(["paid", "void"] as const)("is nothing once it's %s", (status) => {
    expect(payRunOwed({ ...RUN, status })).toBe(0);
  });
});

describe("defaultPayDate", () => {
  it("books a finished month on its last day", () => {
    expect(defaultPayDate("1405-07", "2026-11-05")).toBe("2026-10-22");
  });

  it("books this month today, because its last day is still to come", () => {
    expect(defaultPayDate("1405-08", "2026-11-05")).toBe("2026-11-05");
  });
});

describe("payrollEntry", () => {
  it("books the cost, and what's owed to the staff and both offices, in balance", () => {
    const entry = assertBalanced(payrollEntry(RUN, ACTOR));

    expect(entry).toMatchObject({
      date: "2026-11-21",
      source: "payroll",
      sourceId: "r1",
      uniqueKey: "payroll:r1",
      description: "Payroll 1405-08",
    });
    expect(entry.lines).toEqual([
      { accountCode: SYSTEM_ACCOUNTS.salaries, debit: 35_000_000, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.employerInsurance, debit: 8_050_000, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.salariesPayable, debit: 0, credit: 31_950_000 },
      { accountCode: SYSTEM_ACCOUNTS.insurancePayable, debit: 0, credit: 10_500_000 },
      { accountCode: SYSTEM_ACCOUNTS.payrollTaxPayable, debit: 0, credit: 600_000 },
    ]);
  });

  it("drops what a month didn't have", () => {
    const plain: PayRunLine = { ...SARA, employeeInsurance: 0, incomeTax: 0, employerInsurance: 0 };

    expect(assertBalanced(payrollEntry({ ...RUN, lines: [plain] }, ACTOR)).lines).toEqual([
      { accountCode: SYSTEM_ACCOUNTS.salaries, debit: 20_000_000, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.salariesPayable, debit: 0, credit: 20_000_000 },
    ]);
  });

  it("says nothing about who earned what", () => {
    const written = JSON.stringify(payrollEntry(RUN, ACTOR));

    expect(written).not.toContain("Sara");
    expect(written).not.toContain("Ali");
    expect(written).not.toContain(String(SARA.gross));
  });
});

describe("payrollPaymentEntry", () => {
  it("clears salaries payable out of the chosen account, keyed on what's been paid so far", () => {
    const entry = payrollPaymentEntry(
      { ...RUN, paidAmount: 10_000_000 },
      { amount: 10_000_000, source: "bank", date: "2026-11-22" },
      ACTOR,
    );

    expect(entry).toMatchObject({
      date: "2026-11-22",
      source: "payrollPayment",
      sourceId: "r1",
      uniqueKey: "payroll:r1:payment:10000000",
    });
    expect(entry.lines).toEqual([
      { accountCode: SYSTEM_ACCOUNTS.salariesPayable, debit: 10_000_000, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.bank, debit: 0, credit: 10_000_000 },
    ]);
  });

  it("takes cash from the till", () => {
    const entry = payrollPaymentEntry(RUN, { amount: 5, source: "cash", date: "2026-11-22" }, ACTOR);

    expect(entry.lines[1].accountCode).toBe(SYSTEM_ACCOUNTS.cash);
  });
});
