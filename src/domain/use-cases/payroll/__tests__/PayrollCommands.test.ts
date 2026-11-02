import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { NotFoundError } from "../../../errors/NotFoundError";
import { DraftPayRun } from "../DraftPayRun";
import { PayPayRun, RecordPayRun, SaveEmployee, VoidPayRun, type RecordPayRunInput } from "../PayrollCommands";

import type { Employee, PayRun, PayRunLine } from "../../../entities/Payroll";
import type { IPayrollRepository } from "../../../repositories/IPayrollRepository";

const ACTOR = { id: "owner", name: "Rira" };
/** 13:30 in Tehran on 2026-11-05: 14 Aban 1405. */
const NOW = new Date("2026-11-05T10:00:00Z");

const LINE: Omit<PayRunLine, "employeeName"> = {
  employeeId: "e1",
  gross: 20_000_000,
  employeeInsurance: 1_400_000,
  incomeTax: 600_000,
  employerInsurance: 4_600_000,
};

const INPUT: RecordPayRunInput = { period: "1405-08", date: "2026-11-05", lines: [LINE] };

const RUN: PayRun = {
  id: "r1",
  period: "1405-08",
  date: "2026-11-01",
  status: "unpaid",
  lines: [{ ...LINE, employeeName: "Sara" }],
  paidAmount: 0,
  createdById: ACTOR.id,
  createdByName: ACTOR.name,
  createdAt: "",
};

const SARA: Employee = { id: "e1", name: "Sara", monthlySalary: 20_000_000, isActive: true, createdAt: "" };

function payrollWith(run: PayRun | null = RUN, options: { employees?: Employee[]; runs?: PayRun[] } = {}) {
  const createRun = vi.fn<IPayrollRepository["createRun"]>(async () => RUN);
  const payRun = vi.fn<IPayrollRepository["payRun"]>(async (_id, payment) => {
    const paidAmount = payment.expectedPaid + payment.amount;
    return { ...RUN, ...run, paidAmount, status: paidAmount >= 18_000_000 ? "paid" : "unpaid" };
  });
  const voidRun = vi.fn<IPayrollRepository["voidRun"]>(async () => ({ ...RUN, status: "void" }));
  const createEmployee = vi.fn<IPayrollRepository["createEmployee"]>(async () => SARA);
  const updateEmployee = vi.fn<IPayrollRepository["updateEmployee"]>(async () => SARA);
  const repo = {
    getRun: vi.fn(async () => run),
    listRuns: vi.fn(async () => options.runs ?? []),
    listEmployees: vi.fn(async () => options.employees ?? []),
    getEmployee: vi.fn(async () => options.employees?.[0] ?? null),
    createRun,
    payRun,
    voidRun,
    createEmployee,
    updateEmployee,
  } as unknown as IPayrollRepository;
  return { repo, createRun, payRun, voidRun, createEmployee, updateEmployee };
}

describe("RecordPayRun", () => {
  it("records the month under the actor, and posts it", async () => {
    const { repo, createRun } = payrollWith();
    await new RecordPayRun(repo).execute(INPUT, ACTOR, NOW);

    const [sent, ledger] = createRun.mock.calls[0];
    expect(sent).toMatchObject({ period: "1405-08", createdById: "owner", createdByName: "Rira" });
    expect(ledger(RUN, { vatRateBps: 1000 })[0]).toMatchObject({ source: "payroll", sourceId: "r1" });
  });

  it("logs the month, and no figure of anyone's", async () => {
    const { repo, createRun } = payrollWith();
    await new RecordPayRun(repo).execute(INPUT, ACTOR, NOW);

    const entry = createRun.mock.calls[0][2]?.(RUN);
    expect(entry).toMatchObject({
      action: "payroll.recorded",
      entityType: "payroll",
      entityLabel: "1405-08",
      changes: [{ field: "period", before: null, after: "1405-08" }],
    });
    expect(JSON.stringify(entry)).not.toContain("20000000");
  });

  it.each<[string, Partial<RecordPayRunInput>, string]>([
    ["something that isn't a month", { period: "soon" }, "period"],
    ["a future date", { date: "2026-11-06" }, "date"],
    ["a date before the month starts", { date: "2026-10-22" }, "date"],
    ["nobody on it", { lines: [] }, "lines"],
    ["someone on it twice", { lines: [LINE, LINE] }, "lines"],
    ["no gross", { lines: [{ ...LINE, gross: 0 }] }, "lines"],
    ["a negative deduction", { lines: [{ ...LINE, incomeTax: -1 }] }, "lines"],
    ["a fractional amount", { lines: [{ ...LINE, gross: 10.5 }] }, "lines"],
    ["deductions above gross", { lines: [{ ...LINE, incomeTax: 19_000_000 }] }, "lines"],
  ])("refuses %s", async (_label, overrides, field) => {
    const { repo, createRun } = payrollWith();
    await expect(new RecordPayRun(repo).execute({ ...INPUT, ...overrides }, ACTOR, NOW)).rejects.toMatchObject({
      field,
    });
    expect(createRun).not.toHaveBeenCalled();
  });

  it("allows a date after the month: last month's pay, booked on time", async () => {
    const { repo, createRun } = payrollWith();
    await new RecordPayRun(repo).execute({ ...INPUT, period: "1405-07" }, ACTOR, NOW);
    expect(createRun).toHaveBeenCalled();
  });
});

describe("PayPayRun", () => {
  it("pays all that's left when no amount is given", async () => {
    const { repo, payRun } = payrollWith();
    const paid = await new PayPayRun(repo).execute("r1", { source: "bank", paidOn: "2026-11-05" }, ACTOR, NOW);

    expect(paid.status).toBe("paid");
    const [id, payment, ledger] = payRun.mock.calls[0];
    expect(id).toBe("r1");
    expect(payment).toEqual({ amount: 18_000_000, source: "bank", paidOn: "2026-11-05", expectedPaid: 0 });
    expect(ledger(paid, { vatRateBps: 1000 })[0]).toMatchObject({ source: "payrollPayment", date: "2026-11-05" });
  });

  it("pays part, and leaves the rest owed", async () => {
    const { repo } = payrollWith();
    const part = await new PayPayRun(repo).execute(
      "r1",
      { source: "cash", paidOn: "2026-11-05", amount: 5_000_000 },
      ACTOR,
      NOW,
    );
    expect(part).toMatchObject({ status: "unpaid", paidAmount: 5_000_000 });
  });

  it("logs that it was paid, not how much", async () => {
    const { repo, payRun } = payrollWith();
    const paid = await new PayPayRun(repo).execute("r1", { source: "bank", paidOn: "2026-11-05" }, ACTOR, NOW);

    const entry = payRun.mock.calls[0][3]?.(paid);
    expect(entry).toMatchObject({ action: "payroll.paid", changes: [{ field: "status", before: "unpaid" }] });
    expect(JSON.stringify(entry)).not.toContain("18000000");
  });

  it("refuses more than what's owed, a future date, and a date before it was booked", async () => {
    const { repo, payRun } = payrollWith({ ...RUN, paidAmount: 10_000_000 });
    const pay = new PayPayRun(repo);
    await expect(
      pay.execute("r1", { source: "bank", paidOn: "2026-11-05", amount: 8_000_001 }, ACTOR, NOW),
    ).rejects.toThrow("paymentOverOwed");
    await expect(pay.execute("r1", { source: "bank", paidOn: "2026-11-06" }, ACTOR, NOW)).rejects.toMatchObject({
      field: "paidOn",
    });
    await expect(pay.execute("r1", { source: "bank", paidOn: "2026-10-31" }, ACTOR, NOW)).rejects.toMatchObject({
      field: "paidOn",
    });
    expect(payRun).not.toHaveBeenCalled();
  });

  it("refuses an unknown run, and one already paid or void", async () => {
    await expect(
      new PayPayRun(payrollWith(null).repo).execute("r1", { source: "bank", paidOn: "2026-11-05" }, ACTOR, NOW),
    ).rejects.toThrow(NotFoundError);

    for (const status of ["paid", "void"] as const) {
      await expect(
        new PayPayRun(payrollWith({ ...RUN, status }).repo).execute(
          "r1",
          { source: "bank", paidOn: "2026-11-05" },
          ACTOR,
          NOW,
        ),
      ).rejects.toThrow(ConflictError);
    }
  });
});

describe("VoidPayRun", () => {
  it("reverses entries today with the reason given", async () => {
    const { repo, voidRun } = payrollWith();
    await new VoidPayRun(repo).execute("r1", "  wrong figures  ", ACTOR, NOW);

    const reverse = voidRun.mock.calls[0][1];
    expect(
      reverse({
        id: "j1",
        number: 7,
        date: "2026-11-01",
        description: "Payroll 1405-08",
        source: "payroll",
        sourceId: "r1",
        lines: [],
        createdById: "owner",
        createdByName: "Rira",
        createdAt: "",
      }),
    ).toMatchObject({ date: "2026-11-05", description: "Reversal of JE-7: wrong figures", sourceId: "r1" });
  });

  it("refuses an unknown run and one already void", async () => {
    await expect(new VoidPayRun(payrollWith(null).repo).execute("r1", "", ACTOR, NOW)).rejects.toThrow(NotFoundError);
    await expect(
      new VoidPayRun(payrollWith({ ...RUN, status: "void" }).repo).execute("r1", "", ACTOR, NOW),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});

describe("SaveEmployee", () => {
  it("trims the fields and drops blank optional ones", async () => {
    const { repo, createEmployee } = payrollWith();
    await new SaveEmployee(repo).create({ name: "  Sara ", position: "  ", phone: " 0912 ", monthlySalary: 5 }, ACTOR);

    expect(createEmployee.mock.calls[0][0]).toEqual({
      name: "Sara",
      position: undefined,
      phone: "0912",
      monthlySalary: 5,
    });
  });

  it("refuses a blank name and a bad salary", async () => {
    const { repo, createEmployee } = payrollWith();
    await expect(new SaveEmployee(repo).create({ name: " ", monthlySalary: 0 }, ACTOR)).rejects.toMatchObject({
      field: "name",
    });
    await expect(new SaveEmployee(repo).create({ name: "Sara", monthlySalary: -1 }, ACTOR)).rejects.toMatchObject({
      field: "monthlySalary",
    });
    expect(createEmployee).not.toHaveBeenCalled();
  });

  it("logs that a salary changed without either figure", async () => {
    const { repo, updateEmployee } = payrollWith(RUN, { employees: [SARA] });
    const edit = { name: "Sara", monthlySalary: 25_000_000, isActive: true };
    await new SaveEmployee(repo).update("e1", edit, ACTOR);

    const entry = updateEmployee.mock.calls[0][2]?.({ ...SARA, monthlySalary: 25_000_000 });
    expect(entry?.changes).toEqual([{ field: "monthlySalary", before: null, after: null }]);
    expect(JSON.stringify(entry)).not.toMatch(/2[05]000000/);
  });

  it("logs a name, and nothing for a save that changed nothing", async () => {
    const { repo, updateEmployee } = payrollWith(RUN, { employees: [SARA] });
    await new SaveEmployee(repo).update("e1", { ...SARA }, ACTOR);

    const audit = updateEmployee.mock.calls[0][2];
    expect(audit?.({ ...SARA, name: "Sarah" })?.changes).toEqual([{ field: "name", before: "Sara", after: "Sarah" }]);
    expect(audit?.(SARA)).toBeNull();
  });

  it("refuses to edit someone who doesn't exist", async () => {
    await expect(new SaveEmployee(payrollWith().repo).update("e1", { ...SARA }, ACTOR)).rejects.toThrow(NotFoundError);
  });
});

describe("DraftPayRun", () => {
  it("offers the recent months nobody has recorded, newest first", async () => {
    const { repo } = payrollWith(RUN, { runs: [{ ...RUN, period: "1405-07" }] });
    const { periods } = await new DraftPayRun(repo).execute(NOW);

    expect(periods.map((option) => option.period)).toEqual(["1405-08", "1405-06", "1405-05", "1405-04", "1405-03"]);
    expect(periods[0].date).toBe("2026-11-05");
  });

  it("offers a voided month again", async () => {
    const { repo } = payrollWith(RUN, { runs: [{ ...RUN, status: "void" }] });
    const { periods } = await new DraftPayRun(repo).execute(NOW);

    expect(periods[0].period).toBe("1405-08");
  });

  it("starts people on last month's figures, and someone new on their usual gross", async () => {
    const newcomer: Employee = { ...SARA, id: "e2", name: "Ali", monthlySalary: 15_000_000 };
    const { repo } = payrollWith(RUN, { employees: [newcomer, SARA], runs: [{ ...RUN, period: "1405-07" }] });
    const { lines } = await new DraftPayRun(repo).execute(NOW);

    expect(lines).toEqual([
      {
        employeeId: "e2",
        employeeName: "Ali",
        gross: 15_000_000,
        employeeInsurance: 0,
        incomeTax: 0,
        employerInsurance: 0,
      },
      { ...LINE, employeeName: "Sara" },
    ]);
  });

  it("ignores a voided run's figures", async () => {
    const { repo } = payrollWith(RUN, {
      employees: [SARA],
      runs: [{ ...RUN, status: "void", lines: [{ ...LINE, employeeName: "Sara", gross: 1 }] }],
    });
    const { lines } = await new DraftPayRun(repo).execute(NOW);

    expect(lines[0].gross).toBe(20_000_000);
    expect(lines[0].employeeInsurance).toBe(0);
  });
});
