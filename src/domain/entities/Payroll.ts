import { jalaliMonthDays, parseJalaliPeriod } from "./JalaliCalendar";

import type { PaymentSource } from "./Expense";

/**
 * Payroll, with the figures typed in. The app doesn't work out insurance or income
 * tax: those rates change by law every year, and a wrong one is a legal problem, so
 * it records what it's given and books it. The cafe pays no insurance and withholds
 * no tax, so the form asks for a salary alone and the deductions stay 0; they're kept
 * here for the day that changes.
 *
 * Who earns what is the most private figure in the app, so it stays here. The
 * journal gets a month's totals only, and the activity log never gets an amount.
 */

export const PAY_RUN_STATUSES = ["unpaid", "paid", "void"] as const;
export type PayRunStatus = (typeof PAY_RUN_STATUSES)[number];

/** Someone the cafe pays. Not a login: not everyone on the payroll has one. */
export type Employee = {
  id: string;
  name: string;
  position?: string;
  phone?: string;
  /** The usual gross, in whole Toman: where a first pay run starts from. */
  monthlySalary: number;
  isActive: boolean;
  createdAt: string;
};

/** One person's month, in whole Toman. */
export type PayRunLine = {
  employeeId: string;
  /** Snapshotted, so an old run reads correctly after a rename. */
  employeeName: string;
  gross: number;
  /** The employee's share of social insurance, taken out of their pay. */
  employeeInsurance: number;
  /** Income tax on salary, taken out of their pay. */
  incomeTax: number;
  /** The employer's share of social insurance, a cost on top of their pay. */
  employerInsurance: number;
};

/** A month's pay. Booked when it's recorded; `void` reverses it and frees the month. */
export type PayRun = {
  id: string;
  /** The Persian month, "1405-08". */
  period: string;
  /** The day it's booked. */
  date: string;
  status: PayRunStatus;
  lines: PayRunLine[];
  /** Net pay paid out so far: part of an `unpaid` run, all of a `paid` one. */
  paidAmount: number;
  /** Set once paid in full. */
  paidFrom?: PaymentSource;
  paidOn?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
};

export type PayRunTotals = {
  gross: number;
  employeeInsurance: number;
  incomeTax: number;
  employerInsurance: number;
  net: number;
};

/** What reaches someone's hand: their gross less what's taken out of it. */
export function netPay(line: Pick<PayRunLine, "gross" | "employeeInsurance" | "incomeTax">): number {
  return line.gross - line.employeeInsurance - line.incomeTax;
}

export function payRunTotals(lines: readonly PayRunLine[]): PayRunTotals {
  const sum = (pick: (line: PayRunLine) => number): number => lines.reduce((total, line) => total + pick(line), 0);
  return {
    gross: sum((line) => line.gross),
    employeeInsurance: sum((line) => line.employeeInsurance),
    incomeTax: sum((line) => line.incomeTax),
    employerInsurance: sum((line) => line.employerInsurance),
    net: sum(netPay),
  };
}

/** What's still owed to the staff on a run. */
export function payRunOwed(run: Pick<PayRun, "lines" | "paidAmount" | "status">): number {
  return run.status === "unpaid" ? payRunTotals(run.lines).net - run.paidAmount : 0;
}

/** The day a month's pay is booked by default: the month's last day, or today if that's still to come. */
export function defaultPayDate(period: string, today: string): string {
  const month = parseJalaliPeriod(period);
  if (!month) return today;
  const { toDay } = jalaliMonthDays(month.jy, month.jm);
  return toDay < today ? toDay : today;
}

/** One person's starting figures on a new run. */
export type PayRunDraftLine = Omit<PayRunLine, "employeeName"> & { employeeName: string; position?: string };

/** What a new pay run starts from. */
export type PayRunDraft = {
  /** Recent months with no standing run, newest first, each with the day it would be booked. */
  periods: { period: string; date: string }[];
  /** Everyone active, on last month's figures if they were paid then, otherwise their usual gross. */
  lines: PayRunDraftLine[];
};
