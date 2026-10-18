import { describe, expect, it, vi } from "vitest";

import { fiscalYearDays } from "../../../entities/JalaliCalendar";
import { SYSTEM_ACCOUNTS } from "../../../entities/Ledger";
import { ConflictError } from "../../../errors/ConflictError";
import { ValidationError } from "../../../errors/ValidationError";
import { CloseFiscalYear, ListFiscalYears } from "../FiscalYearClose";

import type { AccountMovement } from "../../../entities/AccountingReports";
import type { Account, JournalEntry } from "../../../entities/Ledger";
import type { Page } from "../../../entities/Pagination";
import type { ILedgerRepository } from "../../../repositories/ILedgerRepository";

const ACTOR = { id: "owner", name: "Rira" };
/** Mehr 1405 — fiscal year 1405 is under way, 1404 has ended. */
const NOW = new Date("2026-10-20T10:00:00Z");

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "e1",
    number: 1,
    date: "2024-06-01",
    description: "",
    source: "manual",
    lines: [],
    createdById: "owner",
    createdByName: "Rira",
    createdAt: "",
    ...overrides,
  };
}

function page(items: JournalEntry[]): Page<JournalEntry> {
  return { items, total: items.length, page: 1, pageSize: 100 };
}

describe("ListFiscalYears", () => {
  function setup(first: JournalEntry[], closes: JournalEntry[]): ILedgerRepository {
    const listEntries = vi.fn<ILedgerRepository["listEntries"]>(async (filters) =>
      page(filters.source === "yearClose" ? closes : first),
    );
    return { listEntries } as unknown as ILedgerRepository;
  }

  it("lists every year from the first posting to this one, newest first", async () => {
    const y1404 = fiscalYearDays(1404);
    const y1403 = fiscalYearDays(1403);
    const years = await new ListFiscalYears(
      setup(
        [entry({ date: "2024-06-01" })],
        [
          entry({ id: "c1", source: "yearClose", date: y1403.toDay }),
          // A reversed close doesn't count: that year is open again.
          entry({ id: "c2", source: "yearClose", date: y1404.toDay, reversedById: "r1" }),
        ],
      ),
    ).execute(NOW);

    expect(years.map((year) => year.year)).toEqual([1405, 1404, 1403]);
    expect(years[0]).toMatchObject({ year: 1405, ended: false, closed: false });
    expect(years[1]).toMatchObject({ year: 1404, ...y1404, ended: true, closed: false });
    expect(years[2]).toMatchObject({ year: 1403, ended: true, closed: true });
  });

  it("shows only the current year when nothing has been posted", async () => {
    const years = await new ListFiscalYears(setup([], [])).execute(NOW);
    expect(years).toHaveLength(1);
    expect(years[0].year).toBe(1405);
  });
});

describe("CloseFiscalYear", () => {
  const ACCOUNTS: Account[] = [
    { code: SYSTEM_ACCOUNTS.cash, name: "Cash", nameFa: "", type: "asset", isSystem: true, isActive: true },
    { code: SYSTEM_ACCOUNTS.salesDrinks, name: "Drinks", nameFa: "", type: "revenue", isSystem: true, isActive: true },
    { code: "6100", name: "Rent", nameFa: "", type: "expense", isSystem: false, isActive: true },
  ];

  type Setup = {
    useCase: CloseFiscalYear;
    closeYear: ReturnType<typeof vi.fn<ILedgerRepository["closeYear"]>>;
    movements: ReturnType<typeof vi.fn<ILedgerRepository["movements"]>>;
  };

  function setup(rows: AccountMovement[]): Setup {
    const closeYear = vi.fn<ILedgerRepository["closeYear"]>(async () => entry({ id: "close", source: "yearClose" }));
    const movements = vi.fn<ILedgerRepository["movements"]>(async () => rows);
    const ledger = { listAccounts: vi.fn(async () => ACCOUNTS), movements, closeYear } as unknown as ILedgerRepository;
    return { useCase: new CloseFiscalYear(ledger), closeYear, movements };
  }

  it("closes revenue and expenses into retained earnings and locks the books", async () => {
    const span = fiscalYearDays(1404);
    const { useCase, closeYear, movements } = setup([
      // Asset movements stay on the balance sheet.
      { accountCode: SYSTEM_ACCOUNTS.cash, debit: 5_000, credit: 0 },
      { accountCode: SYSTEM_ACCOUNTS.salesDrinks, debit: 0, credit: 1_000 },
      { accountCode: "6100", debit: 300, credit: 0 },
    ]);
    await useCase.execute(1404, ACTOR, NOW);

    expect(movements).toHaveBeenCalledWith(span.fromDay, span.toDay, { excludeClosing: true });
    const [closing, through, audit] = closeYear.mock.calls[0];
    expect(through).toBe(span.toDay);
    expect(closing).toMatchObject({
      date: span.toDay,
      source: "yearClose",
      uniqueKey: "yearClose:1404",
      createdById: "owner",
    });
    expect(closing.lines).toEqual([
      { accountCode: SYSTEM_ACCOUNTS.salesDrinks, debit: 1_000, credit: 0 },
      { accountCode: "6100", debit: 0, credit: 300 },
      { accountCode: SYSTEM_ACCOUNTS.retainedEarnings, debit: 0, credit: 700 },
    ]);
    expect(audit?.(entry({ id: "close" }))).toEqual({
      actorId: "owner",
      actorName: "Rira",
      action: "ledger.settingsChanged",
      entityType: "ledger",
      entityId: "close",
      entityLabel: "Fiscal year 1404",
      changes: [{ field: "booksClosedThrough", before: null, after: span.toDay }],
    });
  });

  it.each([1299, 1601, 1404.5])("refuses year %s", async (year) => {
    const { useCase, closeYear } = setup([]);
    await expect(useCase.execute(year, ACTOR, NOW)).rejects.toThrow(ValidationError);
    expect(closeYear).not.toHaveBeenCalled();
  });

  it("refuses a year that hasn't ended", async () => {
    const { useCase, movements } = setup([]);
    await expect(useCase.execute(1405, ACTOR, NOW)).rejects.toMatchObject({
      name: "ConflictError",
      code: "YEAR_NOT_ENDED",
    });
    await expect(useCase.execute(1405, ACTOR, NOW)).rejects.toThrow(ConflictError);
    expect(movements).not.toHaveBeenCalled();
  });

  it("refuses a year with nothing to close", async () => {
    const { useCase, closeYear } = setup([{ accountCode: SYSTEM_ACCOUNTS.cash, debit: 100, credit: 0 }]);
    await expect(useCase.execute(1404, ACTOR, NOW)).rejects.toMatchObject({ name: "ValidationError", field: "year" });
    expect(closeYear).not.toHaveBeenCalled();
  });
});
