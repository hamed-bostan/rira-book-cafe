import type { AuditHook } from "./AuditHook";
import type { LedgerHook } from "./ILedgerRepository";
import type { PaymentSource } from "../entities/Expense";
import type { JournalEntry, NewJournalEntry } from "../entities/Ledger";
import type { Employee, PayRun, PayRunLine } from "../entities/Payroll";

export type NewEmployee = Pick<Employee, "name" | "position" | "phone" | "monthlySalary">;

export type NewPayRun = {
  period: string;
  date: string;
  lines: Omit<PayRunLine, "employeeName">[];
  createdById: string;
  createdByName: string;
};

/** A payment on a run. `expectedPaid` is what had been paid when it was checked. */
export type PayRunPayment = { amount: number; source: PaymentSource; paidOn: string; expectedPaid: number };

export type IPayrollRepository = {
  listEmployees(includeInactive: boolean): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | null>;
  createEmployee(input: NewEmployee, audit?: AuditHook<Employee>): Promise<Employee>;
  updateEmployee(
    id: string,
    input: NewEmployee & { isActive: boolean },
    audit?: AuditHook<Employee>,
  ): Promise<Employee>;

  /** Every run, newest month first. */
  listRuns(): Promise<PayRun[]>;
  getRun(id: string): Promise<PayRun | null>;
  /**
   * Record a month and post its entry, in one transaction. `ALREADY_POSTED` when the
   * month already has a standing run; `NotFoundError` for an unknown employee.
   */
  createRun(input: NewPayRun, ledger: LedgerHook<PayRun>, audit?: AuditHook<PayRun>): Promise<PayRun>;
  /**
   * Pay out some or all of a run and post it, guarded on `expectedPaid` so two clicks
   * or two tabs can't book it twice. Paying the last of it marks the run paid.
   */
  payRun(id: string, payment: PayRunPayment, ledger: LedgerHook<PayRun>, audit?: AuditHook<PayRun>): Promise<PayRun>;
  /** Reverse every entry posted for a run and mark it void, in one transaction, freeing its month. */
  voidRun(id: string, reverse: (entry: JournalEntry) => NewJournalEntry, audit?: AuditHook<PayRun>): Promise<PayRun>;
};
