import { describe, expect, it, vi } from "vitest";

import { SYSTEM_ACCOUNTS } from "../../../entities/Ledger";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { FinancialReports } from "../FinancialReports";

import type { AccountMovement } from "../../../entities/AccountingReports";
import type { Account } from "../../../entities/Ledger";
import type {
  ILedgerRepository,
  ItemSalesCost,
  RawLedgerLine,
  VatMovement,
} from "../../../repositories/ILedgerRepository";

function account(code: string, type: Account["type"], name = code): Account {
  return { code, name, nameFa: name, type, isSystem: false, isActive: true };
}

const ACCOUNTS: Account[] = [
  account(SYSTEM_ACCOUNTS.cash, "asset", "Cash"),
  account(SYSTEM_ACCOUNTS.vatPayable, "liability", "VAT"),
  account(SYSTEM_ACCOUNTS.ownerCapital, "equity", "Capital"),
  account(SYSTEM_ACCOUNTS.salesDrinks, "revenue", "Drinks"),
  account(SYSTEM_ACCOUNTS.costOfSales, "expense", "COGS"),
  account("6100", "expense", "Rent"),
];

const MOVEMENTS: AccountMovement[] = [
  { accountCode: SYSTEM_ACCOUNTS.cash, debit: 1_000, credit: 200 },
  { accountCode: SYSTEM_ACCOUNTS.vatPayable, debit: 10, credit: 100 },
  { accountCode: SYSTEM_ACCOUNTS.ownerCapital, debit: 0, credit: 310 },
  { accountCode: SYSTEM_ACCOUNTS.salesDrinks, debit: 0, credit: 1_000 },
  { accountCode: SYSTEM_ACCOUNTS.costOfSales, debit: 400, credit: 0 },
  { accountCode: "6100", debit: 200, credit: 0 },
];

type LedgerFake = {
  ledger: ILedgerRepository;
  movements: ReturnType<typeof vi.fn<ILedgerRepository["movements"]>>;
  accountLines: ReturnType<typeof vi.fn<ILedgerRepository["accountLines"]>>;
};

function ledgerWith(
  options: { vat?: VatMovement; lines?: RawLedgerLine[]; sales?: ItemSalesCost[]; movements?: AccountMovement[] } = {},
): LedgerFake {
  const movements = vi.fn<ILedgerRepository["movements"]>(async () => options.movements ?? MOVEMENTS);
  const accountLines = vi.fn<ILedgerRepository["accountLines"]>(async () => options.lines ?? []);
  const ledger = {
    listAccounts: vi.fn(async () => ACCOUNTS),
    getAccount: vi.fn(async (code: string) => ACCOUNTS.find((a) => a.code === code) ?? null),
    movements,
    accountLines,
    vatMovement: vi.fn(async () => options.vat ?? { output: 0, input: 0, settled: 0 }),
    itemSalesCost: vi.fn(async () => options.sales ?? []),
    getSettings: vi.fn(async () => ({ vatRateBps: 1000 })),
  } as unknown as ILedgerRepository;
  return { ledger, movements, accountLines };
}

describe("FinancialReports", () => {
  it("builds the trial balance from every entry up to the day", async () => {
    const { ledger, movements } = ledgerWith();
    const report = await new FinancialReports(ledger).trialBalance("2026-10-20");
    expect(movements).toHaveBeenCalledWith(undefined, "2026-10-20");
    expect(report.asOfDay).toBe("2026-10-20");
    expect(report.balanced).toBe(true);
    expect(report.totalDebit).toBe(1_400);
  });

  it("builds the P&L without year-end closing entries", async () => {
    const { ledger, movements } = ledgerWith();
    const pnl = await new FinancialReports(ledger).profitAndLoss("2026-10-01", "2026-10-31");
    expect(movements).toHaveBeenCalledWith("2026-10-01", "2026-10-31", { excludeClosing: true });
    expect(pnl).toMatchObject({ grossProfit: 600, netProfit: 400 });
  });

  it("builds the balance sheet with unclosed earnings in equity", async () => {
    const { ledger } = ledgerWith();
    const sheet = await new FinancialReports(ledger).balanceSheet("2026-10-20");
    expect(sheet.currentEarnings).toBe(400);
    expect(sheet.totalEquity).toBe(710);
  });

  it("reports VAT for the period and the closing payable balance", async () => {
    const { ledger, movements } = ledgerWith({ vat: { output: 100, input: 30, settled: 20 } });
    const vat = await new FinancialReports(ledger).vat("2026-10-01", "2026-10-31");
    expect(movements).toHaveBeenCalledWith(undefined, "2026-10-31");
    expect(vat).toEqual({
      fromDay: "2026-10-01",
      toDay: "2026-10-31",
      outputVat: 100,
      inputVat: 30,
      settled: 20,
      netForPeriod: 70,
      closingBalance: 90,
    });
  });

  it("reports a zero closing VAT balance when the account never moved", async () => {
    const { ledger } = ledgerWith({ movements: [] });
    expect((await new FinancialReports(ledger).vat("2026-10-01", "2026-10-31")).closingBalance).toBe(0);
  });

  it("opens an account's ledger with everything before the span", async () => {
    const lines: RawLedgerLine[] = [
      { entryId: "e1", number: 1, date: "2026-10-05", description: "Sale", source: "orderSale", debit: 50, credit: 0 },
    ];
    const { ledger, movements, accountLines } = ledgerWith({ lines });
    const result = await new FinancialReports(ledger).accountLedger(SYSTEM_ACCOUNTS.cash, "2026-10-01", "2026-10-31");
    expect(movements).toHaveBeenCalledWith(undefined, "2026-09-30");
    expect(accountLines).toHaveBeenCalledWith(SYSTEM_ACCOUNTS.cash, "2026-10-01", "2026-10-31");
    expect(result).toMatchObject({ openingBalance: 800, closingBalance: 850 });
    expect(result.lines[0].runningBalance).toBe(850);
  });

  it("is not found for an unknown account", async () => {
    const { ledger } = ledgerWith();
    await expect(new FinancialReports(ledger).accountLedger("9999", "2026-10-01", "2026-10-31")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("nets VAT out of item revenue in the margin report", async () => {
    const sales: ItemSalesCost[] = [
      { productId: "p1", name: "Latte", quantity: 2, gross: 110, taxableGross: 110, cost: 40, costKnown: true },
    ];
    const { ledger } = ledgerWith({ sales });
    const report = await new FinancialReports(ledger).margins("2026-10-01", "2026-10-31");
    expect(report.rows[0]).toMatchObject({ netRevenue: 100, cost: 40, grossProfit: 60 });
  });

  it.each<[string, (reports: FinancialReports) => Promise<unknown>]>([
    ["profitAndLoss", (reports) => reports.profitAndLoss("2026-10-31", "2026-10-01")],
    ["vat", (reports) => reports.vat("2026-10-31", "2026-10-01")],
    ["accountLedger", (reports) => reports.accountLedger(SYSTEM_ACCOUNTS.cash, "2026-10-31", "2026-10-01")],
    ["margins", (reports) => reports.margins("2026-10-31", "2026-10-01")],
  ])("%s refuses a span that ends before it starts", async (_name, run) => {
    const { ledger, movements } = ledgerWith();
    await expect(run(new FinancialReports(ledger))).rejects.toThrow(ValidationError);
    expect(movements).not.toHaveBeenCalled();
  });
});
