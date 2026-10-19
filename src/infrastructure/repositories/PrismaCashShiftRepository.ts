import {
  CASH_SHIFT_STATUSES,
  expectedDrawer,
  type CashShift,
  type CashShiftStatus,
  type ShiftMovements,
} from "@/src/domain/entities/CashShift";
import { SYSTEM_ACCOUNTS } from "@/src/domain/entities/Ledger";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import type {
  CloseShiftInput,
  ICashShiftRepository,
  OpenShiftInput,
} from "@/src/domain/repositories/ICashShiftRepository";
import type { LedgerHook } from "@/src/domain/repositories/ILedgerRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";
import { inTransaction, type PrismaDb } from "@/src/infrastructure/prisma/transaction";

import { postHook } from "./writeJournal";

/** The order postings that settle a guest's bill (or hand it back). */
const PAYMENT_SOURCES = ["orderPayment", "orderPaymentReversal", "orderRefund"];

/**
 * Till shifts backed by PostgreSQL via Prisma. The drawer's expected cash comes
 * from the journal — the same rows the books are made of — rather than a second
 * tally kept beside them.
 */
export class PrismaCashShiftRepository implements ICashShiftRepository {
  constructor(private readonly db: PrismaDb = prisma) {}

  async getOpen(): Promise<CashShift | null> {
    const row = await this.db.cashShift.findFirst({ where: { status: "open" } });
    return row ? toShift(row) : null;
  }

  async getById(id: string): Promise<CashShift | null> {
    const row = await this.db.cashShift.findUnique({ where: { id } });
    return row ? toShift(row) : null;
  }

  async list(limit: number): Promise<CashShift[]> {
    const rows = await this.db.cashShift.findMany({ orderBy: { openedAt: "desc" }, take: limit });
    return rows.map(toShift);
  }

  async open(input: OpenShiftInput): Promise<CashShift> {
    try {
      const row = await this.db.cashShift.create({
        data: {
          openingFloat: input.openingFloat,
          note: input.note ?? null,
          openedById: input.by.id,
          openedByName: input.by.name,
        },
      });
      return toShift(row);
    } catch (error) {
      // The partial unique index allows one open shift.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("SHIFT_ALREADY_OPEN", "A shift is already open.", { cause: error });
      }
      throw error;
    }
  }

  movements(from: Date, to: Date): Promise<ShiftMovements> {
    return readMovements(this.db, from, to);
  }

  async close(id: string, input: CloseShiftInput, ledger?: LedgerHook<CashShift>): Promise<CashShift> {
    return inTransaction(this.db, async (tx) => {
      // Lock the row: two people closing the same shift can't both count it.
      const locked = await tx.$queryRaw<
        { status: string }[]
      >`SELECT "status" FROM "cash_shifts" WHERE "id" = ${id} FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundError("cash shift", id);
      if (locked[0].status !== "open") throw new ConflictError("NO_OPEN_SHIFT", "This shift is already closed.");

      const current = await tx.cashShift.findUniqueOrThrow({ where: { id } });
      const moved = await readMovements(tx, current.openedAt, input.at);
      const expectedCash = expectedDrawer(current.openingFloat, moved);
      const row = await tx.cashShift.update({
        where: { id },
        data: {
          status: "closed",
          closedAt: input.at,
          closedById: input.by.id,
          closedByName: input.by.name,
          expectedCash,
          countedCash: input.countedCash,
          difference: input.countedCash - expectedCash,
          note: input.note ?? current.note,
        },
      });
      const shift = toShift(row);
      await postHook(tx, shift, ledger);
      return shift;
    });
  }
}

/**
 * Net movement per account from the journal entries posted in `[from, to)`. The
 * shift's own over/short entries are left out — they're the result of a count,
 * not something the drawer took in.
 */
async function readMovements(
  db: Pick<Prisma.TransactionClient, "journalLine">,
  from: Date,
  to: Date,
): Promise<ShiftMovements> {
  const window = { createdAt: { gte: from, lt: to } };
  const [cash, bank, online, payments] = await Promise.all([
    db.journalLine.aggregate({
      where: { accountCode: SYSTEM_ACCOUNTS.cash, entry: { ...window, source: { not: "cashShift" } } },
      _sum: { debit: true, credit: true },
    }),
    db.journalLine.aggregate({
      where: { accountCode: SYSTEM_ACCOUNTS.bank, entry: { ...window, source: { in: PAYMENT_SOURCES } } },
      _sum: { debit: true, credit: true },
    }),
    db.journalLine.aggregate({
      where: { accountCode: SYSTEM_ACCOUNTS.gatewayClearing, entry: { ...window, source: { in: PAYMENT_SOURCES } } },
      _sum: { debit: true, credit: true },
    }),
    db.journalLine.count({
      where: { accountCode: SYSTEM_ACCOUNTS.guestReceivables, entry: { ...window, source: "orderPayment" } },
    }),
  ]);
  const net = (sum: { debit: bigint | null; credit: bigint | null }) =>
    Number(sum.debit ?? 0) - Number(sum.credit ?? 0);
  return { cash: net(cash._sum), bank: net(bank._sum), online: net(online._sum), payments };
}

type ShiftRow = Prisma.CashShiftGetPayload<object>;

function toStatus(value: string): CashShiftStatus {
  return (CASH_SHIFT_STATUSES as readonly string[]).includes(value) ? (value as CashShiftStatus) : "closed";
}

function toShift(row: ShiftRow): CashShift {
  return {
    id: row.id,
    number: row.number,
    status: toStatus(row.status),
    openedAt: row.openedAt.toISOString(),
    openedById: row.openedById,
    openedByName: row.openedByName,
    openingFloat: row.openingFloat,
    closedAt: row.closedAt?.toISOString(),
    closedByName: row.closedByName ?? undefined,
    expectedCash: row.expectedCash ?? undefined,
    countedCash: row.countedCash ?? undefined,
    difference: row.difference ?? undefined,
    note: row.note ?? undefined,
  };
}
