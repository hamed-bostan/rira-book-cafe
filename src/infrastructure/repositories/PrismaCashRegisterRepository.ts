import { Prisma } from "@prisma/client";

import { shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { CashClose, CashDaySnapshot, CashMovementLine } from "@/src/domain/entities/CashClose";
import { SYSTEM_ACCOUNTS } from "@/src/domain/entities/Ledger";
import { createPage, toSkipTake, type Page, type PageRequest } from "@/src/domain/entities/Pagination";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type { CashCloseBuilder, ICashRegisterRepository } from "@/src/domain/repositories/ICashRegisterRepository";
import { prisma } from "@/src/infrastructure/prisma/client";

import { recordAudit } from "./writeActivityEntry";
import { dateToDay, dayToDate, postEntry, toJournalEntry } from "./writeJournal";

type Db = Prisma.TransactionClient | typeof prisma;

const CLOSE_WITH_ENTRY = { entry: { select: { number: true } } } satisfies Prisma.CashCloseInclude;
type CloseRow = Prisma.CashCloseGetPayload<{ include: typeof CLOSE_WITH_ENTRY }>;

/** Serializes closes: two people pressing "close" at once can't both pass the order check. */
const CLOSE_LOCK = "cash-register-close";

/**
 * The cash register's daily closes, in PostgreSQL. The expected cash is read from
 * Cash on hand (1110) inside the closing transaction, and the over/short and
 * deposit are posted through the ledger's single posting path in that same
 * transaction. The database refuses edits, deletes and out-of-order closes.
 */
export class PrismaCashRegisterRepository implements ICashRegisterRepository {
  daySnapshot(day: string): Promise<CashDaySnapshot> {
    return readSnapshot(prisma, day);
  }

  async lastClose(): Promise<CashClose | null> {
    const row = await prisma.cashClose.findFirst({ orderBy: { day: "desc" }, include: CLOSE_WITH_ENTRY });
    return row ? toCashClose(row) : null;
  }

  async listCloses(page: PageRequest): Promise<Page<CashClose>> {
    const { skip, take } = toSkipTake(page);
    const [rows, total] = await prisma.$transaction([
      prisma.cashClose.findMany({ orderBy: { day: "desc" }, skip, take, include: CLOSE_WITH_ENTRY }),
      prisma.cashClose.count(),
    ]);
    return createPage(rows.map(toCashClose), total, page);
  }

  async cashActivityDays(fromDay: string, toDay: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ day: Date }[]>`
      SELECT DISTINCT e.date AS day
      FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
      WHERE l.account_code = ${SYSTEM_ACCOUNTS.cash} AND e.date >= ${fromDay}::date AND e.date <= ${toDay}::date
      ORDER BY day`;
    return rows.map((row) => dateToDay(row.day));
  }

  async close(day: string, build: CashCloseBuilder, audit?: AuditHook<CashClose>): Promise<CashClose> {
    try {
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CLOSE_LOCK}))`;
        const latest = await tx.cashClose.findFirst({ where: { day: { gte: dayToDate(day) } }, orderBy: { day: "desc" } });
        if (latest) {
          const latestDay = dateToDay(latest.day);
          throw latestDay === day
            ? new ConflictError("DAY_ALREADY_CLOSED", `The till is already closed for ${day}.`)
            : new ConflictError("CLOSE_OUT_OF_ORDER", `The till is already closed for ${latestDay}, after ${day}.`);
        }

        const { close, entry } = build(await readSnapshot(tx, day));
        const posted = entry ? await postEntry(tx, entry) : null;
        const row = await tx.cashClose.create({
          data: {
            day: dayToDate(close.day),
            openingFloat: BigInt(close.openingFloat),
            cashIn: BigInt(close.cashIn),
            cashOut: BigInt(close.cashOut),
            expected: BigInt(close.expected),
            counted: BigInt(close.counted),
            difference: BigInt(close.difference),
            deposited: BigInt(close.deposited),
            closingFloat: BigInt(close.closingFloat),
            entryId: posted?.id ?? null,
            note: close.note ?? null,
            closedById: close.closedById,
            closedByName: close.closedByName,
          },
          include: CLOSE_WITH_ENTRY,
        });
        const saved = toCashClose(row);
        await recordAudit(tx, saved, audit);
        return saved;
      });
    } catch (error) {
      // A concurrent close of the same day that slipped past the lock (it can't, but
      // the unique index is the last word).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("DAY_ALREADY_CLOSED", `The till is already closed for ${day}.`, { cause: error });
      }
      throw error;
    }
  }
}

/** Cash on hand through the day before, and the day's lines on it. */
async function readSnapshot(db: Db, day: string): Promise<CashDaySnapshot> {
  const previous = shiftCafeDay(day, -1);
  const [opening] = await db.$queryRaw<{ balance: bigint | null }[]>`
    SELECT SUM(l.debit) - SUM(l.credit) AS balance
    FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
    WHERE l.account_code = ${SYSTEM_ACCOUNTS.cash} AND e.date <= ${previous}::date`;
  const rows = await db.journalLine.findMany({
    where: { accountCode: SYSTEM_ACCOUNTS.cash, entry: { date: dayToDate(day) } },
    include: { entry: true },
    orderBy: [{ entry: { number: "asc" } }, { position: "asc" }],
  });
  const lines: CashMovementLine[] = rows.map((row) => ({
    entryId: row.entryId,
    number: row.entry.number,
    description: row.entry.description,
    source: toJournalEntry({ ...row.entry, lines: [] }).source,
    debit: Number(row.debit),
    credit: Number(row.credit),
  }));
  return { day, openingFloat: Number(opening?.balance ?? 0), lines };
}

function toCashClose(row: CloseRow): CashClose {
  return {
    id: row.id,
    day: dateToDay(row.day),
    openingFloat: Number(row.openingFloat),
    cashIn: Number(row.cashIn),
    cashOut: Number(row.cashOut),
    expected: Number(row.expected),
    counted: Number(row.counted),
    difference: Number(row.difference),
    deposited: Number(row.deposited),
    closingFloat: Number(row.closingFloat),
    entryId: row.entryId ?? undefined,
    entryNumber: row.entry?.number,
    note: row.note ?? undefined,
    closedById: row.closedById,
    closedByName: row.closedByName,
    closedAt: row.createdAt.toISOString(),
  };
}
