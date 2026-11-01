import type { RecurringBill } from "@/src/domain/entities/RecurringBill";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type {
  IRecurringBillRepository,
  NewRecurringBill,
  RecurringBillChanges,
} from "@/src/domain/repositories/IRecurringBillRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";

import { recordAudit } from "./writeActivityEntry";
import { dateToDay, dayToDate } from "./writeJournal";
import { claimBillMonth } from "./writeRecurringRun";

const WITH_SUPPLIER = { supplier: { select: { name: true } } } satisfies Prisma.RecurringBillInclude;
type BillRow = Prisma.RecurringBillGetPayload<{ include: typeof WITH_SUPPLIER }>;

/** Recurring bills, backed by PostgreSQL. What claims a month is the primary key on its run row. */
export class PrismaRecurringBillRepository implements IRecurringBillRepository {
  async list(): Promise<RecurringBill[]> {
    const rows = await prisma.recurringBill.findMany({ orderBy: { description: "asc" }, include: WITH_SUPPLIER });
    return rows.map(toBill);
  }

  async get(id: string): Promise<RecurringBill | null> {
    const row = await prisma.recurringBill.findUnique({ where: { id }, include: WITH_SUPPLIER });
    return row ? toBill(row) : null;
  }

  async listActiveWithDone(): Promise<{ bill: RecurringBill; done: string[] }[]> {
    const rows = await prisma.recurringBill.findMany({
      where: { isActive: true },
      include: { ...WITH_SUPPLIER, runs: { select: { period: true } } },
    });
    return rows.map((row) => ({ bill: toBill(row), done: row.runs.map((run) => run.period) }));
  }

  async create(input: NewRecurringBill, audit?: AuditHook<RecurringBill>): Promise<RecurringBill> {
    return prisma.$transaction(async (tx) => {
      await assertSupplier(tx, input.supplierId);
      const row = await tx.recurringBill.create({
        data: {
          description: input.description,
          accountCode: input.accountCode,
          supplierId: input.supplierId ?? null,
          amount: BigInt(input.amount),
          vatAmount: BigInt(input.vatAmount),
          dayOfMonth: input.dayOfMonth,
          startsOn: dayToDate(input.startsOn),
        },
        include: WITH_SUPPLIER,
      });
      const bill = toBill(row);
      await recordAudit(tx, bill, audit);
      return bill;
    });
  }

  async update(id: string, input: RecurringBillChanges, audit?: AuditHook<RecurringBill>): Promise<RecurringBill> {
    return prisma.$transaction(async (tx) => {
      await assertSupplier(tx, input.supplierId);
      const row = await tx.recurringBill
        .update({
          where: { id },
          data: {
            description: input.description,
            accountCode: input.accountCode,
            supplierId: input.supplierId ?? null,
            amount: BigInt(input.amount),
            vatAmount: BigInt(input.vatAmount),
            dayOfMonth: input.dayOfMonth,
            isActive: input.isActive,
          },
          include: WITH_SUPPLIER,
        })
        .catch((error: unknown) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            throw new NotFoundError("recurringBill", id, { cause: error });
          }
          throw error;
        });
      const bill = toBill(row);
      await recordAudit(tx, bill, audit);
      return bill;
    });
  }

  async skip(
    bill: RecurringBill,
    period: string,
    actor: { id: string; name: string },
    audit?: AuditHook<RecurringBill>,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await claimBillMonth(tx, { billId: bill.id, period, createdById: actor.id, createdByName: actor.name });
      await recordAudit(tx, bill, audit);
    });
  }
}

async function assertSupplier(tx: Prisma.TransactionClient, supplierId: string | undefined): Promise<void> {
  if (!supplierId) return;
  const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new NotFoundError("supplier", supplierId);
}

function toBill(row: BillRow): RecurringBill {
  return {
    id: row.id,
    description: row.description,
    accountCode: row.accountCode,
    supplierId: row.supplierId ?? undefined,
    supplierName: row.supplier?.name,
    amount: Number(row.amount),
    vatAmount: Number(row.vatAmount),
    dayOfMonth: row.dayOfMonth,
    startsOn: dateToDay(row.startsOn),
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}
