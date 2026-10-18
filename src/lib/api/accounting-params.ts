import { z } from "zod";

import { cafeDayOf, isCafeDay } from "@/src/domain/entities/CafeTime";
import { EXPENSE_STATUSES, type ExpenseStatus } from "@/src/domain/entities/Expense";
import { jalaliMonthDays, jalaliToday } from "@/src/domain/entities/JalaliCalendar";
import { JOURNAL_SOURCES, type JournalSource } from "@/src/domain/entities/Ledger";
import type { ExpenseFilters } from "@/src/domain/repositories/IExpenseRepository";
import type { JournalFilters } from "@/src/domain/repositories/ILedgerRepository";

/**
 * The wire contract for the accounting screens' query params, shared by the routes
 * and the screens that build their URLs. Spans are cafe days, both inclusive.
 */

export type DaySpan = { fromDay: string; toDay: string };

/** The current Persian month — the default span for statements. */
export function currentJalaliMonth(now: Date = new Date()): DaySpan {
  const today = jalaliToday(now);
  return jalaliMonthDays(today.jy, today.jm);
}

const spanSchema = z
  .object({
    from: z.string().refine(isCafeDay, "Expected YYYY-MM-DD.").optional(),
    to: z.string().refine(isCafeDay, "Expected YYYY-MM-DD.").optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "`to` must be on or after `from`.",
    path: ["to"],
  });

/** `?from=&to=` as a span; either missing falls back to the current Persian month's bound. Malformed → `ZodError` (400). */
export function parseDaySpan(params: URLSearchParams, now: Date = new Date()): DaySpan {
  const query = spanSchema.parse({ from: params.get("from") ?? undefined, to: params.get("to") ?? undefined });
  const month = currentJalaliMonth(now);
  const span = { fromDay: query.from ?? month.fromDay, toDay: query.to ?? month.toDay };
  if (span.fromDay > span.toDay)
    throw new z.ZodError([{ code: "custom", path: ["to"], message: "`to` must be on or after `from`." }]);
  return span;
}

/** `?asOf=` for point-in-time statements; today when absent. */
export function parseAsOfDay(params: URLSearchParams, now: Date = new Date()): string {
  return z
    .string()
    .refine(isCafeDay, "Expected YYYY-MM-DD.")
    .parse(params.get("asOf") ?? cafeDayOf(now));
}

const SOURCE_SET = new Set<string>(JOURNAL_SOURCES);
const STATUS_SET = new Set<string>(EXPENSE_STATUSES);

/** Journal list filters. Unknown values are dropped (a stale URL lands on an unfiltered list). */
export function parseJournalFilters(params: URLSearchParams): JournalFilters {
  const filters: JournalFilters = {};
  const from = params.get("from");
  if (from && isCafeDay(from)) filters.fromDay = from;
  const to = params.get("to");
  if (to && isCafeDay(to)) filters.toDay = to;
  const source = params.get("source");
  if (source && SOURCE_SET.has(source)) filters.source = source as JournalSource;
  const account = params.get("account")?.trim();
  if (account && /^\d{4}$/.test(account)) filters.accountCode = account;
  return filters;
}

export function buildJournalParams(filters: JournalFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.fromDay) params.set("from", filters.fromDay);
  if (filters.toDay) params.set("to", filters.toDay);
  if (filters.source) params.set("source", filters.source);
  if (filters.accountCode) params.set("account", filters.accountCode);
  return params;
}

/** Expense list filters, same rules. */
export function parseExpenseFilters(params: URLSearchParams): ExpenseFilters {
  const filters: ExpenseFilters = {};
  const from = params.get("from");
  if (from && isCafeDay(from)) filters.fromDay = from;
  const to = params.get("to");
  if (to && isCafeDay(to)) filters.toDay = to;
  const status = params.get("status");
  if (status && STATUS_SET.has(status)) filters.status = status as ExpenseStatus;
  const supplier = params.get("supplier")?.trim();
  if (supplier) filters.supplierId = supplier;
  const account = params.get("account")?.trim();
  if (account && /^\d{4}$/.test(account)) filters.accountCode = account;
  return filters;
}

export function buildExpenseParams(filters: ExpenseFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.fromDay) params.set("from", filters.fromDay);
  if (filters.toDay) params.set("to", filters.toDay);
  if (filters.status) params.set("status", filters.status);
  if (filters.supplierId) params.set("supplier", filters.supplierId);
  if (filters.accountCode) params.set("account", filters.accountCode);
  return params;
}
