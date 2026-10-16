import { describe, expect, it } from "vitest";

import {
  buildPricingReport,
  currentPosition,
  DEFAULT_PRICING_SETTINGS,
  overheadPerUnit,
  recipeCost,
  suggestPrice,
  type Ingredient,
} from "../Pricing";

const ingredient = (id: string, purchasePrice: number, purchaseQuantity: number): Ingredient => ({
  id,
  name: id,
  unit: "g",
  purchasePrice,
  purchaseQuantity,
  isActive: true,
  updatedAt: "2026-10-16T00:00:00Z",
});

// Beans: 1,200,000 per kg → 1,200/g. Milk: 60,000 per litre → 60/ml. Cup: 5,000 each.
const INGREDIENTS = [ingredient("beans", 1_200_000, 1000), ingredient("milk", 60_000, 1000), ingredient("cup", 50_000, 10)];
const LATTE = [
  { ingredientId: "beans", quantity: 18 },
  { ingredientId: "milk", quantity: 200 },
  { ingredientId: "cup", quantity: 1 },
];

describe("pricing", () => {
  it("costs a recipe from purchase prices, and refuses a missing ingredient", () => {
    const byId = new Map(INGREDIENTS.map((item) => [item.id, item]));
    expect(recipeCost(LATTE, byId)).toBe(21_600 + 12_000 + 5_000);
    expect(recipeCost([{ ingredientId: "gone", quantity: 1 }], byId)).toBeNull();
  });

  it("spreads monthly overhead over the items sold", () => {
    expect(overheadPerUnit({ monthlyOverhead: 300_000_000, monthlyUnits: 6000 })).toBe(50_000);
    expect(overheadPerUnit({ monthlyOverhead: 300_000_000, monthlyUnits: 0 })).toBeNull();
    expect(overheadPerUnit({ monthlyOverhead: null, monthlyUnits: 10 })).toBeNull();
  });

  it("adds the markup to full cost, then VAT for taxable items, rounding up", () => {
    // Full cost 38,600 + 50,000 = 88,600; +30% = 115,180; +10% VAT = 126,698 → 130,000.
    expect(
      suggestPrice({ directCost: 38_600, overheadPerUnit: 50_000, markupBps: 3000, vatRateBps: 1000, taxExempt: false, roundingStep: 5000 }),
    ).toEqual({ fullCost: 88_600, netPrice: 115_180, suggestedPrice: 130_000 });
    // A VAT-exempt book: no VAT added.
    expect(
      suggestPrice({ directCost: 200_000, overheadPerUnit: 50_000, markupBps: 2000, vatRateBps: 1000, taxExempt: true, roundingStep: 5000 }).suggestedPrice,
    ).toBe(300_000);
  });

  it("reads profit at the current price net of VAT", () => {
    // 132,000 incl. 10% VAT → 120,000 net; full cost 100,000 → 20,000 profit, 20% markup.
    expect(currentPosition({ price: 132_000, fullCost: 100_000, vatRateBps: 1000, taxExempt: false })).toEqual({
      netPrice: 120_000,
      profitPerUnit: 20_000,
      markupRate: 0.2,
    });
  });

  it("prefers the recipe, falls back to the manual cost, and uses each item's own profit target", () => {
    const report = buildPricingReport({
      products: [
        { id: "latte", name: "Latte", kind: "drink", price: 120_000, taxExempt: false, costPrice: 99_999, targetMarkupBps: 5000 },
        { id: "cake", name: "Cake", kind: "food", price: 110_000, taxExempt: false, costPrice: 44_000 },
        { id: "mystery", name: "Mystery", kind: "food", price: 50_000, taxExempt: false },
      ],
      recipes: new Map([["latte", LATTE]]),
      ingredients: INGREDIENTS,
      basis: { source: "manual", monthlyOverhead: 300_000_000, monthlyUnits: 6000, months: 3 },
      settings: DEFAULT_PRICING_SETTINGS,
      vatRateBps: 1000,
      unitsSold: new Map([["latte", 900]]),
    });
    const [latte, cake, mystery] = report.rows;
    expect(latte).toMatchObject({ costSource: "recipe", directCost: 38_600, markupBps: 5000, markupIsDefault: false, monthlyUnits: 300 });
    expect(cake).toMatchObject({ costSource: "manual", directCost: 44_000, markupBps: 3000, markupIsDefault: true });
    expect(mystery).toMatchObject({ costSource: "none", suggestedPrice: null, profitPerUnit: null });
  });
});
