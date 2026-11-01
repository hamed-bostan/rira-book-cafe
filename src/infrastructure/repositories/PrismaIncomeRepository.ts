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
import type { JournalEntry, NewJournalEntry } from "@/src/domain/entities/Ledger";
import { createPage, toSkipTake, type Page, type PageRequest } from "@/src/domain/entities/Pagination";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { IIncomeRepository, IncomeFilters, NewIncome } from "@/src/domain/repositories/IIncomeRepository";
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
