import { describe, expect, it, vi } from "vitest";

import { DEFAULT_PRICING_SETTINGS, MAX_RECIPE_LINES, type Ingredient, type PricedProduct, type PricingSettings } from "../../../entities/Pricing";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { ApplySuggestedPrice, GetPricingReport, SaveIngredient, SaveRecipe, SetItemMarkup, UpdatePricingSettings } from "../PricingCommands";

import type { ILedgerRepository } from "../../../repositories/ILedgerRepository";
import type { IngredientInput, IPricingRepository } from "../../../repositories/IPricingRepository";

const NOW = new Date("2026-10-16T08:00:00Z");
const ACTOR = { id: "owner", name: "Rira" };

type Fake = {
  pricing: IPricingRepository;
  updateSettings: ReturnType<typeof vi.fn<IPricingRepository["updateSettings"]>>;
  setTargetMarkup: ReturnType<typeof vi.fn<IPricingRepository["setTargetMarkup"]>>;
  createIngredient: ReturnType<typeof vi.fn<IPricingRepository["createIngredient"]>>;
  updateIngredient: ReturnType<typeof vi.fn<IPricingRepository["updateIngredient"]>>;
  saveRecipe: ReturnType<typeof vi.fn<IPricingRepository["saveRecipe"]>>;
  applyPrice: ReturnType<typeof vi.fn<IPricingRepository["applyPrice"]>>;
};

function pricingWith(products: PricedProduct[], settings: PricingSettings = DEFAULT_PRICING_SETTINGS): Fake {
  const ingredient = (input: IngredientInput & { isActive?: boolean }): Ingredient => ({ id: "i1", isActive: true, updatedAt: "", ...input });
  const updateSettings = vi.fn<IPricingRepository["updateSettings"]>(async (next) => next);
  const setTargetMarkup = vi.fn<IPricingRepository["setTargetMarkup"]>(async () => {});
  const createIngredient = vi.fn<IPricingRepository["createIngredient"]>(async (input) => ingredient(input));
  const updateIngredient = vi.fn<IPricingRepository["updateIngredient"]>(async (_id, input) => ingredient(input));
  const saveRecipe = vi.fn<IPricingRepository["saveRecipe"]>(async (_id, lines) => lines);
  const applyPrice = vi.fn<IPricingRepository["applyPrice"]>(async (id, before, after) => ({ id, name: "Latte", before, after }));
  const pricing = {
    getSettings: vi.fn(async () => settings),
    listPricedProducts: vi.fn(async () => products),
    listRecipes: vi.fn(async () => new Map()),
    listIngredients: vi.fn(async () => []),
    updateSettings,
    setTargetMarkup,
    createIngredient,
    updateIngredient,
    saveRecipe,
    applyPrice,
  } as unknown as IPricingRepository;
  return { pricing, updateSettings, setTargetMarkup, createIngredient, updateIngredient, saveRecipe, applyPrice };
}

/** A ledger with no operating costs and no sales over the span. */
function quietLedger(): ILedgerRepository {
  return {
    getSettings: vi.fn(async () => ({ vatRateBps: 1000 })),
    listAccounts: vi.fn(async () => []),
    movements: vi.fn(async () => []),
    itemSalesCost: vi.fn(async () => []),
  } as unknown as ILedgerRepository;
}

const LATTE: PricedProduct = { id: "latte", name: "Latte", kind: "drink", price: 120_000, taxExempt: false, costPrice: 40_000 };

describe("GetPricingReport with no history", () => {
  it("has no overhead or units to spread when the books are empty", async () => {
    const { pricing } = pricingWith([LATTE]);
    const report = await new GetPricingReport(pricing, quietLedger()).execute(NOW);
    expect(report.basis).toMatchObject({ source: "ledger", monthlyOverhead: null, monthlyUnits: null, months: 3 });
    expect(report.overheadPerUnit).toBeNull();
  });
});

describe("ApplySuggestedPrice", () => {
  it("is not found for an item that isn't on the report", async () => {
    const { pricing, applyPrice } = pricingWith([LATTE]);
    await expect(new ApplySuggestedPrice(pricing, quietLedger()).execute("cake", 1, ACTOR, NOW)).rejects.toThrow(NotFoundError);
    expect(applyPrice).not.toHaveBeenCalled();
  });

  it("refuses an item with no cost, which has no suggestion", async () => {
    const { pricing, applyPrice } = pricingWith([{ ...LATTE, costPrice: undefined }]);
    await expect(new ApplySuggestedPrice(pricing, quietLedger()).execute("latte", 120_000, ACTOR, NOW)).rejects.toMatchObject({ field: "price" });
    expect(applyPrice).not.toHaveBeenCalled();
  });

  it("audits the price move with both sides", async () => {
    const { pricing, applyPrice } = pricingWith([LATTE]);
    await new ApplySuggestedPrice(pricing, quietLedger()).execute("latte", 120_000, ACTOR, NOW);
    const audit = applyPrice.mock.calls[0][3];
    expect(audit?.({ id: "latte", name: "Latte", before: 120_000, after: 60_000 })).toEqual({
      actorId: "owner",
      actorName: "Rira",
      action: "product.updated",
      entityType: "product",
      entityId: "latte",
      entityLabel: "Latte",
      changes: [{ field: "price", before: "120000", after: "60000" }],
    });
  });
});

describe("UpdatePricingSettings", () => {
  it("saves valid settings", async () => {
    const { pricing, updateSettings } = pricingWith([]);
    const next: PricingSettings = { ...DEFAULT_PRICING_SETTINGS, overheadSource: "manual", manualMonthlyOverhead: 0, overheadMonths: 12, defaultMarkupBps: 0 };
    expect(await new UpdatePricingSettings(pricing).execute(next)).toEqual(next);
    expect(updateSettings).toHaveBeenCalledWith(next);
  });

  it.each<[Partial<PricingSettings>, string]>([
    [{ defaultMarkupBps: -1 }, "defaultMarkup"],
    [{ defaultMarkupBps: 100_001 }, "defaultMarkup"],
    [{ defaultMarkupBps: 1.5 }, "defaultMarkup"],
    [{ overheadMonths: 0 }, "overheadMonths"],
    [{ overheadMonths: 13 }, "overheadMonths"],
    [{ overheadSource: "manual", manualMonthlyOverhead: undefined }, "manualMonthlyOverhead"],
  ])("refuses %o", async (overrides, field) => {
    const { pricing, updateSettings } = pricingWith([]);
    await expect(new UpdatePricingSettings(pricing).execute({ ...DEFAULT_PRICING_SETTINGS, ...overrides })).rejects.toMatchObject({ field });
    expect(updateSettings).not.toHaveBeenCalled();
  });
});

describe("SetItemMarkup", () => {
  it("sets or clears an item's own target", async () => {
    const { pricing, setTargetMarkup } = pricingWith([]);
    await new SetItemMarkup(pricing).execute("latte", 5000);
    await new SetItemMarkup(pricing).execute("latte", null);
    expect(setTargetMarkup.mock.calls).toEqual([
      ["latte", 5000],
      ["latte", null],
    ]);
  });

  it.each([-1, 100_001, 0.5])("refuses a markup of %s", async (markup) => {
    const { pricing, setTargetMarkup } = pricingWith([]);
    await expect(new SetItemMarkup(pricing).execute("latte", markup)).rejects.toThrow(ValidationError);
    expect(setTargetMarkup).not.toHaveBeenCalled();
  });
});

describe("SaveIngredient", () => {
  const MILK: IngredientInput = { name: "  Milk ", unit: "ml", purchasePrice: 60_000, purchaseQuantity: 1000 };

  it("trims the name on create and keeps the active flag on update", async () => {
    const { pricing, createIngredient, updateIngredient } = pricingWith([]);
    await new SaveIngredient(pricing).create(MILK);
    await new SaveIngredient(pricing).update("i1", { ...MILK, isActive: false });
    expect(createIngredient).toHaveBeenCalledWith({ ...MILK, name: "Milk" });
    expect(updateIngredient).toHaveBeenCalledWith("i1", { ...MILK, name: "Milk", isActive: false });
  });

  it.each<[Partial<IngredientInput>, string]>([
    [{ name: "  " }, "name"],
    [{ unit: "kg" as IngredientInput["unit"] }, "unit"],
    [{ purchasePrice: -1 }, "purchasePrice"],
    [{ purchasePrice: 1.5 }, "purchasePrice"],
    [{ purchaseQuantity: 0 }, "purchaseQuantity"],
  ])("refuses %o", async (overrides, field) => {
    const { pricing, createIngredient } = pricingWith([]);
    await expect(async () => new SaveIngredient(pricing).create({ ...MILK, ...overrides })).rejects.toMatchObject({ field });
    expect(createIngredient).not.toHaveBeenCalled();
  });
});

describe("SaveRecipe", () => {
  it("saves a recipe whose lines are each used once", async () => {
    const { pricing, saveRecipe } = pricingWith([]);
    const lines = [
      { ingredientId: "milk", quantity: 200 },
      { ingredientId: "beans", quantity: 18 },
    ];
    expect(await new SaveRecipe(pricing).execute("latte", lines)).toEqual(lines);
    expect(saveRecipe).toHaveBeenCalledWith("latte", lines);
    // An empty recipe clears it.
    await new SaveRecipe(pricing).execute("latte", []);
    expect(saveRecipe).toHaveBeenLastCalledWith("latte", []);
  });

  it("refuses a recipe with too many lines", async () => {
    const { pricing, saveRecipe } = pricingWith([]);
    const lines = Array.from({ length: MAX_RECIPE_LINES + 1 }, (_, i) => ({ ingredientId: `i${i}`, quantity: 1 }));
    await expect(new SaveRecipe(pricing).execute("latte", lines)).rejects.toThrow("too many lines");
    expect(saveRecipe).not.toHaveBeenCalled();
  });
});
