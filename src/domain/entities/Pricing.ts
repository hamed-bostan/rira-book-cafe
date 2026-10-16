import { vatIncluded } from "./Ledger";

import type { ProductKind } from "./Product";

/**
 * Menu pricing: what each item really costs to make and sell, and the price that
 * covers that plus the owner's chosen profit.
 *
 *   direct cost   — the item's ingredients (from its recipe), or its manual cost price;
 *   overhead      — the cafe's monthly running costs (rent, salaries, utilities, …)
 *                   spread evenly over the items it sells in a month;
 *   full cost     — direct cost + overhead per item;
 *   net price     — full cost × (1 + profit %), the owner's profit as a markup on full cost;
 *   menu price    — net price plus VAT for taxable items (menu prices include VAT),
 *                   rounded up to a tidy step.
 *
 * Everything here is pure; amounts are Toman.
 */

/** What an ingredient is measured in. Recipes use the same unit. */
export const INGREDIENT_UNITS = ["g", "ml", "piece"] as const;
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];

/**
 * Something that goes into menu items — beans, milk, tea, syrup, a cup and lid.
 * Priced as it's bought: `purchasePrice` Toman for `purchaseQuantity` units
 * (e.g. 1,200,000 for 1,000 g of beans).
 */
export type Ingredient = {
  id: string;
  name: string;
  unit: IngredientUnit;
  purchasePrice: number;
  purchaseQuantity: number;
  isActive: boolean;
  updatedAt: string;
};

/** One ingredient in an item's recipe, in the ingredient's unit (e.g. 18 g, 200 ml, 1 piece). */
export type RecipeLine = { ingredientId: string; quantity: number };

/** Longest recipe accepted. */
export const MAX_RECIPE_LINES = 30;

/** Where the monthly overhead figure comes from. */
export const OVERHEAD_SOURCES = ["ledger", "manual"] as const;
export type OverheadSource = (typeof OVERHEAD_SOURCES)[number];

export type PricingSettings = {
  /** Profit for items without their own target, as a markup on full cost (3000 = 30%). */
  defaultMarkupBps: number;
  /** Suggested prices round up to a multiple of this (Toman). */
  roundingStep: number;
  /** `ledger`: average of recorded operating expenses; `manual`: `manualMonthlyOverhead`. */
  overheadSource: OverheadSource;
  manualMonthlyOverhead?: number;
  /** Items expected to sell per month; when unset, the recent monthly average. */
  expectedMonthlyUnits?: number;
  /** How many complete months of history the averages use. */
  overheadMonths: number;
};

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  defaultMarkupBps: 3000,
  roundingStep: 5000,
  overheadSource: "ledger",
  overheadMonths: 3,
};

/** Markups are stored in basis points; 100% = 10000. Above 1000% is almost certainly a typo. */
export const MAX_MARKUP_BPS = 100_000;
export const MAX_OVERHEAD_MONTHS = 12;

/** Cost of one unit (g, ml, piece) of an ingredient, unrounded. */
export function ingredientUnitCost(ingredient: Pick<Ingredient, "purchasePrice" | "purchaseQuantity">): number {
  return ingredient.purchaseQuantity > 0 ? ingredient.purchasePrice / ingredient.purchaseQuantity : 0;
}

/**
 * What a recipe's ingredients cost, rounded to the Toman — or `null` when it uses
 * an ingredient that no longer exists (the cost would be silently understated).
 */
export function recipeCost(lines: readonly RecipeLine[], ingredients: ReadonlyMap<string, Pick<Ingredient, "purchasePrice" | "purchaseQuantity">>): number | null {
  let total = 0;
  for (const line of lines) {
    const ingredient = ingredients.get(line.ingredientId);
    if (!ingredient) return null;
    total += ingredientUnitCost(ingredient) * line.quantity;
  }
  return Math.round(total);
}

/** The month's running costs and how many items carry them. */
export type OverheadBasis = {
  source: OverheadSource;
  /** Monthly operating expenses; `null` when there's no history and no manual figure. */
  monthlyOverhead: number | null;
  /** Items sold per month; `null` when there's no history and no expected figure. */
  monthlyUnits: number | null;
  /** The span the averages were taken over (complete Persian months), when from history. */
  fromDay?: string;
  toDay?: string;
  months: number;
};

/** Overhead carried by each item sold, or `null` when either side is unknown. */
export function overheadPerUnit(basis: Pick<OverheadBasis, "monthlyOverhead" | "monthlyUnits">): number | null {
  if (basis.monthlyOverhead === null || !basis.monthlyUnits || basis.monthlyUnits <= 0) return null;
  return Math.round(basis.monthlyOverhead / basis.monthlyUnits);
}

export type PriceSuggestion = {
  fullCost: number;
  /** Price before VAT that earns the target profit. */
  netPrice: number;
  /** The suggested menu price: VAT added when taxable, rounded up to the step. */
  suggestedPrice: number;
};

/** The menu price that covers the full cost plus the markup, VAT-inclusive and rounded up. */
export function suggestPrice(input: {
  directCost: number;
  overheadPerUnit: number;
  markupBps: number;
  vatRateBps: number;
  taxExempt: boolean;
  roundingStep: number;
}): PriceSuggestion {
  const fullCost = input.directCost + input.overheadPerUnit;
  const netPrice = Math.round((fullCost * (10_000 + input.markupBps)) / 10_000);
  const gross = input.taxExempt ? netPrice : (netPrice * (10_000 + input.vatRateBps)) / 10_000;
  const step = Math.max(1, Math.round(input.roundingStep));
  return { fullCost, netPrice, suggestedPrice: Math.ceil(gross / step) * step };
}

/** What the item earns at its current menu price, against its full cost. */
export function currentPosition(input: { price: number; fullCost: number; vatRateBps: number; taxExempt: boolean }): {
  netPrice: number;
  profitPerUnit: number;
  /** Profit as a markup on full cost (0.3 = 30%); `null` when the cost is zero. */
  markupRate: number | null;
} {
  const netPrice = input.taxExempt ? input.price : input.price - vatIncluded(input.price, input.vatRateBps);
  const profitPerUnit = netPrice - input.fullCost;
  return { netPrice, profitPerUnit, markupRate: input.fullCost > 0 ? profitPerUnit / input.fullCost : null };
}

/** Where an item's direct cost came from. */
export type CostSource = "recipe" | "manual" | "none";

export type PricingRow = {
  productId: string;
  name: string;
  kind: ProductKind;
  price: number;
  taxExempt: boolean;
  costSource: CostSource;
  /** Ingredients (or manual cost); `null` when unknown — no suggestion is possible. */
  directCost: number | null;
  overheadPerUnit: number;
  fullCost: number | null;
  markupBps: number;
  /** True when the item uses the cafe-wide default profit. */
  markupIsDefault: boolean;
  suggestedPrice: number | null;
  /** At the current price; `null` without a known cost. */
  profitPerUnit: number | null;
  currentMarkupRate: number | null;
  /** Average sold per month over the basis span. */
  monthlyUnits: number;
};

export type PricingReport = {
  settings: PricingSettings;
  basis: OverheadBasis;
  /** `null` when the overhead couldn't be worked out — suggestions then cover direct cost only. */
  overheadPerUnit: number | null;
  vatRateBps: number;
  rows: PricingRow[];
};

export type PricedProduct = {
  id: string;
  name: string;
  kind: ProductKind;
  price: number;
  taxExempt: boolean;
  costPrice?: number;
  targetMarkupBps?: number;
};

/** One row per product: its costs, the suggested price, and how it does at today's price. */
export function buildPricingReport(input: {
  products: readonly PricedProduct[];
  recipes: ReadonlyMap<string, readonly RecipeLine[]>;
  ingredients: readonly Ingredient[];
  basis: OverheadBasis;
  settings: PricingSettings;
  vatRateBps: number;
  /** Units sold per product over the basis span. */
  unitsSold: ReadonlyMap<string, number>;
}): PricingReport {
  const ingredientsById = new Map(input.ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const perUnit = overheadPerUnit(input.basis);
  const months = Math.max(1, input.basis.months);

  const rows = input.products.map((product): PricingRow => {
    const lines = input.recipes.get(product.id);
    const fromRecipe = lines && lines.length > 0 ? recipeCost(lines, ingredientsById) : null;
    const costSource: CostSource = fromRecipe !== null ? "recipe" : product.costPrice !== undefined ? "manual" : "none";
    const directCost = fromRecipe ?? product.costPrice ?? null;
    const markupBps = product.targetMarkupBps ?? input.settings.defaultMarkupBps;
    const overhead = perUnit ?? 0;

    const suggestion =
      directCost === null
        ? null
        : suggestPrice({
            directCost,
            overheadPerUnit: overhead,
            markupBps,
            vatRateBps: input.vatRateBps,
            taxExempt: product.taxExempt,
            roundingStep: input.settings.roundingStep,
          });
    const position = suggestion
      ? currentPosition({ price: product.price, fullCost: suggestion.fullCost, vatRateBps: input.vatRateBps, taxExempt: product.taxExempt })
      : null;

    return {
      productId: product.id,
      name: product.name,
      kind: product.kind,
      price: product.price,
      taxExempt: product.taxExempt,
      costSource,
      directCost,
      overheadPerUnit: overhead,
      fullCost: suggestion?.fullCost ?? null,
      markupBps,
      markupIsDefault: product.targetMarkupBps === undefined,
      suggestedPrice: suggestion?.suggestedPrice ?? null,
      profitPerUnit: position?.profitPerUnit ?? null,
      currentMarkupRate: position?.markupRate ?? null,
      monthlyUnits: Math.round(((input.unitsSold.get(product.id) ?? 0) / months) * 10) / 10,
    };
  });

  return { settings: input.settings, basis: input.basis, overheadPerUnit: perUnit, vatRateBps: input.vatRateBps, rows };
}
