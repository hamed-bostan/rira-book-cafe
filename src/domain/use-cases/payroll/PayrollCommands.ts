import { activityValue, singleChange, type ActivityActor, type ActivityChange } from "../../entities/ActivityEntry";
import { cafeDayOf } from "../../entities/CafeTime";
import { jalaliMonthDays, parseJalaliPeriod } from "../../entities/JalaliCalendar";
import { reversalOf } from "../../entities/Ledger";
import { netPay, payRunOwed, type Employee, type PayRun, type PayRunLine } from "../../entities/Payroll";
import { payrollEntry, payrollPaymentEntry } from "../../entities/Postings";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { PaymentSource } from "../../entities/Expense";
import type { IPayrollRepository, NewEmployee } from "../../repositories/IPayrollRepository";

export type RecordPayRunInput = {
  period: string;
  date: string;
  lines: Omit<PayRunLine, "employeeName">[];
};

export type PayPayRunInput = {
  source: PaymentSource;
  paidOn: string;
  /** Part of what's owed; omitted pays all of it. */
  amount?: number;
};

/**
 * Every log entry from here carries who, what and which month, and never an amount.
 * The log is a second copy that's read on its own terms and kept for good, so a
 * salary written there would outlast any change to who may see it. The figures stay
 * on the pay run.
 */
function audit(
  actor: ActivityActor,
  action: "payroll.recorded" | "payroll.paid" | "payroll.voided",
  run: PayRun,
  changes: ActivityChange[],
) {
  return {
    actorId: actor.id,
    actorName: actor.name,
    action,
    entityType: "payroll" as const,
    entityId: run.id,
    entityLabel: run.period,
    changes,
  };
}

function assertLines(lines: RecordPayRunInput["lines"]): void {
  if (lines.length === 0) throw new ValidationError("lines", "payRunEmpty");
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.employeeId)) throw new ValidationError("lines", "payRunDuplicate");
    seen.add(line.employeeId);
    const deductions = [line.employeeInsurance, line.incomeTax, line.employerInsurance];
    if (!Number.isSafeInteger(line.gross) || line.gross <= 0) throw new ValidationError("lines", "amountInvalid");
    if (deductions.some((amount) => !Number.isSafeInteger(amount) || amount < 0)) {
      throw new ValidationError("lines", "amountInvalid");
    }
    if (netPay(line) < 0) throw new ValidationError("lines", "payRunDeductionsTooHigh");
  }
}

/**
 * Record a month's pay, with the figures the accountant gave. The cost goes to the
 * month and what's owed to the staff, the insurance office and the tax office goes
 * on the books, all in the same transaction as the run.
 */
export class RecordPayRun {
  constructor(private readonly payroll: IPayrollRepository) {}

  async execute(input: RecordPayRunInput, actor: ActivityActor, now: Date = new Date()): Promise<PayRun> {
    const month = parseJalaliPeriod(input.period);
    if (!month) throw new ValidationError("period", "payRunMonthInvalid");
    if (input.date > cafeDayOf(now)) throw new ValidationError("date", "That date is in the future.");
    if (input.date < jalaliMonthDays(month.jy, month.jm).fromDay) {
      throw new ValidationError("date", "payRunDateBeforeMonth");
    }
    assertLines(input.lines);

    return this.payroll.createRun(
      { ...input, createdById: actor.id, createdByName: actor.name },
      (run) => [payrollEntry(run, actor)],
      (run) => audit(actor, "payroll.recorded", run, singleChange("period", null, run.period)),
    );
  }
}

/**
 * Pay out some or all of a run from cash or the bank: clears that much of salaries
 * payable and books the money out. It stays owed until the last of it is paid.
 */
export class PayPayRun {
  constructor(private readonly payroll: IPayrollRepository) {}

  async execute(id: string, input: PayPayRunInput, actor: ActivityActor, now: Date = new Date()): Promise<PayRun> {
    const { source, paidOn } = input;
    const run = await this.payroll.getRun(id);
    if (!run) throw new NotFoundError("payRun", id);
    if (run.status !== "unpaid")
      throw new ConflictError("INVALID_TRANSITION", `This pay run is already ${run.status}.`);
    if (paidOn > cafeDayOf(now)) throw new ValidationError("paidOn", "That date is in the future.");
    if (paidOn < run.date) throw new ValidationError("paidOn", "payRunPaidBeforeBooked");
    const owed = payRunOwed(run);
    const amount = input.amount ?? owed;
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new ValidationError("amount", "Enter the amount.");
    if (amount > owed) throw new ValidationError("amount", "paymentOverOwed");

    return this.payroll.payRun(
      id,
      { amount, source, paidOn, expectedPaid: run.paidAmount },
      (paid) => [payrollPaymentEntry(paid, { amount, source, date: paidOn }, actor)],
      (paid) => audit(actor, "payroll.paid", paid, singleChange("status", run.status, paid.status)),
    );
  }
}

/**
 * Void a run recorded by mistake: every entry it posted, payments included, is
 * reversed today, so a closed period stays closed and the history shows both the
 * mistake and its correction. Its month can then be recorded again.
 */
export class VoidPayRun {
  constructor(private readonly payroll: IPayrollRepository) {}

  async execute(id: string, reason: string, actor: ActivityActor, now: Date = new Date()): Promise<PayRun> {
    const run = await this.payroll.getRun(id);
    if (!run) throw new NotFoundError("payRun", id);
    if (run.status === "void") throw new ConflictError("INVALID_TRANSITION", "This pay run is already void.");
    const today = cafeDayOf(now);
    const why = reason.trim() || `Payroll ${run.period} voided`;

    return this.payroll.voidRun(
      id,
      (entry) => reversalOf(entry, today, why, actor),
      (voided) => audit(actor, "payroll.voided", voided, singleChange("status", run.status, "void")),
    );
  }
}

const employeeAudit = (actor: ActivityActor, employee: Employee, changes: ActivityChange[]) => ({
  actorId: actor.id,
  actorName: actor.name,
  action: "payroll.employeeChanged" as const,
  entityType: "payroll" as const,
  entityId: employee.id,
  entityLabel: employee.name,
  changes,
});

/** What moved, with a salary change noted but its figures left out. */
function employeeChanges(before: Employee, after: Employee): ActivityChange[] {
  const changes: ActivityChange[] = [];
  for (const field of ["name", "position", "phone", "isActive"] as const) {
    const [from, to] = [activityValue(before[field]), activityValue(after[field])];
    if (from !== to) changes.push({ field, before: from, after: to });
  }
  if (before.monthlySalary !== after.monthlySalary) changes.push({ field: "monthlySalary", before: null, after: null });
  return changes;
}

/** Add someone to the payroll or edit them. Employees are switched off rather than deleted, so old runs keep them. */
export class SaveEmployee {
  constructor(private readonly payroll: IPayrollRepository) {}

  async create(input: NewEmployee, actor: ActivityActor): Promise<Employee> {
    return this.payroll.createEmployee(clean(input), (employee) =>
      employeeAudit(actor, employee, singleChange("name", null, employee.name)),
    );
  }

  async update(id: string, input: NewEmployee & { isActive: boolean }, actor: ActivityActor): Promise<Employee> {
    const before = await this.payroll.getEmployee(id);
    if (!before) throw new NotFoundError("employee", id);
    return this.payroll.updateEmployee(id, { ...clean(input), isActive: input.isActive }, (employee) => {
      const changes = employeeChanges(before, employee);
      return changes.length > 0 ? employeeAudit(actor, employee, changes) : null;
    });
  }
}

function clean(input: NewEmployee): NewEmployee {
  const name = input.name.trim();
  if (!name) throw new ValidationError("name", "nameRequired");
  if (!Number.isSafeInteger(input.monthlySalary) || input.monthlySalary < 0) {
    throw new ValidationError("monthlySalary", "amountInvalid");
  }
  return {
    name,
    position: input.position?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    monthlySalary: input.monthlySalary,
  };
}
