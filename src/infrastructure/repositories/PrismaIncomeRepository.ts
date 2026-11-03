import {
  INCOME_METHODS,
  INCOME_SOURCE_TYPES,
  INCOME_STATUSES,
  type Income,
  type IncomeMethod,
  type IncomeSourceType,
  type IncomeStatus,
  type IncomeSummary,
} from "@/src/domain/entities/Income";
import type { IncomeRefund, RefundablePayment, RefundPortion } from "@/src/domain/entities/IncomeRefund";
import type { JournalEntry, NewJournalEntry } from "@/src/domain/entities/Ledger";
import { createPage, toSkipTake, type Page, type PageRequest } from "@/src/domain/entities/Pagination";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type {
  IIncomeRepository,
  IncomeFilters,
  NewIncome,
  NewIncomeRefund,
} from "@/src/domain/repositories/IIncomeRepository";
import type { LedgerHook } from "@/src/domain/repositories/ILedgerRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import type { Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { recordAudit } from "./writeActivityEntry";
import { dateToDay, dayToDate, ENTRY_WITH_LINES, postHook, reverseEntry, toJournalEntry } from "./writeJournal";

type IncomeRow = Prisma.IncomeGetPayload<object>;

/**
 * Income outside orders, backed by PostgreSQL. Like an expense, an entry can't exist
 * without its journal entry: both commit together, and voiding reverses it.
 */
export class PrismaIncomeRepository implements IIncomeRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async getIncome(id: string): Promise<Income | null> {
    const row = await this.db.income.findUnique({ where: { id } });
    return row ? toIncome(row) : null;
  }

  async listIncomes(filters: IncomeFilters, page: PageRequest): Promise<Page<Income>> {
    const where: Prisma.IncomeWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.query ? { OR: matchQuery(filters.query) } : {}),
    };
    const { skip, take } = toSkipTake(page);
    const [rows, total] = await prisma.$transaction([
      prisma.income.findMany({ where, orderBy: [{ date: "desc" }, { number: "desc" }], skip, take }),
      prisma.income.count({ where }),
    ]);
    return createPage(rows.map(toIncome), total, page);
  }

  async summary(month: { fromDay: string; toDay: string }): Promise<IncomeSummary> {
    const [byStatus, inMonth] = await Promise.all([
      prisma.income.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.income.aggregate({
        where: { status: "received", date: { gte: dayToDate(month.fromDay), lte: dayToDate(month.toDay) } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);
    const counts: Record<IncomeStatus, number> = { received: 0, void: 0 };
    for (const group of byStatus) counts[toStatus(group.status)] += group._count._all;
    return { month: { ...month, count: inMonth._count._all, total: Number(inMonth._sum.amount ?? 0) }, counts };
  }

  async create(input: NewIncome, ledger: LedgerHook<Income>, audit?: AuditHook<Income>): Promise<Income> {
    return inTransaction(this.db, async (tx) => {
      const income = toIncome(
        await tx.income.create({
          data: {
            date: dayToDate(input.date),
            accountCode: input.accountCode,
            description: input.description,
            amount: BigInt(input.amount),
            vatAmount: BigInt(input.vatAmount),
            method: input.method,
            payerName: input.payerName ?? null,
            sourceType: input.sourceType ?? null,
            sourceId: input.sourceId ?? null,
            createdById: input.createdById,
            createdByName: input.createdByName,
          },
        }),
      );
      await postHook(tx, income, ledger);
      await recordAudit(tx, income, audit);
      return income;
    });
  }

  async void(
    id: string,
    reverse: (entry: JournalEntry) => NewJournalEntry,
    audit?: AuditHook<Income>,
  ): Promise<Income> {
    return inTransaction(this.db, async (tx) => {
      const result = await tx.income.updateMany({ where: { id, status: "received" }, data: { status: "void" } });
      if (result.count === 0) {
        const current = await tx.income.findUnique({ where: { id }, select: { id: true } });
        if (!current) throw new NotFoundError("income", id);
        throw new ConflictError("INVALID_TRANSITION", "This income is already void.");
      }
      const entries = await tx.journalEntry.findMany({
        where: { sourceId: id, reversedById: null, reversesId: null },
        orderBy: { number: "asc" },
        include: ENTRY_WITH_LINES,
      });
      for (const entry of entries) {
        await reverseEntry(tx, toJournalEntry(entry), reverse);
      }
      const income = toIncome(await tx.income.findUniqueOrThrow({ where: { id } }));
      await recordAudit(tx, income, audit);
      return income;
    });
  }

  listRefundable(sourceType: IncomeSourceType, sourceId: string): Promise<RefundablePayment[]> {
    return readRefundable(this.db, sourceType, sourceId);
  }

  async refund(
    input: NewIncomeRefund,
    plan: (payments: RefundablePayment[]) => RefundPortion[],
    ledger: LedgerHook<IncomeRefund>,
    audit?: AuditHook<IncomeRefund>,
  ): Promise<IncomeRefund[]> {
    return inTransaction(this.db, async (tx) => {
      // The booking's payments, locked: two refunds at once take turns, so neither
      // can hand back what the other just did. A void waits here too.
      await tx.$queryRaw`
        SELECT "id" FROM "incomes"
        WHERE "source_type" = ${input.sourceType} AND "source_id" = ${input.sourceId} AND "status" = 'received'
        ORDER BY "id" FOR UPDATE`;
      const portions = plan(await readRefundable(tx, input.sourceType, input.sourceId));

      const refunds: IncomeRefund[] = [];
      for (const portion of portions) {
        const refund = toIncomeRefund(
          await tx.incomeRefund.create({
            data: {
              incomeId: portion.payment.id,
              sourceType: input.sourceType,
              sourceId: input.sourceId,
              date: dayToDate(input.date),
              amount: BigInt(portion.amount),
              vatAmount: BigInt(portion.vatAmount),
              method: input.method,
              reason: input.reason ?? null,
              createdById: input.createdById,
              createdByName: input.createdByName,
            },
            include: REFUND_WITH_INCOME,
          }),
        );
        await postHook(tx, refund, ledger);
        await recordAudit(tx, refund, audit);
        refunds.push(refund);
      }
      return refunds;
    });
  }
}

const REFUND_WITH_INCOME = {
  income: { select: { number: true, accountCode: true, payerName: true } },
} satisfies Prisma.IncomeRefundInclude;
type IncomeRefundRow = Prisma.IncomeRefundGetPayload<{ include: typeof REFUND_WITH_INCOME }>;

/** A booking's standing payments, oldest first, each with what's been handed back from it. */
async function readRefundable(
  db: Pick<PrismaDb, "income">,
  sourceType: IncomeSourceType,
  sourceId: string,
): Promise<RefundablePayment[]> {
  const rows = await db.income.findMany({
    where: { sourceType, sourceId, status: "received" },
    include: { refunds: { select: { amount: true, vatAmount: true } } },
    orderBy: [{ createdAt: "asc" }, { number: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    accountCode: row.accountCode,
    amount: Number(row.amount),
    vatAmount: Number(row.vatAmount),
    payerName: row.payerName ?? undefined,
    createdAt: row.createdAt.toISOString(),
    refunded: row.refunds.reduce((sum, refund) => sum + Number(refund.amount), 0),
    refundedVat: row.refunds.reduce((sum, refund) => sum + Number(refund.vatAmount), 0),
  }));
}

function toIncomeRefund(row: IncomeRefundRow): IncomeRefund {
  return {
    id: row.id,
    number: row.number,
    incomeId: row.incomeId,
    incomeNumber: row.income.number,
    sourceType: toSourceType(row.sourceType) ?? "suiteBooking",
    sourceId: row.sourceId,
    date: dateToDay(row.date),
    accountCode: row.income.accountCode,
    amount: Number(row.amount),
    vatAmount: Number(row.vatAmount),
    method: toMethod(row.method),
    reason: row.reason ?? undefined,
    payerName: row.income.payerName ?? undefined,
    createdById: row.createdById,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
  };
}

/** "14", "IN-14" or "in 14" — how staff quote an entry's number. */
const INCOME_NUMBER = /^(?:in[-\s]?)?(\d{1,9})$/i;

function matchQuery(query: string): Prisma.IncomeWhereInput[] {
  const match: Prisma.IncomeWhereInput[] = [
    { description: { contains: query, mode: "insensitive" } },
    { payerName: { contains: query, mode: "insensitive" } },
  ];
  const number = INCOME_NUMBER.exec(query)?.[1];
  if (number) match.push({ number: Number(number) });
  return match;
}

function toStatus(value: string): IncomeStatus {
  return (INCOME_STATUSES as readonly string[]).includes(value) ? (value as IncomeStatus) : "received";
}

function toMethod(value: string): IncomeMethod {
  return (INCOME_METHODS as readonly string[]).includes(value) ? (value as IncomeMethod) : "cash";
}

function toSourceType(value: string | null): IncomeSourceType | undefined {
  return value && (INCOME_SOURCE_TYPES as readonly string[]).includes(value) ? (value as IncomeSourceType) : undefined;
}

function toIncome(row: IncomeRow): Income {
  return {
    id: row.id,
    number: row.number,
    date: dateToDay(row.date),
    accountCode: row.accountCode,
    description: row.description,
    amount: Number(row.amount),
    vatAmount: Number(row.vatAmount),
    method: toMethod(row.method),
    payerName: row.payerName ?? undefined,
    sourceType: toSourceType(row.sourceType),
    sourceId: row.sourceId ?? undefined,
    status: toStatus(row.status),
    createdById: row.createdById,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
  };
}
