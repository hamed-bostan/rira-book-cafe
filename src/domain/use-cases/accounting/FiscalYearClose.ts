import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { cafeDayOf } from "../../entities/CafeTime";
import { fiscalYearDays, jalaliToday, toJalali } from "../../entities/JalaliCalendar";
import { yearCloseEntry } from "../../entities/Postings";
import { ConflictError } from "../../errors/ConflictError";
import { ValidationError } from "../../errors/ValidationError";

import type { JournalEntry } from "../../entities/Ledger";
import type { ILedgerRepository } from "../../repositories/ILedgerRepository";

export type FiscalYearStatus = { year: number; fromDay: string; toDay: string; ended: boolean; closed: boolean };

/**
 * Fiscal years from the first one with postings to the current one, and whether
 * each has been closed. Years are Persian (1 Farvardin – end of Esfand).
 */
export class ListFiscalYears {
  constructor(private readonly ledger: ILedgerRepository) {}

  async execute(now: Date = new Date()): Promise<FiscalYearStatus[]> {
    const [first, closes] = await Promise.all([
      this.ledger.listEntries({}, { page: 1, pageSize: 1, direction: "asc" }),
      this.ledger.listEntries({ source: "yearClose" }, { page: 1, pageSize: 100 }),
    ]);
    const today = cafeDayOf(now);
    const thisYear = jalaliToday(now).jy;
    const firstYear = first.items[0] ? toJalali(first.items[0].date).jy : thisYear;
    const closed = new Set(closes.items.filter((entry) => !entry.reversedById).map((entry) => toJalali(entry.date).jy));

    const years: FiscalYearStatus[] = [];
    for (let year = thisYear; year >= Math.min(firstYear, thisYear); year -= 1) {
      const span = fiscalYearDays(year);
      years.push({ year, ...span, ended: span.toDay < today, closed: closed.has(year) });
    }
    return years;
  }
}

/**
 * Close a finished fiscal year: revenue and expenses for the year are moved into
 * retained earnings by one closing entry dated the year's last day, and the books
 * are locked through that day — all in one transaction. Closing twice is refused.
 */
export class CloseFiscalYear {
  constructor(private readonly ledger: ILedgerRepository) {}

  async execute(year: number, actor: ActivityActor, now: Date = new Date()): Promise<JournalEntry> {
    if (!Number.isInteger(year) || year < 1300 || year > 1600) throw new ValidationError("year", "That isn't a fiscal year.");
    const span = fiscalYearDays(year);
    if (span.toDay >= cafeDayOf(now)) throw new ConflictError("YEAR_NOT_ENDED", `Fiscal year ${year} hasn't ended yet.`);

    const [accounts, movements] = await Promise.all([
      this.ledger.listAccounts(),
      this.ledger.movements(span.fromDay, span.toDay, { excludeClosing: true }),
    ]);
    const closing = new Set(accounts.filter((account) => account.type === "revenue" || account.type === "expense").map((account) => account.code));
    const entry = yearCloseEntry(
      {
        fiscalYear: year,
        toDay: span.toDay,
        movements: movements.filter((row) => closing.has(row.accountCode)).map((row) => ({ accountCode: row.accountCode, net: row.debit - row.credit })),
      },
      actor,
    );
    if (!entry) throw new ValidationError("year", `Nothing was posted in ${year} to close.`);

    return this.ledger.closeYear(entry, span.toDay, (posted) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "ledger.settingsChanged",
      entityType: "ledger",
      entityId: posted.id,
      entityLabel: `Fiscal year ${year}`,
      changes: singleChange("booksClosedThrough", null, span.toDay),
    }));
  }
}
