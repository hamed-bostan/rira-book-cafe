import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import {
  EXPENSE_STATUSES,
  PAYMENT_SOURCES,
  type Expense,
  type ExpenseStatus,
  type ExpenseSummary,
  type PaymentSource,
  type Supplier,
} from "@/src/domain/entities/Expense";
import { roundQuantity } from "@/src/domain/entities/Inventory";
import type { JournalEntry, NewJournalEntry } from "@/src/domain/entities/Ledger";
import { createPage, toSkipTake, type Page, type PageRequest } from "@/src/domain/entities/Pagination";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type {
  ExpenseFilters,
  IExpenseRepository,
  NewExpense,
  NewSupplier,
} from "@/src/domain/repositories/IExpenseRepository";
import type { LedgerHook } from "@/src/domain/repositories/ILedgerRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { recordAudit } from "./writeActivityEntry";
import { dateToDay, dayToDate, ENTRY_WITH_LINES, postHook, reverseEntry, toJournalEntry } from "./writeJournal";
import { lockStock, writeMovement } from "./writeStock";

type ExpenseRow = Prisma.ExpenseGetPayload<object>;

/**
 * Expenses and suppliers, backed by PostgreSQL. Every write that moves money posts
 * its journal entries in the same transaction, so an expense can't exist without
 * its entry (or be paid without the payment being booked).
 */
export class PrismaExpenseRepository implements IExpenseRepository {
  /** The root client, or a transaction to join — a stock receipt records its bill inside its own. */
  constructor(private readonly db: PrismaDb = prisma) {}

  async listSuppliers(includeInactive: boolean): Promise<Supplier[]> {
    const rows = await prisma.supplier.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: "asc" },
    });
    return rows.map(toSupplier);
  }

  async getSupplier(id: string): Promise<Supplier | null> {
    const row = await prisma.supplier.findUnique({ where: { id } });
    return row ? toSupplier(row) : null;
  }

  async createSupplier(input: NewSupplier): Promise<Supplier> {
    return toSupplier(
      await prisma.supplier.create({
        data: { name: input.name, phone: input.phone ?? null, note: input.note ?? null },
      }),
    );
  }

  async updateSupplier(id: string, input: NewSupplier & { isActive: boolean }): Promise<Supplier> {
    try {
      return toSupplier(
        await prisma.supplier.update({
          where: { id },
          data: { name: input.name, phone: input.phone ?? null, note: input.note ?? null, isActive: input.isActive },
        }),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new NotFoundError("supplier", id, { cause: error });
      }
      throw error;
    }
  }

  async getExpense(id: string): Promise<Expense | null> {
    const row = await prisma.expense.findUnique({ where: { id } });
    return row ? toExpense(row) : null;
  }

  async listExpenses(filters: ExpenseFilters, page: PageRequest): Promise<Page<Expense>> {
    const where: Prisma.ExpenseWhereInput = {
      ...(filters.fromDay || filters.toDay
        ? {
            date: {
              ...(filters.fromDay ? { gte: dayToDate(filters.fromDay) } : {}),
              ...(filters.toDay ? { lte: dayToDate(filters.toDay) } : {}),
            },
          }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters.accountCode ? { accountCode: filters.accountCode } : {}),
      ...(filters.query ? { OR: matchQuery(filters.query) } : {}),
    };
    const { skip, take } = toSkipTake(page);
    const [rows, total] = await prisma.$transaction([
      prisma.expense.findMany({ where, orderBy: [{ date: "desc" }, { number: "desc" }], skip, take }),
      prisma.expense.count({ where }),
    ]);
    return createPage(rows.map(toExpense), total, page);
  }

  async totalUnpaid(): Promise<number> {
    const result = await prisma.expense.aggregate({ where: { status: "unpaid" }, _sum: { amount: true } });
    return Number(result._sum.amount ?? 0);
  }

  async summary(month: { fromDay: string; toDay: string }): Promise<ExpenseSummary> {
    const [byStatus, inMonth] = await Promise.all([
      prisma.expense.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amount: true } }),
      prisma.expense.aggregate({
        where: { status: { not: "void" }, date: { gte: dayToDate(month.fromDay), lte: dayToDate(month.toDay) } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);
    const counts: Record<ExpenseStatus, number> = { unpaid: 0, paid: 0, void: 0 };
    let owedTotal = 0;
    for (const group of byStatus) {
      const status = toStatus(group.status);
      counts[status] += group._count._all;
      if (status === "unpaid") owedTotal += Number(group._sum.amount ?? 0);
    }
    return {
      owed: { count: counts.unpaid, total: owedTotal },
      month: { ...month, count: inMonth._count._all, total: Number(inMonth._sum.amount ?? 0) },
      counts,
    };
  }

  async create(input: NewExpense, ledger: LedgerHook<Expense>, audit?: AuditHook<Expense>): Promise<Expense> {
    return inTransaction(this.db, async (tx) => {
      const supplier = input.supplierId ? await tx.supplier.findUnique({ where: { id: input.supplierId } }) : null;
      if (input.supplierId && !supplier) throw new NotFoundError("supplier", input.supplierId);

      const row = await tx.expense.create({
        data: {
          date: dayToDate(input.date),
          supplierId: input.supplierId ?? null,
          supplierName: supplier?.name ?? null,
          accountCode: input.accountCode,
          description: input.description,
          amount: BigInt(input.amount),
          vatAmount: BigInt(input.vatAmount),
          status: input.paidFrom ? "paid" : "unpaid",
          paidFrom: input.paidFrom ?? null,
          paidOn: input.paidFrom ? dayToDate(input.date) : null,
          receiptUrl: input.receiptUrl ?? null,
          createdById: input.createdById,
          createdByName: input.createdByName,
        },
      });
      const expense = toExpense(row);
      await postHook(tx, expense, ledger);
      await recordAudit(tx, expense, audit);
      return expense;
    });
  }

  async pay(
    id: string,
    source: PaymentSource,
    paidOn: string,
    ledger: LedgerHook<Expense>,
    audit?: AuditHook<Expense>,
  ): Promise<Expense> {
    return inTransaction(this.db, async (tx) => {
      // Guarded on still being unpaid: paying twice (two clicks, two tabs) books nothing twice.
      const result = await tx.expense.updateMany({
        where: { id, status: "unpaid" },
        data: { status: "paid", paidFrom: source, paidOn: dayToDate(paidOn) },
      });
      if (result.count === 0) {
        const current = await tx.expense.findUnique({ where: { id } });
        if (!current) throw new NotFoundError("expense", id);
        throw new ConflictError("INVALID_TRANSITION", `This expense is already ${current.status}.`);
      }
      const expense = toExpense(await tx.expense.findUniqueOrThrow({ where: { id } }));
      await postHook(tx, expense, ledger);
      await recordAudit(tx, expense, audit);
      return expense;
    });
  }

  async void(
    id: string,
    reverse: (entry: JournalEntry) => NewJournalEntry,
    audit?: AuditHook<Expense>,
  ): Promise<Expense> {
    return inTransaction(this.db, async (tx) => {
      const result = await tx.expense.updateMany({ where: { id, status: { not: "void" } }, data: { status: "void" } });
      if (result.count === 0) {
        const current = await tx.expense.findUnique({ where: { id } });
        if (!current) throw new NotFoundError("expense", id);
        throw new ConflictError("INVALID_TRANSITION", "This expense is already void.");
      }
      // Every entry still standing for it — the expense and its payment, if any.
      const entries = await tx.journalEntry.findMany({
        where: { sourceId: id, reversedById: null, reversesId: null },
        orderBy: { number: "asc" },
        include: ENTRY_WITH_LINES,
      });
      for (const entry of entries) {
        await reverseEntry(tx, toJournalEntry(entry), reverse);
      }
      await returnReceivedStock(tx, id);
      const expense = toExpense(await tx.expense.findUniqueOrThrow({ where: { id } }));
      await recordAudit(tx, expense, audit);
      return expense;
    });
  }
}

/**
 * A voided stock receipt takes the goods back out at what they cost, matching the
 * reversal of its Dr Inventory. Refused when some of it has already been used —
 * then a count or waste entry is the honest correction.
 */
async function returnReceivedStock(tx: Prisma.TransactionClient, expenseId: string): Promise<void> {
  const received = await tx.stockMovement.findMany({ where: { referenceId: expenseId, kind: "receipt" } });
  if (received.length === 0) return;
  const net = new Map<string, { quantity: number; value: number }>();
  for (const row of received) {
    const total = net.get(row.ingredientId) ?? { quantity: 0, value: 0 };
    net.set(row.ingredientId, { quantity: total.quantity + row.quantity, value: total.value + Number(row.value) });
  }
  const stock = await lockStock(tx, [...net.keys()]);
  const today = cafeDayOf(new Date());
  for (const [ingredientId, { quantity, value }] of net) {
    const current = stock.get(ingredientId);
    if (!current || quantity <= 0) continue;
    if (current.onHand + 1e-9 < quantity) {
      throw new ConflictError(
        "STOCK_USED",
        `Some of the ${current.name} from this delivery has already been used, so it can't be voided.`,
      );
    }
    const onHand = roundQuantity(current.onHand - quantity);
    const remaining = current.value - value;
    await writeMovement(
      tx,
      current,
      { onHand, value: remaining, averageCost: onHand > 0 ? remaining / onHand : current.averageCost },
      {
        kind: "receipt",
        quantity: -quantity,
        value: -value,
        date: today,
        referenceId: expenseId,
        note: "Delivery voided",
      },
      { id: "system", name: "Void" },
    );
  }
}

function toSupplier(row: Prisma.SupplierGetPayload<object>): Supplier {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? undefined,
    note: row.note ?? undefined,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

/** "1042", "EX-1042" or "ex 1042" — how staff quote an expense's number. Short enough to stay an Int. */
const EXPENSE_NUMBER = /^(?:ex[-\s]?)?(\d{1,9})$/i;

/** A search: the words in the description or the supplier's name, or the expense's number. */
function matchQuery(query: string): Prisma.ExpenseWhereInput[] {
  const match: Prisma.ExpenseWhereInput[] = [
    { description: { contains: query, mode: "insensitive" } },
    { supplierName: { contains: query, mode: "insensitive" } },
  ];
  const number = EXPENSE_NUMBER.exec(query)?.[1];
  if (number) match.push({ number: Number(number) });
  return match;
}

function toStatus(value: string): ExpenseStatus {
  return (EXPENSE_STATUSES as readonly string[]).includes(value) ? (value as ExpenseStatus) : "unpaid";
}

function toSource(value: string | null): PaymentSource | undefined {
  return value && (PAYMENT_SOURCES as readonly string[]).includes(value) ? (value as PaymentSource) : undefined;
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    number: row.number,
    date: dateToDay(row.date),
    supplierId: row.supplierId ?? undefined,
    supplierName: row.supplierName ?? undefined,
    accountCode: row.accountCode,
    description: row.description,
    amount: Number(row.amount),
    vatAmount: Number(row.vatAmount),
    status: toStatus(row.status),
    paidFrom: toSource(row.paidFrom),
    paidOn: row.paidOn ? dateToDay(row.paidOn) : undefined,
    receiptUrl: row.receiptUrl ?? undefined,
    createdById: row.createdById,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
  };
}
