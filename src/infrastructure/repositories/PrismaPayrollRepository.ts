import { PAYMENT_SOURCES, type PaymentSource } from "@/src/domain/entities/Expense";
import type { JournalEntry, NewJournalEntry } from "@/src/domain/entities/Ledger";
import { PAY_RUN_STATUSES, type Employee, type PayRun, type PayRunStatus } from "@/src/domain/entities/Payroll";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { LedgerHook } from "@/src/domain/repositories/ILedgerRepository";
import type {
  IPayrollRepository,
  NewEmployee,
  NewPayRun,
  PayRunPayment,
} from "@/src/domain/repositories/IPayrollRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";

import { recordAudit } from "./writeActivityEntry";
import { dateToDay, dayToDate, ENTRY_WITH_LINES, postHook, reverseEntry, toJournalEntry } from "./writeJournal";

const WITH_LINES = { lines: { orderBy: { employeeName: "asc" } } } satisfies Prisma.PayRunInclude;
type RunRow = Prisma.PayRunGetPayload<{ include: typeof WITH_LINES }>;

/**
 * Employees and pay runs, backed by PostgreSQL. Every write that moves money posts
 * its journal entries in the same transaction, so a run can't exist without its
 * entry. One partial unique index allows a single standing run per month.
 */
export class PrismaPayrollRepository implements IPayrollRepository {
  async listEmployees(includeInactive: boolean): Promise<Employee[]> {
    const rows = await prisma.employee.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: "asc" },
    });
    return rows.map(toEmployee);
  }

  async getEmployee(id: string): Promise<Employee | null> {
    const row = await prisma.employee.findUnique({ where: { id } });
    return row ? toEmployee(row) : null;
  }

  async createEmployee(input: NewEmployee, audit?: AuditHook<Employee>): Promise<Employee> {
    return prisma.$transaction(async (tx) => {
      const employee = toEmployee(await tx.employee.create({ data: employeeData(input) }));
      await recordAudit(tx, employee, audit);
      return employee;
    });
  }

  async updateEmployee(
    id: string,
    input: NewEmployee & { isActive: boolean },
    audit?: AuditHook<Employee>,
  ): Promise<Employee> {
    try {
      return await prisma.$transaction(async (tx) => {
        const row = await tx.employee.update({
          where: { id },
          data: { ...employeeData(input), isActive: input.isActive },
        });
        const employee = toEmployee(row);
        await recordAudit(tx, employee, audit);
        return employee;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new NotFoundError("employee", id, { cause: error });
      }
      throw error;
    }
  }

  async listRuns(): Promise<PayRun[]> {
    const rows = await prisma.payRun.findMany({
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      include: WITH_LINES,
    });
    return rows.map(toRun);
  }

  async getRun(id: string): Promise<PayRun | null> {
    const row = await prisma.payRun.findUnique({ where: { id }, include: WITH_LINES });
    return row ? toRun(row) : null;
  }

  async createRun(input: NewPayRun, ledger: LedgerHook<PayRun>, audit?: AuditHook<PayRun>): Promise<PayRun> {
    return prisma.$transaction(async (tx) => {
      const ids = input.lines.map((line) => line.employeeId);
      const employees = await tx.employee.findMany({ where: { id: { in: ids } } });
      const names = new Map(employees.map((employee) => [employee.id, employee.name]));

      const created = await tx.payRun
        .create({
          data: {
            period: input.period,
            date: dayToDate(input.date),
            status: "unpaid",
            createdById: input.createdById,
            createdByName: input.createdByName,
            lines: {
              create: input.lines.map((line) => {
                const name = names.get(line.employeeId);
                if (name === undefined) throw new NotFoundError("employee", line.employeeId);
                return {
                  employeeId: line.employeeId,
                  employeeName: name,
                  gross: BigInt(line.gross),
                  employeeInsurance: BigInt(line.employeeInsurance),
                  incomeTax: BigInt(line.incomeTax),
                  employerInsurance: BigInt(line.employerInsurance),
                };
              }),
            },
          },
          include: WITH_LINES,
        })
        .catch((error: unknown) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new ConflictError("ALREADY_POSTED", "That month's payroll has already been recorded.", {
              cause: error,
            });
          }
          throw error;
        });

      const run = toRun(created);
      await postHook(tx, run, ledger);
      await recordAudit(tx, run, audit);
      return run;
    });
  }

  async payRun(
    id: string,
    payment: PayRunPayment,
    ledger: LedgerHook<PayRun>,
    audit?: AuditHook<PayRun>,
  ): Promise<PayRun> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.payRun.findUnique({ where: { id }, include: WITH_LINES });
      if (!current) throw new NotFoundError("payRun", id);
      const net = current.lines.reduce(
        (sum, line) => sum + Number(line.gross - line.employeeInsurance - line.incomeTax),
        0,
      );
      const paidAmount = payment.expectedPaid + payment.amount;
      // Guarded on what had been paid: paying twice (two clicks, two tabs) books nothing twice.
      const result = await tx.payRun.updateMany({
        where: { id, status: "unpaid", paidAmount: BigInt(payment.expectedPaid) },
        data: {
          paidAmount: BigInt(paidAmount),
          ...(paidAmount >= net ? { status: "paid", paidFrom: payment.source, paidOn: dayToDate(payment.paidOn) } : {}),
        },
      });
      if (result.count === 0) {
        throw new ConflictError("INVALID_TRANSITION", "This pay run was already paid or changed.");
      }
      const run = toRun(await tx.payRun.findUniqueOrThrow({ where: { id }, include: WITH_LINES }));
      await postHook(tx, run, ledger);
      await recordAudit(tx, run, audit);
      return run;
    });
  }

  async voidRun(
    id: string,
    reverse: (entry: JournalEntry) => NewJournalEntry,
    audit?: AuditHook<PayRun>,
  ): Promise<PayRun> {
    return prisma.$transaction(async (tx) => {
      const result = await tx.payRun.updateMany({ where: { id, status: { not: "void" } }, data: { status: "void" } });
      if (result.count === 0) {
        const current = await tx.payRun.findUnique({ where: { id } });
        if (!current) throw new NotFoundError("payRun", id);
        throw new ConflictError("INVALID_TRANSITION", "This pay run is already void.");
      }
      // Every entry still standing for it: the run and its payments, if any.
      const entries = await tx.journalEntry.findMany({
        where: { sourceId: id, reversedById: null, reversesId: null },
        orderBy: { number: "asc" },
        include: ENTRY_WITH_LINES,
      });
      for (const entry of entries) {
        await reverseEntry(tx, toJournalEntry(entry), reverse);
      }
      const run = toRun(await tx.payRun.findUniqueOrThrow({ where: { id }, include: WITH_LINES }));
      await recordAudit(tx, run, audit);
      return run;
    });
  }
}

function employeeData(input: NewEmployee) {
  return {
    name: input.name,
    position: input.position ?? null,
    phone: input.phone ?? null,
    monthlySalary: BigInt(input.monthlySalary),
  };
}

function toEmployee(row: Prisma.EmployeeGetPayload<object>): Employee {
  return {
    id: row.id,
    name: row.name,
    position: row.position ?? undefined,
    phone: row.phone ?? undefined,
    monthlySalary: Number(row.monthlySalary),
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

function toStatus(value: string): PayRunStatus {
  return (PAY_RUN_STATUSES as readonly string[]).includes(value) ? (value as PayRunStatus) : "unpaid";
}

function toSource(value: string | null): PaymentSource | undefined {
  return value && (PAYMENT_SOURCES as readonly string[]).includes(value) ? (value as PaymentSource) : undefined;
}

function toRun(row: RunRow): PayRun {
  return {
    id: row.id,
    period: row.period,
    date: dateToDay(row.date),
    status: toStatus(row.status),
    lines: row.lines.map((line) => ({
      employeeId: line.employeeId,
      employeeName: line.employeeName,
      gross: Number(line.gross),
      employeeInsurance: Number(line.employeeInsurance),
      incomeTax: Number(line.incomeTax),
      employerInsurance: Number(line.employerInsurance),
    })),
    paidAmount: Number(row.paidAmount),
    paidFrom: toSource(row.paidFrom),
    paidOn: row.paidOn ? dateToDay(row.paidOn) : undefined,
    createdById: row.createdById,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
  };
}
