import {
  assertMatchBalances,
  assertStatementFollows,
  BANK_STATEMENT_STATUSES,
  type BankStatement,
  type BankStatementLine,
  type BankStatementStatus,
  type BankStatementSummary,
  type BookFigures,
  type LedgerCandidate,
  type NewBankStatement,
  type NewStatementLine,
} from "@/src/domain/entities/BankReconciliation";
import { shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { SYSTEM_ACCOUNTS, type JournalEntry, type NewJournalEntry } from "@/src/domain/entities/Ledger";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import { ValidationError } from "@/src/domain/errors/ValidationError";
import type { AuditHook } from "@/src/domain/repositories/AuditHook";
import type {
  IBankReconciliationRepository,
  MatchGroup,
  StatementChange,
} from "@/src/domain/repositories/IBankReconciliationRepository";
import { prisma } from "@/src/infrastructure/prisma/client";
import { Prisma } from "@/src/infrastructure/prisma/generated/client";

import { recordAudit } from "./writeActivityEntry";
import { dateToDay, dayToDate, postEntry, toJournalEntry } from "./writeJournal";

type Db = Prisma.TransactionClient | typeof prisma;
type Actor = { id: string; name: string };

const STATEMENT_WITH_LINES = { lines: { orderBy: { position: "asc" } } } satisfies Prisma.BankStatementInclude;
type StatementRow = Prisma.BankStatementGetPayload<{ include: typeof STATEMENT_WITH_LINES }>;

/** How far past a statement's end a ledger line may be dated and still be matched to it. */
const CANDIDATE_DAYS_AFTER = 31;

/** Serializes statement creation, so two imports can't both pass the sequence check. */
const STATEMENT_LOCK = "bank-statement-create";

/**
 * Bank statements and their reconciliation, in PostgreSQL. Every change locks its
 * statement row; matches are checked here (and again, deferred, by the database:
 * both sides total the same, ledger lines on the statement's account, each ledger
 * line cleared once), and a reconciled statement is frozen by triggers.
 */
export class PrismaBankReconciliationRepository implements IBankReconciliationRepository {
  async listStatements(): Promise<BankStatementSummary[]> {
    const [rows, unmatched] = await Promise.all([
      prisma.bankStatement.findMany({ orderBy: { fromDay: "desc" }, include: { _count: { select: { lines: true } } } }),
      prisma.bankStatementLine.groupBy({ by: ["statementId"], where: { matchId: null }, _count: { _all: true } }),
    ]);
    const open = new Map(unmatched.map((row) => [row.statementId, row._count._all]));
    return rows.map((row) => ({
      ...toStatement({ ...row, lines: [] }),
      lineCount: row._count.lines,
      unmatchedCount: open.get(row.id) ?? 0,
    }));
  }

  async getStatement(id: string): Promise<BankStatement | null> {
    const row = await prisma.bankStatement.findUnique({ where: { id }, include: STATEMENT_WITH_LINES });
    return row ? toStatement(row) : null;
  }

  async createStatement(input: NewBankStatement, audit?: AuditHook<BankStatement>): Promise<BankStatement> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${STATEMENT_LOCK}))`;
      const previous = await tx.bankStatement.findFirst({
        where: { accountCode: SYSTEM_ACCOUNTS.bank },
        orderBy: { toDay: "desc" },
      });
      assertStatementFollows(
        previous ? { toDay: dateToDay(previous.toDay), closingBalance: Number(previous.closingBalance) } : null,
        input,
      );

      const row = await tx.bankStatement.create({
        data: {
          accountCode: SYSTEM_ACCOUNTS.bank,
          fromDay: dayToDate(input.fromDay),
          toDay: dayToDate(input.toDay),
          openingBalance: BigInt(input.openingBalance),
          closingBalance: BigInt(input.closingBalance),
          createdById: input.createdById,
          createdByName: input.createdByName,
          lines: { create: input.lines.map((line, position) => lineData(line, position)) },
        },
        include: STATEMENT_WITH_LINES,
      });
      const statement = toStatement(row);
      await recordAudit(tx, statement, audit);
      return statement;
    });
  }

  async addLines(
    statementId: string,
    lines: NewStatementLine[],
    audit?: AuditHook<StatementChange>,
  ): Promise<BankStatement> {
    return prisma.$transaction(async (tx) => {
      await lockOpenStatement(tx, statementId);
      const last = await tx.bankStatementLine.findFirst({ where: { statementId }, orderBy: { position: "desc" } });
      const start = (last?.position ?? -1) + 1;
      await tx.bankStatementLine.createMany({
        data: lines.map((line, index) => ({ statementId, ...lineData(line, start + index) })),
      });
      const statement = await readStatement(tx, statementId);
      await recordAudit(tx, { statement, count: lines.length }, audit);
      return statement;
    });
  }

  async removeLine(statementId: string, lineId: string, audit?: AuditHook<StatementChange>): Promise<BankStatement> {
    return prisma.$transaction(async (tx) => {
      await lockOpenStatement(tx, statementId);
      const line = await tx.bankStatementLine.findFirst({ where: { id: lineId, statementId } });
      if (!line) throw new NotFoundError("statement line", lineId);
      if (line.matchId) throw new ConflictError("ALREADY_MATCHED", "Unmatch the line before removing it.");
      await tx.bankStatementLine.delete({ where: { id: lineId } });
      const statement = await readStatement(tx, statementId);
      await recordAudit(tx, { statement, count: 1 }, audit);
      return statement;
    });
  }

  async candidates(statementId: string): Promise<LedgerCandidate[]> {
    const statement = await prisma.bankStatement.findUnique({ where: { id: statementId } });
    if (!statement) throw new NotFoundError("bank statement", statementId);
    const start = await reconciliationStart(prisma, statement.accountCode);
    const rows = await prisma.journalLine.findMany({
      where: {
        accountCode: statement.accountCode,
        entry: {
          date: {
            gte: dayToDate(start),
            lte: dayToDate(shiftCafeDay(dateToDay(statement.toDay), CANDIDATE_DAYS_AFTER)),
          },
        },
        OR: [{ bankMatch: null }, { bankMatch: { match: { statementId } } }],
      },
      include: { entry: true, bankMatch: true },
      orderBy: [{ entry: { date: "asc" } }, { entry: { number: "asc" } }, { position: "asc" }],
    });
    return rows.map((row) => ({
      lineId: row.id,
      entryId: row.entryId,
      entryNumber: row.entry.number,
      date: dateToDay(row.entry.date),
      description: row.entry.description,
      source: toJournalEntry({ ...row.entry, lines: [] }).source,
      memo: row.memo ?? undefined,
      amount: Number(row.debit) - Number(row.credit),
      matchId: row.bankMatch?.matchId,
    }));
  }

  async bookFigures(statementId: string): Promise<BookFigures> {
    const statement = await prisma.bankStatement.findUnique({ where: { id: statementId } });
    if (!statement) throw new NotFoundError("bank statement", statementId);
    return readBookFigures(prisma, statement.accountCode, dateToDay(statement.toDay));
  }

  async match(
    statementId: string,
    groups: MatchGroup[],
    actor: Actor,
    audit?: AuditHook<StatementChange>,
  ): Promise<number> {
    try {
      return await prisma.$transaction(async (tx) => {
        const statement = await lockOpenStatement(tx, statementId);
        for (const group of groups) {
          await createMatch(tx, statement, group, actor);
        }
        await recordAudit(tx, { statement: await readStatement(tx, statementId), count: groups.length }, audit);
        return groups.length;
      });
    } catch (error) {
      throw alreadyMatched(error);
    }
  }

  async unmatch(statementId: string, matchId: string, audit?: AuditHook<StatementChange>): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await lockOpenStatement(tx, statementId);
      const match = await tx.bankMatch.findFirst({ where: { id: matchId, statementId } });
      if (!match) throw new NotFoundError("match", matchId);
      await tx.bankMatchLedgerLine.deleteMany({ where: { matchId } });
      await tx.bankStatementLine.updateMany({ where: { matchId }, data: { matchId: null } });
      await tx.bankMatch.delete({ where: { id: matchId } });
      await recordAudit(tx, { statement: await readStatement(tx, statementId), count: 1 }, audit);
    });
  }

  async postAndMatch(
    statementId: string,
    lineId: string,
    build: (line: BankStatementLine) => NewJournalEntry,
    audit?: AuditHook<JournalEntry>,
  ): Promise<JournalEntry> {
    try {
      return await prisma.$transaction(async (tx) => {
        const statement = await lockOpenStatement(tx, statementId);
        const row = await tx.bankStatementLine.findFirst({ where: { id: lineId, statementId } });
        if (!row) throw new NotFoundError("statement line", lineId);
        if (row.matchId) throw new ConflictError("ALREADY_MATCHED", "That statement line is already matched.");

        const entry = build(toLine(row));
        const posted = await postEntry(tx, entry);
        const bankLines = await tx.journalLine.findMany({
          where: { entryId: posted.id, accountCode: statement.accountCode },
        });
        await createMatch(
          tx,
          statement,
          { statementLineIds: [lineId], ledgerLineIds: bankLines.map((line) => line.id) },
          { id: entry.createdById, name: entry.createdByName },
        );
        await recordAudit(tx, posted, audit);
        return posted;
      });
    } catch (error) {
      throw alreadyMatched(error);
    }
  }

  async reconcile(
    statementId: string,
    actor: Actor,
    check: (statement: BankStatement, book: BookFigures) => void,
    audit?: AuditHook<BankStatement>,
  ): Promise<BankStatement> {
    return prisma.$transaction(async (tx) => {
      const locked = await lockStatement(tx, statementId);
      const earlierOpen = await tx.bankStatement.count({
        where: { accountCode: locked.accountCode, toDay: { lt: locked.fromDay }, status: "open" },
      });
      if (earlierOpen > 0)
        throw new ConflictError("PREVIOUS_NOT_RECONCILED", "Reconcile the earlier statements first.");

      const statement = await readStatement(tx, statementId);
      check(statement, await readBookFigures(tx, locked.accountCode, statement.toDay));

      await tx.bankStatement.update({
        where: { id: statementId },
        data: {
          status: "reconciled",
          reconciledAt: new Date(),
          reconciledById: actor.id,
          reconciledByName: actor.name,
        },
      });
      const saved = await readStatement(tx, statementId);
      await recordAudit(tx, saved, audit);
      return saved;
    });
  }
}

type LockedStatement = { id: string; accountCode: string; fromDay: Date; toDay: Date; status: string };

async function lockStatement(tx: Prisma.TransactionClient, id: string): Promise<LockedStatement> {
  const [row] = await tx.$queryRaw<
    { id: string; account_code: string; from_day: Date; to_day: Date; status: string }[]
  >`SELECT id, account_code, from_day, to_day, status FROM bank_statements WHERE id = ${id} FOR UPDATE`;
  if (!row) throw new NotFoundError("bank statement", id);
  return {
    id: row.id,
    accountCode: row.account_code,
    fromDay: row.from_day,
    toDay: row.to_day,
    status: row.status,
  };
}

async function lockOpenStatement(tx: Prisma.TransactionClient, id: string): Promise<LockedStatement> {
  const statement = await lockStatement(tx, id);
  if (statement.status !== "open")
    throw new ConflictError("STATEMENT_RECONCILED", "This statement is reconciled and can no longer change.");
  return statement;
}

/** Match one group of lines inside the caller's transaction, after checking every rule. */
async function createMatch(
  tx: Prisma.TransactionClient,
  statement: LockedStatement,
  group: MatchGroup,
  actor: Actor,
): Promise<void> {
  const statementLineIds = [...new Set(group.statementLineIds)];
  const ledgerLineIds = [...new Set(group.ledgerLineIds)];

  const lines = await tx.bankStatementLine.findMany({
    where: { id: { in: statementLineIds }, statementId: statement.id },
  });
  if (lines.length !== statementLineIds.length) throw new NotFoundError("statement line", statementLineIds.join(", "));
  if (lines.some((line) => line.matchId))
    throw new ConflictError("ALREADY_MATCHED", "A statement line is already matched.");

  const start = await reconciliationStart(tx, statement.accountCode);
  const until = shiftCafeDay(dateToDay(statement.toDay), CANDIDATE_DAYS_AFTER);
  const ledger = await tx.journalLine.findMany({
    where: { id: { in: ledgerLineIds } },
    include: { entry: true, bankMatch: true },
  });
  if (ledger.length !== ledgerLineIds.length) throw new NotFoundError("ledger line", ledgerLineIds.join(", "));
  for (const line of ledger) {
    if (line.accountCode !== statement.accountCode) throw new ValidationError("ledgerLineIds", "wrongAccount");
    if (line.bankMatch) throw new ConflictError("ALREADY_MATCHED", "A ledger line is already matched.");
    const day = dateToDay(line.entry.date);
    if (day < start || day > until) throw new ValidationError("ledgerLineIds", "outsideMatchRange");
  }

  assertMatchBalances(
    lines.map((line) => Number(line.amount)),
    ledger.map((line) => Number(line.debit) - Number(line.credit)),
  );

  const match = await tx.bankMatch.create({
    data: { statementId: statement.id, createdById: actor.id, createdByName: actor.name },
  });
  await tx.bankStatementLine.updateMany({ where: { id: { in: statementLineIds } }, data: { matchId: match.id } });
  await tx.bankMatchLedgerLine.createMany({
    data: ledgerLineIds.map((journalLineId) => ({ matchId: match.id, journalLineId })),
  });
}

/** A ledger line matched twice by racing requests trips the unique index. */
function alreadyMatched(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new ConflictError("ALREADY_MATCHED", "A line was matched by someone else meanwhile.", { cause: error });
  }
  return error;
}

/** The first day reconciliation covers: the earliest statement's start. Ledger lines before it are history. */
async function reconciliationStart(db: Db, accountCode: string): Promise<string> {
  const first = await db.bankStatement.findFirst({ where: { accountCode }, orderBy: { fromDay: "asc" } });
  return first ? dateToDay(first.fromDay) : "9999-12-31";
}

async function readBookFigures(db: Db, accountCode: string, toDay: string): Promise<BookFigures> {
  const start = await reconciliationStart(db, accountCode);
  // `cleared`: the ledger line is matched on this statement or an earlier one.
  const [row] = await db.$queryRaw<
    {
      book: bigint | null;
      outstanding: bigint | null;
      outstanding_count: bigint | null;
      cleared_after: bigint | null;
    }[]
  >`
    SELECT
      SUM(CASE WHEN day <= ${toDay}::date THEN amount ELSE 0 END) AS book,
      SUM(CASE WHEN day >= ${start}::date AND day <= ${toDay}::date AND NOT cleared THEN amount ELSE 0 END) AS outstanding,
      COUNT(*) FILTER (WHERE day >= ${start}::date AND day <= ${toDay}::date AND NOT cleared) AS outstanding_count,
      SUM(CASE WHEN day > ${toDay}::date AND cleared THEN amount ELSE 0 END) AS cleared_after
    FROM (
      SELECT
        e.date AS day,
        l.debit - l.credit AS amount,
        EXISTS (
          SELECT 1
          FROM bank_match_ledger_lines ml
          JOIN bank_matches m ON m.id = ml.match_id
          JOIN bank_statements s ON s.id = m.statement_id
          WHERE ml.journal_line_id = l.id AND s.to_day <= ${toDay}::date
        ) AS cleared
      FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
      WHERE l.account_code = ${accountCode}
    ) line`;
  return {
    bookBalance: Number(row?.book ?? 0),
    outstanding: Number(row?.outstanding ?? 0),
    outstandingCount: Number(row?.outstanding_count ?? 0),
    clearedAfter: Number(row?.cleared_after ?? 0),
  };
}

async function readStatement(db: Db, id: string): Promise<BankStatement> {
  const row = await db.bankStatement.findUnique({ where: { id }, include: STATEMENT_WITH_LINES });
  if (!row) throw new NotFoundError("bank statement", id);
  return toStatement(row);
}

function lineData(line: NewStatementLine, position: number) {
  return {
    date: dayToDate(line.date),
    description: line.description,
    reference: line.reference ?? null,
    amount: BigInt(line.amount),
    position,
  };
}

function toStatus(value: string): BankStatementStatus {
  return (BANK_STATEMENT_STATUSES as readonly string[]).includes(value) ? (value as BankStatementStatus) : "open";
}

function toLine(row: StatementRow["lines"][number]): BankStatementLine {
  return {
    id: row.id,
    date: dateToDay(row.date),
    description: row.description,
    reference: row.reference ?? undefined,
    amount: Number(row.amount),
    matchId: row.matchId ?? undefined,
  };
}

function toStatement(row: StatementRow): BankStatement {
  return {
    id: row.id,
    accountCode: row.accountCode,
    fromDay: dateToDay(row.fromDay),
    toDay: dateToDay(row.toDay),
    openingBalance: Number(row.openingBalance),
    closingBalance: Number(row.closingBalance),
    status: toStatus(row.status),
    lines: row.lines.map(toLine),
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
    reconciledByName: row.reconciledByName ?? undefined,
    reconciledAt: row.reconciledAt?.toISOString(),
  };
}
