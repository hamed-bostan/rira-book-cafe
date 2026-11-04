import { describe, expect, it, vi } from "vitest";

import { MAX_ORDER_AMOUNT } from "../../../entities/Order";
import {
  DEFAULT_PRICING_SETTINGS,
  MAX_MONTHLY_UNITS,
  MAX_RECIPE_LINES,
  type Ingredient,
  type PricedProduct,
  type PricingSettings,
} from "../../../entities/Pricing";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import {
  ApplySuggestedPrice,
  GetPricingReport,
  SaveIngredient,
  SaveRecipe,
  SetItemMarkup,
  UpdatePricingSettings,
} from "../PricingCommands";

import type { ILedgerRepository } from "../../../repositories/ILedgerRepository";
import type { IngredientInput, IngredientPatch, IPricingRepository } from "../../../repositories/IPricingRepository";

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
  const ingredient = (input: IngredientPatch): Ingredient => ({
    id: "i1",
    isActive: true,
    updatedAt: "",
    onHand: 0,
    averageCost: 0,
    hasHistory: false,
    purchaseUnits: [],
    ...input,
    name: input.name ?? "Milk",
    unit: input.unit ?? "ml",
    purchasePrice: input.purchasePrice ?? 0,
    purchaseQuantity: input.purchaseQuantity ?? 1,
    reorderLevel: input.reorderLevel ?? undefined,
    parLevel: input.parLevel ?? undefined,
    supplierId: input.supplierId ?? undefined,
  });
  const updateSettings = vi.fn<IPricingRepository["updateSettings"]>(async (next) => next);
  const setTargetMarkup = vi.fn<IPricingRepository["setTargetMarkup"]>(async () => {});
  const createIngredient = vi.fn<IPricingRepository["createIngredient"]>(async (input) => ingredient(input));
  const updateIngredient = vi.fn<IPricingRepository["updateIngredient"]>(async (_id, input) => ingredient(input));
  const saveRecipe = vi.fn<IPricingRepository["saveRecipe"]>(async (_id, lines) => lines);
  const applyPrice = vi.fn<IPricingRepository["applyPrice"]>(async (id, before, after) => ({
    id,
    name: "Latte",
    before,
    after,
  }));
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

const LATTE: PricedProduct = {
  id: "latte",
  name: "Latte",
  kind: "drink",
  price: 120_000,
  taxExempt: false,
  costPrice: 40_000,
};

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
    await expect(new ApplySuggestedPrice(pricing, quietLedger()).execute("cake", 1, ACTOR, NOW)).rejects.toThrow(
      NotFoundError,
    );
    expect(applyPrice).not.toHaveBeenCalled();
  });

  it("refuses an item with no cost, which has no suggestion", async () => {
    const { pricing, applyPrice } = pricingWith([{ ...LATTE, costPrice: undefined }]);
    await expect(
      new ApplySuggestedPrice(pricing, quietLedger()).execute("latte", 120_000, ACTOR, NOW),
    ).rejects.toMatchObject({ field: "price" });
    expect(applyPrice).not.toHaveBeenCalled();
  });

  it("refuses a suggestion past what a menu price can be", async () => {
    // A cost at the ceiling plus the default profit lands above it.
    const { pricing, applyPrice } = pricingWith([{ ...LATTE, costPrice: MAX_ORDER_AMOUNT }]);
    await expect(
      new ApplySuggestedPrice(pricing, quietLedger()).execute("latte", 120_000, ACTOR, NOW),
    ).rejects.toMatchObject({ name: "ValidationError", field: "price" });
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
    const next: PricingSettings = {
      ...DEFAULT_PRICING_SETTINGS,
      overheadSource: "manual",
      manualMonthlyOverhead: 0,
      overheadMonths: 12,
      defaultMarkupBps: 0,
    };
    expect(await new UpdatePricingSettings(pricing).execute(next, ACTOR)).toEqual(next);
    expect(updateSettings.mock.calls[0][0]).toEqual(next);
    const audit = updateSettings.mock.calls[0][1];
    expect(audit?.({ before: DEFAULT_PRICING_SETTINGS, after: next })).toMatchObject({
      action: "pricing.settingsChanged",
      entityType: "pricing",
    });
    expect(audit?.({ before: next, after: next })).toBeNull();
  });

  it.each<[Partial<PricingSettings>, string]>([
    [{ defaultMarkupBps: -1 }, "defaultMarkup"],
    [{ defaultMarkupBps: 100_001 }, "defaultMarkup"],
    [{ defaultMarkupBps: 1.5 }, "defaultMarkup"],
    [{ overheadMonths: 0 }, "overheadMonths"],
    [{ overheadMonths: 13 }, "overheadMonths"],
    [{ overheadSource: "manual", manualMonthlyOverhead: undefined }, "manualMonthlyOverhead"],
    [{ manualMonthlyOverhead: -1 }, "manualMonthlyOverhead"],
    [{ manualMonthlyOverhead: Number.MAX_SAFE_INTEGER + 2 }, "manualMonthlyOverhead"],
    [{ expectedMonthlyUnits: 0 }, "expectedMonthlyUnits"],
    [{ expectedMonthlyUnits: 1.5 }, "expectedMonthlyUnits"],
    [{ expectedMonthlyUnits: MAX_MONTHLY_UNITS + 1 }, "expectedMonthlyUnits"],
  ])("refuses %o", async (overrides, field) => {
    const { pricing, updateSettings } = pricingWith([]);
    await expect(
      new UpdatePricingSettings(pricing).execute({ ...DEFAULT_PRICING_SETTINGS, ...overrides }, ACTOR),
    ).rejects.toMatchObject({ field });
    expect(updateSettings).not.toHaveBeenCalled();
  });
});

describe("SetItemMarkup", () => {
  it("sets or clears an item's own target", async () => {
    const { pricing, setTargetMarkup } = pricingWith([]);
    await new SetItemMarkup(pricing).execute("latte", 5000, ACTOR);
    await new SetItemMarkup(pricing).execute("latte", null, ACTOR);
    expect(setTargetMarkup.mock.calls.map(([id, markup]) => [id, markup])).toEqual([
      ["latte", 5000],
      ["latte", null],
    ]);
  });

  it.each([-1, 100_001, 0.5])("refuses a markup of %s", async (markup) => {
    const { pricing, setTargetMarkup } = pricingWith([]);
    await expect(new SetItemMarkup(pricing).execute("latte", markup, ACTOR)).rejects.toThrow(ValidationError);
    expect(setTargetMarkup).not.toHaveBeenCalled();
  });
});

describe("SaveIngredient", () => {
  const MILK: IngredientInput = { name: "  Milk ", unit: "ml", purchasePrice: 60_000, purchaseQuantity: 1000 };

  it("trims the name on create and keeps the active flag on update", async () => {
    const { pricing, createIngredient, updateIngredient } = pricingWith([]);
    await new SaveIngredient(pricing).create(MILK, ACTOR);
    await new SaveIngredient(pricing).update("i1", { ...MILK, isActive: false }, ACTOR);
    expect(createIngredient.mock.calls[0][0]).toEqual({ ...MILK, name: "Milk", purchaseUnits: undefined });
    expect(updateIngredient.mock.calls[0][1]).toEqual({ ...MILK, name: "Milk", isActive: false });
  });

  it.each<[Partial<IngredientInput>, string]>([
    [{ name: "  " }, "name"],
    [{ unit: "kg" as IngredientInput["unit"] }, "unit"],
    [{ purchasePrice: -1 }, "purchasePrice"],
    [{ purchasePrice: 1.5 }, "purchasePrice"],
    [{ purchaseQuantity: 0 }, "purchaseQuantity"],
  ])("refuses %o", async (overrides, field) => {
    const { pricing, createIngredient } = pricingWith([]);
    await expect(async () =>
      new SaveIngredient(pricing).create({ ...MILK, ...overrides }, ACTOR),
    ).rejects.toMatchObject({
      field,
    });
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
    expect(await new SaveRecipe(pricing).execute("latte", lines, ACTOR)).toEqual(lines);
    expect(saveRecipe.mock.calls[0].slice(0, 2)).toEqual(["latte", lines]);
    // An empty recipe clears it.
    await new SaveRecipe(pricing).execute("latte", [], ACTOR);
    expect(saveRecipe.mock.calls[1].slice(0, 2)).toEqual(["latte", []]);
  });

  it("refuses a recipe with too many lines", async () => {
    const { pricing, saveRecipe } = pricingWith([]);
    const lines = Array.from({ length: MAX_RECIPE_LINES + 1 }, (_, i) => ({ ingredientId: `i${i}`, quantity: 1 }));
    await expect(new SaveRecipe(pricing).execute("latte", lines, ACTOR)).rejects.toThrow("too many lines");
    expect(saveRecipe).not.toHaveBeenCalled();
  });
});
