import { Prisma } from "@prisma/client";

import type { AccountMovement } from "@/src/domain/entities/AccountingReports";
import { ACCOUNT_TYPES, type Account, type AccountingSettings, type AccountType, type JournalEntry, type NewJournalEntry } from "@/src/domain/entities/Ledger";
import { createPage, toSkipTake, type Page, type PageRequest } from "@/src/domain/entities/Pagination";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import { UniqueConstraintError } from "@/src/domain/errors/UniqueConstraintError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type {
  ILedgerRepository,
  ItemSalesCost,
  JournalFilters,
  NewAccount,
  RawLedgerLine,
  VatMovement,
} from "@/src/domain/repositories/ILedgerRepository";
import { prisma } from "@/src/infrastructure/prisma/client";

import { recordAudit } from "./writeActivityEntry";
import { dateToDay, dayToDate, ENTRY_WITH_LINES, postEntry, readSettings, reverseEntry, toJournalEntry } from "./writeJournal";

/**
 * The general ledger, backed by PostgreSQL. Writes go through `writeJournal`'s
 * single posting path; reads aggregate in SQL. Sums come back as `bigint` and are
 * narrowed with `Number()` — Toman amounts stay far below 2^53.
 */
export class PrismaLedgerRepository implements ILedgerRepository {
  async listAccounts(): Promise<Account[]> {
    const rows = await prisma.ledgerAccount.findMany({ orderBy: { code: "asc" } });
    return rows.map(toAccount);
  }

  async getAccount(code: string): Promise<Account | null> {
    const row = await prisma.ledgerAccount.findUnique({ where: { code } });
    return row ? toAccount(row) : null;
  }

  async createAccount(input: NewAccount, audit?: AuditHook<Account>): Promise<Account> {
    try {
      return await prisma.$transaction(async (tx) => {
        const account = toAccount(await tx.ledgerAccount.create({ data: { ...input, isSystem: false, isActive: true } }));
        await recordAudit(tx, account, audit);
        return account;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new UniqueConstraintError(["code"], { cause: error });
      }
      throw error;
    }
  }

  async setAccountActive(code: string, active: boolean, audit?: AuditHook<Account>): Promise<Account> {
    return prisma.$transaction(async (tx) => {
      const row = await tx.ledgerAccount.findUnique({ where: { code } });
      if (!row) throw new NotFoundError("account", code);
      if (row.isSystem && !active) throw new ConflictError("ACCOUNT_INACTIVE", "System accounts can't be deactivated.");
      const account = toAccount(await tx.ledgerAccount.update({ where: { code }, data: { isActive: active } }));
      await recordAudit(tx, account, audit);
      return account;
    });
  }

  async getSettings(): Promise<AccountingSettings> {
    return readSettings(prisma);
  }

  async updateSettings(settings: AccountingSettings, audit?: AuditHook<AccountingSettings>): Promise<AccountingSettings> {
    const data = {
      vatRateBps: settings.vatRateBps,
      booksClosedThrough: settings.booksClosedThrough ? dayToDate(settings.booksClosedThrough) : null,
    };
    return prisma.$transaction(async (tx) => {
      await tx.accountingSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
      const saved = await readSettings(tx);
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }

  async post(entry: NewJournalEntry, audit?: AuditHook<JournalEntry>): Promise<JournalEntry> {
    return prisma.$transaction(async (tx) => {
      const posted = await postEntry(tx, entry);
      await recordAudit(tx, posted, audit);
      return posted;
    });
  }

  async reverse(
    entryId: string,
    reversal: (original: JournalEntry) => NewJournalEntry,
    audit?: AuditHook<JournalEntry>,
  ): Promise<JournalEntry> {
    return prisma.$transaction(async (tx) => {
      const row = await tx.journalEntry.findUnique({ where: { id: entryId }, include: ENTRY_WITH_LINES });
      if (!row) throw new NotFoundError("journal entry", entryId);
      const posted = await reverseEntry(tx, toJournalEntry(row), reversal);
      await recordAudit(tx, posted, audit);
      return posted;
    });
  }

  async getEntry(id: string): Promise<JournalEntry | null> {
    const row = await prisma.journalEntry.findUnique({ where: { id }, include: ENTRY_WITH_LINES });
    return row ? toJournalEntry(row) : null;
  }

  async listEntries(filters: JournalFilters, page: PageRequest): Promise<Page<JournalEntry>> {
    const where: Prisma.JournalEntryWhereInput = {
      ...(filters.fromDay || filters.toDay
        ? {
            date: {
              ...(filters.fromDay ? { gte: dayToDate(filters.fromDay) } : {}),
              ...(filters.toDay ? { lte: dayToDate(filters.toDay) } : {}),
            },
          }
        : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.accountCode ? { lines: { some: { accountCode: filters.accountCode } } } : {}),
    };
    const { skip, take } = toSkipTake(page);
    const [rows, total] = await prisma.$transaction([
      prisma.journalEntry.findMany({ where, orderBy: [{ date: "desc" }, { number: "desc" }], skip, take, include: ENTRY_WITH_LINES }),
      prisma.journalEntry.count({ where }),
    ]);
    return createPage(rows.map(toJournalEntry), total, page);
  }

  async entriesFor(sourceId: string): Promise<JournalEntry[]> {
    const rows = await prisma.journalEntry.findMany({
      where: { sourceId },
      orderBy: { number: "asc" },
      include: ENTRY_WITH_LINES,
    });
    return rows.map(toJournalEntry);
  }

  async movements(fromDay?: string, toDay?: string): Promise<AccountMovement[]> {
    const rows = await prisma.$queryRaw<{ account_code: string; debit: bigint | null; credit: bigint | null }[]>`
      SELECT l.account_code, SUM(l.debit) AS debit, SUM(l.credit) AS credit
      FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
      WHERE (${fromDay ?? null}::date IS NULL OR e.date >= ${fromDay ?? null}::date)
        AND (${toDay ?? null}::date IS NULL OR e.date <= ${toDay ?? null}::date)
      GROUP BY l.account_code`;
    return rows.map((row) => ({ accountCode: row.account_code, debit: Number(row.debit ?? 0), credit: Number(row.credit ?? 0) }));
  }

  async accountLines(code: string, fromDay: string, toDay: string): Promise<RawLedgerLine[]> {
    const rows = await prisma.journalLine.findMany({
      where: { accountCode: code, entry: { date: { gte: dayToDate(fromDay), lte: dayToDate(toDay) } } },
      include: { entry: true },
      orderBy: [{ entry: { date: "asc" } }, { entry: { number: "asc" } }, { position: "asc" }],
    });
    return rows.map((row) => ({
      entryId: row.entryId,
      number: row.entry.number,
      date: dateToDay(row.entry.date),
      description: row.entry.description,
      source: toJournalEntry({ ...row.entry, lines: [] }).source,
      debit: Number(row.debit),
      credit: Number(row.credit),
      memo: row.memo ?? undefined,
    }));
  }

  async vatMovement(fromDay: string, toDay: string): Promise<VatMovement> {
    // A reversal counts toward whatever it reversed, so voiding an expense takes
    // its input VAT back out rather than looking like new output VAT.
    const [row] = await prisma.$queryRaw<{ output: bigint | null; input: bigint | null; settled: bigint | null }[]>`
      SELECT
        SUM(CASE WHEN origin IN ('orderSale') THEN credit - debit ELSE 0 END) AS output,
        SUM(CASE WHEN origin IN ('expense') THEN debit - credit ELSE 0 END) AS input,
        SUM(CASE WHEN origin IN ('manual') THEN debit - credit ELSE 0 END) AS settled
      FROM (
        SELECT l.debit, l.credit, COALESCE(o.source, e.source) AS origin
        FROM journal_lines l
        JOIN journal_entries e ON e.id = l.entry_id
        LEFT JOIN journal_entries o ON o.id = e.reverses_id
        WHERE l.account_code = '2200' AND e.date >= ${fromDay}::date AND e.date <= ${toDay}::date
      ) movement`;
    return { output: Number(row?.output ?? 0), input: Number(row?.input ?? 0), settled: Number(row?.settled ?? 0) };
  }

  async itemSalesCost(fromDay: string, toDay: string): Promise<ItemSalesCost[]> {
    // Orders whose sale was booked in the span — the same set the revenue accounts hold.
    const rows = await prisma.$queryRaw<
      {
        product_id: string;
        name: string;
        quantity: bigint;
        gross: bigint;
        taxable_gross: bigint;
        cost: bigint | null;
        cost_known: boolean;
      }[]
    >`
      SELECT
        oi.product_id,
        (array_agg(oi.name ORDER BY o.placed_at DESC))[1] AS name,
        SUM(oi.quantity) AS quantity,
        SUM(oi.unit_price * oi.quantity) AS gross,
        SUM(CASE WHEN oi.tax_exempt THEN 0 ELSE oi.unit_price * oi.quantity END) AS taxable_gross,
        SUM(COALESCE(oi.unit_cost, 0) * oi.quantity) AS cost,
        BOOL_AND(oi.unit_cost IS NOT NULL) AS cost_known
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN journal_entries je ON je.source = 'orderSale' AND je.source_id = o.id AND je.reversed_by_id IS NULL
      WHERE je.date >= ${fromDay}::date AND je.date <= ${toDay}::date
      GROUP BY oi.product_id
      ORDER BY gross DESC`;
    return rows.map((row) => ({
      productId: row.product_id,
      name: row.name,
      quantity: Number(row.quantity),
      gross: Number(row.gross),
      taxableGross: Number(row.taxable_gross),
      cost: Number(row.cost ?? 0),
      costKnown: row.cost_known,
    }));
  }
}

function toType(value: string): AccountType {
  return (ACCOUNT_TYPES as readonly string[]).includes(value) ? (value as AccountType) : "expense";
}

function toAccount(row: Prisma.LedgerAccountGetPayload<object>): Account {
  return {
    code: row.code,
    name: row.name,
    nameFa: row.nameFa,
    type: toType(row.type),
    isSystem: row.isSystem,
    isActive: row.isActive,
  };
}
