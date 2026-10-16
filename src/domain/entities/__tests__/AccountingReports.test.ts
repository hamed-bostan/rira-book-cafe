import { describe, expect, it } from "vitest";

import {
  buildAccountLedger,
  buildBalanceSheet,
  buildMarginReport,
  buildProfitAndLoss,
  buildTrialBalance,
  type AccountMovement,
} from "../AccountingReports";

import type { Account, AccountType } from "../Ledger";

const account = (code: string, type: AccountType): Account => ({ code, name: code, nameFa: code, type, isSystem: true, isActive: true });

const ACCOUNTS: Account[] = [
  account("1110", "asset"),
  account("1120", "asset"),
  account("1200", "asset"),
  account("2100", "liability"),
  account("2200", "liability"),
  account("3100", "equity"),
  account("4100", "revenue"),
  account("4300", "revenue"),
  account("5100", "expense"),
  account("6100", "expense"),
];

// Capital 10,000,000 into the bank; a 1,100,000 sale paid in cash (100,000 VAT);
// 400,000 of stock sold; 2,000,000 rent owed; 3,000,000 of stock bought by bank.
const MOVEMENTS: AccountMovement[] = [
  { accountCode: "1110", debit: 1_100_000, credit: 0 },
  { accountCode: "1120", debit: 10_000_000, credit: 3_000_000 },
  { accountCode: "1200", debit: 3_000_000, credit: 400_000 },
  { accountCode: "2100", debit: 0, credit: 2_000_000 },
  { accountCode: "2200", debit: 0, credit: 100_000 },
  { accountCode: "3100", debit: 0, credit: 10_000_000 },
  { accountCode: "4100", debit: 0, credit: 1_000_000 },
  { accountCode: "5100", debit: 400_000, credit: 0 },
  { accountCode: "6100", debit: 2_000_000, credit: 0 },
];

describe("financial statements", () => {
  it("trial balance nets each account to one side and balances", () => {
    const tb = buildTrialBalance("2026-10-16", ACCOUNTS, MOVEMENTS);
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe(1_100_000 + 7_000_000 + 2_600_000 + 400_000 + 2_000_000);
    expect(tb.rows.map((row) => row.account.code)).not.toContain("4300");
  });

  it("profit and loss separates cost of sales from operating expenses", () => {
    const pl = buildProfitAndLoss("2026-09-23", "2026-10-22", ACCOUNTS, MOVEMENTS);
    expect(pl.revenue.total).toBe(1_000_000);
    expect(pl.costOfSales.total).toBe(400_000);
    expect(pl.grossProfit).toBe(600_000);
    expect(pl.expenses.total).toBe(2_000_000);
    expect(pl.netProfit).toBe(-1_400_000);
  });

  it("balance sheet balances once current earnings join equity", () => {
    const bs = buildBalanceSheet("2026-10-16", ACCOUNTS, MOVEMENTS);
    expect(bs.assets.total).toBe(10_700_000);
    expect(bs.liabilities.total).toBe(2_100_000);
    expect(bs.currentEarnings).toBe(-1_400_000);
    expect(bs.totalEquity).toBe(8_600_000);
    expect(bs.balanced).toBe(true);
  });

  it("account ledger carries an opening and a running balance", () => {
    const ledger = buildAccountLedger(account("1110", "asset"), "2026-10-01", "2026-10-31", { accountCode: "1110", debit: 500, credit: 0 }, [
      { entryId: "a", number: 1, date: "2026-10-02", description: "sale", source: "orderPayment", debit: 300, credit: 0 },
      { entryId: "b", number: 2, date: "2026-10-03", description: "rent", source: "expense", debit: 0, credit: 600 },
    ]);
    expect(ledger.lines.map((line) => line.runningBalance)).toEqual([800, 200]);
    expect(ledger.closingBalance).toBe(200);
  });

  it("margins are net of VAT, and items without a cost don't fake a margin", () => {
    const report = buildMarginReport(
      "2026-10-01",
      "2026-10-31",
      [
        { productId: "latte", name: "Latte", quantity: 10, gross: 1_100_000, taxableGross: 1_100_000, cost: 400_000, costKnown: true },
        { productId: "novel", name: "Novel", quantity: 1, gross: 330_000, taxableGross: 0, cost: 0, costKnown: false },
      ],
      1000,
    );
    expect(report.rows[0]).toMatchObject({ netRevenue: 1_000_000, grossProfit: 600_000, marginRate: 0.6 });
    expect(report.rows[1]).toMatchObject({ netRevenue: 330_000, marginRate: null });
    expect(report.totalGrossProfit).toBe(600_000);
    expect(report.revenueWithoutCost).toBe(330_000);
  });
});
