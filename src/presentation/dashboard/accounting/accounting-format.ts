import type { Account, JournalEntry } from "@/src/domain/entities/Ledger";
import type { Locale } from "@/src/i18n/routing";

/** A Persian year as written — digits in the locale's script, no thousands separator. */
export function formatYear(year: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", { useGrouping: false }).format(year);
}

/** The account's name in the reader's language. */
export function accountName(account: Pick<Account, "name" | "nameFa">, locale: Locale): string {
  return locale === "fa" ? account.nameFa : account.name;
}

/** "1110 · Cash" — how an account is named in tables and pickers. */
export function accountLabel(account: Pick<Account, "code" | "name" | "nameFa">, locale: Locale): string {
  return `${account.code} · ${accountName(account, locale)}`;
}

/** Where the document behind an automatic entry lives in the dashboard, if anywhere. */
export function sourceHref(entry: Pick<JournalEntry, "source" | "sourceId">): string | null {
  if (!entry.sourceId) return null;
  if (entry.source.startsWith("order")) return `/dashboard/orders/${entry.sourceId}`;
  if (entry.source.startsWith("expense")) return `/dashboard/expenses/${entry.sourceId}`;
  return null;
}

/** An entry's size: the sum of its debits (which equals the sum of its credits). */
export function entryTotal(entry: Pick<JournalEntry, "lines">): number {
  return entry.lines.reduce((sum, line) => sum + line.debit, 0);
}

/** The financial statements, by URL slug. */
export const STATEMENTS = ["profit-and-loss", "balance-sheet", "trial-balance", "vat", "margins"] as const;
export type StatementSlug = (typeof STATEMENTS)[number];

export function isStatementSlug(value: string): value is StatementSlug {
  return (STATEMENTS as readonly string[]).includes(value);
}
