import { Prisma } from "@prisma/client";

import {
  assertBalanced,
  DEFAULT_VAT_RATE_BPS,
  JOURNAL_SOURCES,
  UnbalancedEntryError,
  type AccountingSettings,
  type JournalEntry,
  type JournalSource,
  type NewJournalEntry,
} from "@/src/domain/entities/Ledger";
import { ConflictError } from "@/src/domain/errors/ConflictError";
import type { LedgerHook } from "@/src/domain/repositories/ILedgerRepository";

/**
 * The single write path into the general ledger. Every posting — from an order,
 * an expense, a manual entry or a reversal — goes through `postEntry`, inside the
 * caller's transaction, so the business change and its entries commit together.
 *
 * Checked here (and again by the database's triggers and constraints):
 *  - the entry balances, with positive whole-Toman lines;
 *  - its date isn't in a closed period;
 *  - every account exists and is active;
 *  - a unique posting (an order's sale) isn't booked twice.
 */

export const ENTRY_WITH_LINES = { lines: { orderBy: { position: "asc" } } } satisfies Prisma.JournalEntryInclude;
type EntryRow = Prisma.JournalEntryGetPayload<{ include: typeof ENTRY_WITH_LINES }>;

/** A cafe day (`YYYY-MM-DD`) as the `DATE` column value Prisma expects. */
export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** A `DATE` column value back to the cafe day. */
export function dateToDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function readSettings(tx: Prisma.TransactionClient): Promise<AccountingSettings> {
  const row = await tx.accountingSettings.findUnique({ where: { id: 1 } });
  return {
    vatRateBps: row?.vatRateBps ?? DEFAULT_VAT_RATE_BPS,
    booksClosedThrough: row?.booksClosedThrough ? dateToDay(row.booksClosedThrough) : undefined,
  };
}

export async function postEntry(
  tx: Prisma.TransactionClient,
  entry: NewJournalEntry,
  settings?: AccountingSettings,
): Promise<JournalEntry> {
  let balanced: NewJournalEntry;
  try {
    balanced = assertBalanced(entry);
  } catch (error) {
    if (error instanceof UnbalancedEntryError) throw new ConflictError("UNBALANCED", error.message, { cause: error });
    throw error;
  }

  const current = settings ?? (await readSettings(tx));
  // The year-end close is the one posting dated inside a period that may already be
  // closed month by month — it's what finishes the year.
  if (current.booksClosedThrough && balanced.date <= current.booksClosedThrough && balanced.source !== "yearClose") {
    throw new ConflictError(
      "PERIOD_CLOSED",
      `The books are closed through ${current.booksClosedThrough}; post in the open period.`,
    );
  }

  const codes = [...new Set(balanced.lines.map((line) => line.accountCode))];
  const accounts = await tx.ledgerAccount.findMany({ where: { code: { in: codes } } });
  for (const code of codes) {
    const account = accounts.find((a) => a.code === code);
    if (!account) throw new ConflictError("ACCOUNT_INACTIVE", `Account ${code} doesn't exist.`);
    if (!account.isActive) throw new ConflictError("ACCOUNT_INACTIVE", `Account ${code} is inactive.`);
  }

  try {
    const row = await tx.journalEntry.create({
      data: {
        date: dayToDate(balanced.date),
        description: balanced.description,
        source: balanced.source,
        sourceId: balanced.sourceId ?? null,
        uniqueKey: balanced.uniqueKey ?? null,
        reversesId: balanced.reversesId ?? null,
        createdById: balanced.createdById,
        createdByName: balanced.createdByName,
        lines: {
          create: balanced.lines.map((line, position) => ({
            accountCode: line.accountCode,
            debit: BigInt(line.debit),
            credit: BigInt(line.credit),
            memo: line.memo ?? null,
            position,
          })),
        },
      },
      include: ENTRY_WITH_LINES,
    });
    return toJournalEntry(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError(
        balanced.reversesId ? "ALREADY_REVERSED" : "ALREADY_POSTED",
        balanced.reversesId ? "That entry has already been reversed." : "That has already been posted.",
        { cause: error },
      );
    }
    throw error;
  }
}

/** Run a ledger hook against a result inside the transaction, posting what it returns. */
export async function postHook<T>(tx: Prisma.TransactionClient, result: T, hook?: LedgerHook<T>): Promise<void> {
  if (!hook) return;
  const settings = await readSettings(tx);
  for (const entry of hook(result, settings)) {
    await postEntry(tx, entry, settings);
  }
}

/** Reverse an entry inside the caller's transaction: post the reversal, then mark the original. */
export async function reverseEntry(
  tx: Prisma.TransactionClient,
  original: JournalEntry,
  build: (original: JournalEntry) => NewJournalEntry,
): Promise<JournalEntry> {
  if (original.reversedById) throw new ConflictError("ALREADY_REVERSED", "That entry has already been reversed.");
  if (original.reversesId) throw new ConflictError("NOT_REVERSIBLE", "A reversing entry can't itself be reversed.");
  const reversal = await postEntry(tx, build(original));
  // Guarded on still being unreversed: a concurrent reversal makes this match nothing.
  const marked = await tx.journalEntry.updateMany({
    where: { id: original.id, reversedById: null },
    data: { reversedById: reversal.id },
  });
  if (marked.count === 0) throw new ConflictError("ALREADY_REVERSED", "That entry has already been reversed.");
  return reversal;
}

function toSource(value: string): JournalSource {
  return (JOURNAL_SOURCES as readonly string[]).includes(value) ? (value as JournalSource) : "manual";
}

export function toJournalEntry(row: EntryRow): JournalEntry {
  return {
    id: row.id,
    number: row.number,
    date: dateToDay(row.date),
    description: row.description,
    source: toSource(row.source),
    sourceId: row.sourceId ?? undefined,
    reversesId: row.reversesId ?? undefined,
    reversedById: row.reversedById ?? undefined,
    createdById: row.createdById,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
    lines: row.lines.map((line) => ({
      accountCode: line.accountCode,
      debit: Number(line.debit),
      credit: Number(line.credit),
      memo: line.memo ?? undefined,
    })),
  };
}
