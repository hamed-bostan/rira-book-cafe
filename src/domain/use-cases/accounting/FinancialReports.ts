import {
  buildAccountLedger,
  buildBalanceSheet,
  buildMarginReport,
  buildProfitAndLoss,
  buildTrialBalance,
  MAX_PRINTED_ENTRIES,
  type AccountLedger,
  type BalanceSheet,
  type MarginReport,
  type PrintedJournal,
  type ProfitAndLoss,
  type TrialBalance,
  type VatReport,
} from "../../entities/AccountingReports";
import { shiftCafeDay } from "../../entities/CafeTime";
import { SYSTEM_ACCOUNTS, type JournalEntry } from "../../entities/Ledger";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { ILedgerRepository, JournalFilters } from "../../repositories/ILedgerRepository";

function assertSpan(fromDay: string, toDay: string): void {
  if (fromDay > toDay) throw new ValidationError("to", "The end date must be on or after the start date.");
}

/**
 * The financial statements, read from the ledger. Everything here is derived from
 * journal lines — there is no second copy of any total to drift from the books.
 */
export class FinancialReports {
  constructor(private readonly ledger: ILedgerRepository) {}

  /** Every account's balance as of a day (all entries on or before it). */
  async trialBalance(asOfDay: string): Promise<TrialBalance> {
    const [accounts, movements] = await Promise.all([
      this.ledger.listAccounts(),
      this.ledger.movements(undefined, asOfDay),
    ]);
    return buildTrialBalance(asOfDay, accounts, movements);
  }

  /** Revenue, cost of sales and expenses for entries dated within the span. */
  async profitAndLoss(fromDay: string, toDay: string): Promise<ProfitAndLoss> {
    assertSpan(fromDay, toDay);
    const [accounts, movements, revenueWithoutCost] = await Promise.all([
      this.ledger.listAccounts(),
      this.ledger.movements(fromDay, toDay, { excludeClosing: true }),
      this.ledger.revenueWithoutCost(fromDay, toDay),
    ]);
    return buildProfitAndLoss(fromDay, toDay, accounts, movements, revenueWithoutCost);
  }

  /** Assets, liabilities and equity as of a day. */
  async balanceSheet(asOfDay: string): Promise<BalanceSheet> {
    const [accounts, movements] = await Promise.all([
      this.ledger.listAccounts(),
      this.ledger.movements(undefined, asOfDay),
    ]);
    return buildBalanceSheet(asOfDay, accounts, movements);
  }

  /** VAT collected, VAT paid on expenses, and what was settled — the period's VAT return. */
  async vat(fromDay: string, toDay: string): Promise<VatReport> {
    assertSpan(fromDay, toDay);
    const [movement, closing] = await Promise.all([
      this.ledger.vatMovement(fromDay, toDay),
      this.ledger.movements(undefined, toDay),
    ]);
    const vat = closing.find((row) => row.accountCode === SYSTEM_ACCOUNTS.vatPayable);
    return {
      fromDay,
      toDay,
      outputVat: movement.output,
      inputVat: movement.input,
      settled: movement.settled,
      netForPeriod: movement.output - movement.input,
      closingBalance: vat ? vat.credit - vat.debit : 0,
    };
  }

  /** One account's lines within a span, with its opening balance and a running balance. */
  async accountLedger(code: string, fromDay: string, toDay: string): Promise<AccountLedger> {
    assertSpan(fromDay, toDay);
    const account = await this.ledger.getAccount(code);
    if (!account) throw new NotFoundError("account", code);
    const [before, lines] = await Promise.all([
      this.ledger.movements(undefined, shiftCafeDay(fromDay, -1)),
      this.ledger.accountLines(code, fromDay, toDay),
    ]);
    return buildAccountLedger(
      account,
      fromDay,
      toDay,
      before.find((row) => row.accountCode === code),
      lines,
    );
  }

  /** What each menu item earned net of VAT against what it cost, for sales booked in the span. */
  async margins(fromDay: string, toDay: string): Promise<MarginReport> {
    assertSpan(fromDay, toDay);
    const [items, settings] = await Promise.all([this.ledger.itemSalesCost(fromDay, toDay), this.ledger.getSettings()]);
    return buildMarginReport(fromDay, toDay, items, settings.vatRateBps);
  }

  /**
   * The journal for printing: every entry in the span, unlike the paged screen, up
   * to what's worth putting on paper. `total` says when that isn't all of them.
   */
  async printedJournal(
    fromDay: string,
    toDay: string,
    filters: Pick<JournalFilters, "source" | "accountCode"> = {},
  ): Promise<PrintedJournal> {
    assertSpan(fromDay, toDay);
    const inSpan = { ...filters, fromDay, toDay };
    const [{ total }, entries] = await Promise.all([
      this.ledger.listEntries(inSpan, { page: 1, pageSize: 1 }),
      this.firstEntries(inSpan),
    ]);
    return { fromDay, toDay, entries, total };
  }

  private async firstEntries(filters: JournalFilters): Promise<JournalEntry[]> {
    const entries: JournalEntry[] = [];
    for await (const batch of this.ledger.entryBatches(filters)) {
      entries.push(...batch);
      if (entries.length >= MAX_PRINTED_ENTRIES) break;
    }
    return entries.slice(0, MAX_PRINTED_ENTRIES);
  }
}
