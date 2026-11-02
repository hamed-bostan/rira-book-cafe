import { cafeDayOf } from "../../entities/CafeTime";
import { recentJalaliPeriods } from "../../entities/JalaliCalendar";
import { defaultPayDate, type PayRunDraft } from "../../entities/Payroll";

import type { IPayrollRepository } from "../../repositories/IPayrollRepository";

/** How many months back a new run can be recorded for, this month included. */
const MONTHS_OFFERED = 6;

/**
 * What a new pay run starts from: the recent months nobody has recorded, and everyone
 * active on last month's figures. Pay rarely changes month to month, so the accountant
 * only has to correct what did; someone new starts from their usual gross.
 */
export class DraftPayRun {
  constructor(private readonly payroll: IPayrollRepository) {}

  async execute(now: Date = new Date()): Promise<PayRunDraft> {
    const today = cafeDayOf(now);
    const [employees, runs] = await Promise.all([this.payroll.listEmployees(false), this.payroll.listRuns()]);
    const standing = runs.filter((run) => run.status !== "void");
    const taken = new Set(standing.map((run) => run.period));
    const lastPaid = new Map(standing.at(0)?.lines.map((line) => [line.employeeId, line]));

    return {
      periods: recentJalaliPeriods(today, MONTHS_OFFERED)
        .filter((period) => !taken.has(period))
        .map((period) => ({ period, date: defaultPayDate(period, today) })),
      lines: employees.map((employee) => {
        const last = lastPaid.get(employee.id);
        return {
          employeeId: employee.id,
          employeeName: employee.name,
          position: employee.position,
          gross: last?.gross ?? employee.monthlySalary,
          employeeInsurance: last?.employeeInsurance ?? 0,
          incomeTax: last?.incomeTax ?? 0,
          employerInsurance: last?.employerInsurance ?? 0,
        };
      }),
    };
  }
}
