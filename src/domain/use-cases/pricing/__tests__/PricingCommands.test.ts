import { describe, expect, it, vi } from "vitest";

import { DEFAULT_PRICING_SETTINGS, type PricingSettings } from "../../../entities/Pricing";
import { ValidationError } from "../../../errors/ValidationError";
import { ApplySuggestedPrice, GetPricingReport, SaveRecipe } from "../PricingCommands";

import type { Account } from "../../../entities/Ledger";
import type { ILedgerRepository } from "../../../repositories/ILedgerRepository";
import type { IPricingRepository } from "../../../repositories/IPricingRepository";

// 2026-10-16 is 24 Mehr 1405: the last three complete months are Tir–Shahrivar.
const NOW = new Date("2026-10-16T08:00:00Z");
const account = (code: string, type: Account["type"]): Account => ({
  code,
  name: code,
  nameFa: code,
  type,
  isSystem: true,
  isActive: true,
});

function setup(settings: PricingSettings = DEFAULT_PRICING_SETTINGS) {
  const applyPrice = vi.fn(async (id: string, before: number, after: number, _audit?: unknown) => ({
    id,
    name: "Latte",
    before,
    after,
  }));
  const pricing = {
    getSettings: vi.fn(async () => settings),
    listPricedProducts: vi.fn(async () => [
      { id: "latte", name: "Latte", kind: "drink" as const, price: 120_000, taxExempt: false, costPrice: 40_000 },
    ]),
    listRecipes: vi.fn(async () => new Map()),
    listIngredients: vi.fn(async () => []),
    applyPrice,
    saveRecipe: vi.fn(async (_id: string, lines: unknown) => lines),
  } as unknown as IPricingRepository;
  const movements = vi.fn(async () => [
    { accountCode: "6100", debit: 300_000_000, credit: 0 }, // rent, 3 months
    { accountCode: "6200", debit: 600_000_000, credit: 0 }, // salaries
    { accountCode: "5100", debit: 999_000_000, credit: 0 }, // cost of sales — not overhead
    { accountCode: "4100", debit: 0, credit: 2_000_000_000 },
  ]);
  const ledger = {
    getSettings: vi.fn(async () => ({ vatRateBps: 1000 })),
    listAccounts: vi.fn(async () => [
      account("6100", "expense"),
      account("6200", "expense"),
      account("5100", "expense"),
      account("4100", "revenue"),
    ]),
    movements,
    itemSalesCost: vi.fn(async () => [
      { productId: "latte", name: "Latte", quantity: 18_000, gross: 0, taxableGross: 0, cost: 0, costKnown: true },
    ]),
  } as unknown as ILedgerRepository;
  return { pricing, ledger, movements, applyPrice };
}

describe("GetPricingReport", () => {
  it("averages operating expenses (not cost of sales) over the last complete months", async () => {
    const { pricing, ledger, movements } = setup();
    const report = await new GetPricingReport(pricing, ledger).execute(NOW);
    expect(movements).toHaveBeenCalledWith("2026-06-22", "2026-09-22", { excludeClosing: true });
    expect(report.basis).toMatchObject({ source: "ledger", monthlyOverhead: 300_000_000, monthlyUnits: 6000 });
    expect(report.overheadPerUnit).toBe(50_000);
    // (40,000 + 50,000) × 1.3 = 117,000; + 10% VAT = 128,700 → 130,000.
    expect(report.rows[0]).toMatchObject({ fullCost: 90_000, suggestedPrice: 130_000, monthlyUnits: 6000 });
  });

  it("uses the planned figures when the owner sets them", async () => {
    const { pricing, ledger } = setup({
      ...DEFAULT_PRICING_SETTINGS,
      overheadSource: "manual",
      manualMonthlyOverhead: 100_000_000,
      expectedMonthlyUnits: 4000,
    });
    const report = await new GetPricingReport(pricing, ledger).execute(NOW);
    expect(report.overheadPerUnit).toBe(25_000);
  });
});

describe("ApplySuggestedPrice", () => {
  it("applies the server's own suggestion, guarded on the price the owner saw", async () => {
    const { pricing, ledger, applyPrice } = setup();
    await new ApplySuggestedPrice(pricing, ledger).execute("latte", 120_000, { id: "owner", name: "Rira" }, NOW);
    expect(applyPrice).toHaveBeenCalledWith("latte", 120_000, 130_000, expect.any(Function));
    const audit = applyPrice.mock.calls[0][3] as (r: {
      id: string;
      name: string;
      before: number;
      after: number;
    }) => unknown;
    expect(audit({ id: "latte", name: "Latte", before: 120_000, after: 130_000 })).toMatchObject({
      action: "product.updated",
      entityLabel: "Latte",
    });
  });
});

describe("SaveRecipe", () => {
  it("refuses a repeated ingredient or a zero quantity", async () => {
    const { pricing } = setup();
    await expect(
      new SaveRecipe(pricing).execute("latte", [
        { ingredientId: "milk", quantity: 100 },
        { ingredientId: "milk", quantity: 50 },
      ]),
    ).rejects.toThrow(ValidationError);
    await expect(new SaveRecipe(pricing).execute("latte", [{ ingredientId: "milk", quantity: 0 }])).rejects.toThrow(
      ValidationError,
    );
  });
});
