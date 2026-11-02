import { describe, expect, it } from "vitest";

import { GET as listJournal } from "@/app/api/admin/accounting/journal/route";
import { GET as getReport } from "@/app/api/admin/accounting/reports/[report]/route";
import { GET as readActivity } from "@/app/api/admin/activity/route";
import { PUT as updateEmployee } from "@/app/api/admin/payroll/employees/[id]/route";
import { GET as listEmployees, POST as createEmployee } from "@/app/api/admin/payroll/employees/route";
import { POST as payRun } from "@/app/api/admin/payroll/runs/[id]/pay/route";
import { GET as getRun } from "@/app/api/admin/payroll/runs/[id]/route";
import { POST as voidRun } from "@/app/api/admin/payroll/runs/[id]/void/route";
import { GET as getDraft } from "@/app/api/admin/payroll/runs/draft/route";
import { GET as listRuns, POST as createRun } from "@/app/api/admin/payroll/runs/route";
import type { CashFlowStatement, ProfitAndLoss, TrialBalance } from "@/src/domain/entities/AccountingReports";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { recentJalaliPeriods } from "@/src/domain/entities/JalaliCalendar";
import { SYSTEM_ACCOUNTS, type JournalEntry } from "@/src/domain/entities/Ledger";
import type { Page } from "@/src/domain/entities/Pagination";
import type { Employee, PayRun, PayRunDraft } from "@/src/domain/entities/Payroll";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const today = cafeDayOf(new Date());
const [THIS_MONTH] = recentJalaliPeriods(today, 1);

/** Unusual figures, so a leak can be searched for by value. */
const SARA_GROSS = 23_456_789;
const SARA_INSURANCE = 1_641_975;
const SARA_TAX = 333_111;
const SARA_EMPLOYER = 5_395_061;
const SARA_NET = SARA_GROSS - SARA_INSURANCE - SARA_TAX;

async function employee(name = "Sara", monthlySalary = String(SARA_GROSS)): Promise<Employee> {
  const response = await createEmployee(
    jsonRequest("POST", "/api/admin/payroll/employees", {
      name,
      position: "Barista",
      phone: "",
      monthlySalary,
      isActive: true,
    }),
  );
  expect(response.status).toBe(201);
  return readJson<Employee>(response);
}

const line = (employeeId: string) => ({
  employeeId,
  gross: String(SARA_GROSS),
  employeeInsurance: String(SARA_INSURANCE),
  incomeTax: String(SARA_TAX),
  employerInsurance: String(SARA_EMPLOYER),
});

const submitRun = (employeeId: string, overrides: object = {}): Promise<Response> =>
  createRun(
    jsonRequest("POST", "/api/admin/payroll/runs", {
      period: THIS_MONTH,
      date: today,
      lines: [line(employeeId)],
      ...overrides,
    }),
  );

async function recordedRun(): Promise<PayRun> {
  const { id } = await employee();
  const response = await submitRun(id);
  expect(response.status).toBe(201);
  return readJson<PayRun>(response);
}

const pay = (id: string, amount = "", source = "bank"): Promise<Response> =>
  payRun(
    jsonRequest("POST", `/api/admin/payroll/runs/${id}/pay`, { source, paidOn: today, amount }),
    routeParams({ id }),
  );

const voided = (id: string): Promise<Response> =>
  voidRun(jsonRequest("POST", `/api/admin/payroll/runs/${id}/void`, { reason: "Wrong figures" }), routeParams({ id }));

async function trialBalance(): Promise<TrialBalance> {
  const response = await getReport(
    getRequest(`/api/admin/accounting/reports/trial-balance?asOf=${today}`),
    routeParams({ report: "trial-balance" }),
  );
  return readJson<TrialBalance>(response);
}

const balanceOf = (report: TrialBalance, code: string): number =>
  report.rows.find((row) => row.account.code === code)?.balance ?? 0;

describe("who can reach payroll", () => {
  it.each(["staff", "customer"] as const)("not %s, even with the activity log open to them", async (user) => {
    signInAs(user);

    expect((await listEmployees(getRequest("/api/admin/payroll/employees"))).status).toBe(401);
    expect((await listRuns()).status).toBe(401);
    expect((await getDraft()).status).toBe(401);
    expect((await submitRun("anyone")).status).toBe(401);
  });

  it("not a stranger", async () => {
    expect((await listRuns()).status).toBe(401);
  });

  it("the run's own page answers 401 too, so an id alone shows nobody's pay", async () => {
    signInAs("admin");
    const run = await recordedRun();

    signInAs("staff");
    expect((await getRun(getRequest(`/api/admin/payroll/runs/${run.id}`), routeParams({ id: run.id }))).status).toBe(
      401,
    );
    expect((await pay(run.id)).status).toBe(401);
    expect((await voided(run.id)).status).toBe(401);
  });
});

describe("employees", () => {
  it("are listed by name, and switched off rather than deleted", async () => {
    signInAs("admin");
    const { id } = await employee("Sara");
    await employee("Ali");

    const response = await updateEmployee(
      jsonRequest("PUT", `/api/admin/payroll/employees/${id}`, {
        name: "Sara",
        position: "",
        phone: "",
        monthlySalary: "",
        isActive: false,
      }),
      routeParams({ id }),
    );
    expect(response.status).toBe(200);

    const active = await readJson<Employee[]>(await listEmployees(getRequest("/api/admin/payroll/employees")));
    const everyone = await readJson<Employee[]>(
      await listEmployees(getRequest("/api/admin/payroll/employees?all=true")),
    );
    expect(active.map((person) => person.name)).toEqual(["Ali"]);
    expect(everyone.map((person) => person.name)).toEqual(["Ali", "Sara"]);
  });

  it("answers 404 for someone who doesn't exist", async () => {
    signInAs("admin");
    const id = "00000000-0000-0000-0000-000000000000";
    const response = await updateEmployee(
      jsonRequest("PUT", `/api/admin/payroll/employees/${id}`, {
        name: "Nobody",
        position: "",
        phone: "",
        monthlySalary: "",
        isActive: true,
      }),
      routeParams({ id }),
    );

    expect(response.status).toBe(404);
  });
});

describe("recording a month", () => {
  it("books the cost and what's owed to the staff and both offices, and the books balance", async () => {
    signInAs("admin");
    const before = await trialBalance();
    await recordedRun();

    const after = await trialBalance();
    expect(after.balanced).toBe(true);
    const moved = (code: string): number => balanceOf(after, code) - balanceOf(before, code);
    expect(moved(SYSTEM_ACCOUNTS.salaries)).toBe(SARA_GROSS);
    expect(moved(SYSTEM_ACCOUNTS.employerInsurance)).toBe(SARA_EMPLOYER);
    expect(moved(SYSTEM_ACCOUNTS.salariesPayable)).toBe(SARA_NET);
    expect(moved(SYSTEM_ACCOUNTS.insurancePayable)).toBe(SARA_INSURANCE + SARA_EMPLOYER);
    expect(moved(SYSTEM_ACCOUNTS.payrollTaxPayable)).toBe(SARA_TAX);
  });

  it("is the month's cost on the profit and loss", async () => {
    signInAs("admin");
    await recordedRun();

    const statement = await readJson<ProfitAndLoss>(
      await getReport(
        getRequest(`/api/admin/accounting/reports/profit-and-loss?from=${today}&to=${today}`),
        routeParams({ report: "profit-and-loss" }),
      ),
    );

    expect(statement.expenses.total).toBe(SARA_GROSS + SARA_EMPLOYER);
  });

  it("happens once a month, however many ask at the same moment", async () => {
    signInAs("admin");
    const { id } = await employee();
    const entries = await prisma.journalEntry.count();

    const answers = await Promise.all([submitRun(id), submitRun(id), submitRun(id)]);

    expect(answers.map((answer) => answer.status).sort()).toEqual([201, 409, 409]);
    expect(await prisma.payRun.count()).toBe(1);
    expect(await prisma.journalEntry.count()).toBe(entries + 1);
  });

  it("refuses a second run afterwards, and the code says why", async () => {
    signInAs("admin");
    const { id } = await employee();
    await submitRun(id);

    const again = await submitRun(id);

    expect(again.status).toBe(409);
    expect((await readError(again)).code).toBe("ALREADY_POSTED");
  });

  it("keeps the name someone had at the time", async () => {
    signInAs("admin");
    const run = await recordedRun();
    const { employeeId } = run.lines[0];
    await updateEmployee(
      jsonRequest("PUT", `/api/admin/payroll/employees/${employeeId}`, {
        name: "Sarah",
        position: "",
        phone: "",
        monthlySalary: "",
        isActive: true,
      }),
      routeParams({ id: employeeId }),
    );

    const { run: read } = await readJson<{ run: PayRun }>(
      await getRun(getRequest(`/api/admin/payroll/runs/${run.id}`), routeParams({ id: run.id })),
    );

    expect(read.lines[0].employeeName).toBe("Sara");
  });

  it("answers 404 for someone who doesn't exist, and books nothing", async () => {
    signInAs("admin");
    const entries = await prisma.journalEntry.count();

    const response = await submitRun("00000000-0000-0000-0000-000000000000");

    expect(response.status).toBe(404);
    expect(await prisma.payRun.count()).toBe(0);
    expect(await prisma.journalEntry.count()).toBe(entries);
  });

  it("refuses bad figures with 400", async () => {
    signInAs("admin");
    const { id } = await employee();

    expect((await submitRun(id, { period: "soon" })).status).toBe(400);
    expect((await submitRun(id, { lines: [] })).status).toBe(400);
    expect((await submitRun(id, { lines: [{ ...line(id), incomeTax: String(SARA_GROSS * 2) }] })).status).toBe(400);
    expect((await submitRun(id, { lines: [line(id), line(id)] })).status).toBe(400);
    expect((await submitRun(id, { date: "2999-01-01" })).status).toBe(400);
  });
});

describe("what a new run starts from", () => {
  it("offers the month with this one's figures next time, and not the month just recorded", async () => {
    signInAs("admin");
    await recordedRun();

    const draft = await readJson<PayRunDraft>(await getDraft());

    expect(draft.periods.map((option) => option.period)).not.toContain(THIS_MONTH);
    expect(draft.lines[0]).toMatchObject({ gross: SARA_GROSS, employeeInsurance: SARA_INSURANCE, incomeTax: SARA_TAX });
  });

  it("gives someone new their usual gross", async () => {
    signInAs("admin");
    await employee("Ali", "15000000");

    const draft = await readJson<PayRunDraft>(await getDraft());

    expect(draft.periods[0].period).toBe(THIS_MONTH);
    expect(draft.lines[0]).toMatchObject({ employeeName: "Ali", gross: 15_000_000, incomeTax: 0 });
  });
});

describe("paying a run", () => {
  it("clears what's owed to the staff and books the money out", async () => {
    signInAs("admin");
    const run = await recordedRun();
    const before = await trialBalance();

    const response = await pay(run.id);

    expect(response.status).toBe(200);
    expect(await readJson<PayRun>(response)).toMatchObject({ status: "paid", paidFrom: "bank", paidAmount: SARA_NET });
    const after = await trialBalance();
    expect(balanceOf(after, SYSTEM_ACCOUNTS.salariesPayable)).toBe(0);
    expect(balanceOf(after, SYSTEM_ACCOUNTS.bank)).toBe(balanceOf(before, SYSTEM_ACCOUNTS.bank) - SARA_NET);
    expect(after.balanced).toBe(true);
  });

  it("can be done in parts, from the till and the bank, and only finishes on the last of it", async () => {
    signInAs("admin");
    const run = await recordedRun();

    const part = await readJson<PayRun>(await pay(run.id, "5000000", "cash"));
    expect(part).toMatchObject({ status: "unpaid", paidAmount: 5_000_000 });

    const rest = await readJson<PayRun>(await pay(run.id));
    expect(rest).toMatchObject({ status: "paid", paidAmount: SARA_NET });
  });

  it("books the same payment once, however many ask at the same moment", async () => {
    signInAs("admin");
    const run = await recordedRun();
    const entries = await prisma.journalEntry.count();

    const answers = await Promise.all([pay(run.id), pay(run.id), pay(run.id)]);

    expect(answers.filter((answer) => answer.status === 200)).toHaveLength(1);
    expect(await prisma.journalEntry.count()).toBe(entries + 1);
    expect(balanceOf(await trialBalance(), SYSTEM_ACCOUNTS.salariesPayable)).toBe(0);
  });

  it("refuses more than what's owed, and a run already paid", async () => {
    signInAs("admin");
    const run = await recordedRun();

    expect((await pay(run.id, String(SARA_NET + 1))).status).toBe(400);
    await pay(run.id);
    expect((await pay(run.id)).status).toBe(409);
  });

  it("shows on the cash-flow statement as running the cafe", async () => {
    signInAs("admin");
    const run = await recordedRun();
    await pay(run.id);

    const flow = await readJson<CashFlowStatement>(
      await getReport(
        getRequest(`/api/admin/accounting/reports/cash-flow?from=${today}&to=${today}`),
        routeParams({ report: "cash-flow" }),
      ),
    );

    expect(flow.operating.rows.map((row) => [row.account.code, row.balance])).toEqual([
      [SYSTEM_ACCOUNTS.salariesPayable, -SARA_NET],
    ]);
    expect(flow.reconciled).toBe(true);
  });
});

describe("voiding a run", () => {
  it("reverses everything, payments included, and frees the month", async () => {
    signInAs("admin");
    const before = await trialBalance();
    const run = await recordedRun();
    await pay(run.id, "5000000");

    const response = await voided(run.id);

    expect(response.status).toBe(200);
    expect(await readJson<PayRun>(response)).toMatchObject({ status: "void" });
    const after = await trialBalance();
    expect(after.balanced).toBe(true);
    for (const code of [
      SYSTEM_ACCOUNTS.salaries,
      SYSTEM_ACCOUNTS.salariesPayable,
      SYSTEM_ACCOUNTS.insurancePayable,
      SYSTEM_ACCOUNTS.payrollTaxPayable,
      SYSTEM_ACCOUNTS.bank,
    ]) {
      expect(balanceOf(after, code)).toBe(balanceOf(before, code));
    }

    const again = await submitRun(run.lines[0].employeeId);
    expect(again.status).toBe(201);
  });

  it("can't be done twice, or paid afterwards", async () => {
    signInAs("admin");
    const run = await recordedRun();
    await voided(run.id);

    expect((await voided(run.id)).status).toBe(409);
    expect((await pay(run.id)).status).toBe(409);
  });
});

describe("keeping pay private", () => {
  const FIGURES = [SARA_GROSS, SARA_INSURANCE, SARA_TAX, SARA_EMPLOYER, SARA_NET].map(String);

  async function exercise(): Promise<void> {
    signInAs("admin");
    const run = await recordedRun();
    const { employeeId } = run.lines[0];
    await updateEmployee(
      jsonRequest("PUT", `/api/admin/payroll/employees/${employeeId}`, {
        name: "Sara",
        position: "Barista",
        phone: "",
        monthlySalary: String(SARA_GROSS + 1000),
        isActive: true,
      }),
      routeParams({ id: employeeId }),
    );
    await pay(run.id);
    await voided(run.id);
  }

  it("never writes a figure to the activity log", async () => {
    await exercise();

    const stored = JSON.stringify(await prisma.activityEntry.findMany({ where: { entityType: "payroll" } }));

    expect(stored).toContain("payroll.recorded");
    expect(stored).toContain("monthlySalary");
    for (const figure of [...FIGURES, String(SARA_GROSS + 1000)]) expect(stored).not.toContain(figure);
  });

  it("shows floor staff that payroll happened, and nothing about how much", async () => {
    await exercise();

    signInAs("staff");
    const response = await readActivity(getRequest("/api/admin/activity?entityType=payroll"));

    expect(response.status).toBe(200);
    const body = await response.text();
    for (const figure of FIGURES) expect(body).not.toContain(figure);
  });

  it("never names anyone in the journal", async () => {
    signInAs("admin");
    await recordedRun();

    const journal = await readJson<Page<JournalEntry>>(await listJournal(getRequest("/api/admin/accounting/journal")));

    expect(journal.items.some((entry) => entry.source === "payroll")).toBe(true);
    expect(JSON.stringify(journal)).not.toContain("Sara");
  });
});
