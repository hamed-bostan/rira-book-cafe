import { z } from "zod/mini";

import {
  INGREDIENT_UNITS,
  OVERHEAD_SOURCES,
  type Ingredient,
  type PricingReport,
  type PricingSettings,
  type RecipeLine,
} from "@/src/domain/entities/Pricing";
import { PRODUCT_KINDS } from "@/src/domain/entities/Product";

/** What the pricing endpoints return, checked at the BFF boundary. */

export const pricingSettingsResponseSchema: z.ZodMiniType<PricingSettings> = z.object({
  defaultMarkupBps: z.number(),
  roundingStep: z.number(),
  overheadSource: z.enum(OVERHEAD_SOURCES),
  manualMonthlyOverhead: z.optional(z.number()),
  expectedMonthlyUnits: z.optional(z.number()),
  overheadMonths: z.number(),
  monthlyInflationBps: z.number(),
  priceHorizonMonths: z.number(),
});

export const pricingReportResponseSchema: z.ZodMiniType<PricingReport> = z.object({
  settings: pricingSettingsResponseSchema,
  basis: z.object({
    source: z.enum(OVERHEAD_SOURCES),
    monthlyOverhead: z.nullable(z.number()),
    monthlyUnits: z.nullable(z.number()),
    fromDay: z.optional(z.string()),
    toDay: z.optional(z.string()),
    months: z.number(),
  }),
  overheadPerUnit: z.nullable(z.number()),
  inflation: z.object({
    monthlyInflationBps: z.number(),
    horizonMonths: z.number(),
    overheadCatchUp: z.number(),
    costFactor: z.number(),
  }),
  vatRateBps: z.number(),
  rows: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      kind: z.enum(PRODUCT_KINDS),
      price: z.number(),
      taxExempt: z.boolean(),
      costSource: z.enum(["recipe", "manual", "none"]),
      directCost: z.nullable(z.number()),
      overheadPerUnit: z.number(),
      fullCost: z.nullable(z.number()),
      markupBps: z.number(),
      markupIsDefault: z.boolean(),
      suggestedPriceToday: z.nullable(z.number()),
      suggestedPrice: z.nullable(z.number()),
      profitPerUnit: z.nullable(z.number()),
      currentMarkupRate: z.nullable(z.number()),
      monthlyUnits: z.number(),
    }),
  ),
});

export const ingredientResponseSchema: z.ZodMiniType<Ingredient> = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.enum(INGREDIENT_UNITS),
  purchasePrice: z.number(),
  purchaseQuantity: z.number(),
  isActive: z.boolean(),
  updatedAt: z.string(),
});
export const ingredientListResponseSchema = z.array(ingredientResponseSchema);

export const recipeResponseSchema: z.ZodMiniType<{ lines: RecipeLine[] }> = z.object({
  lines: z.array(z.object({ ingredientId: z.string(), quantity: z.number() })),
});

export const repricedResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  before: z.number(),
  after: z.number(),
});
