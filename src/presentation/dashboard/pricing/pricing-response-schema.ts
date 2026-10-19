import { z } from "zod";

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

export const pricingSettingsResponseSchema: z.ZodType<PricingSettings> = z.object({
  defaultMarkupBps: z.number(),
  roundingStep: z.number(),
  overheadSource: z.enum(OVERHEAD_SOURCES),
  manualMonthlyOverhead: z.number().optional(),
  expectedMonthlyUnits: z.number().optional(),
  overheadMonths: z.number(),
  monthlyInflationBps: z.number(),
  priceHorizonMonths: z.number(),
});

export const pricingReportResponseSchema: z.ZodType<PricingReport> = z.object({
  settings: pricingSettingsResponseSchema,
  basis: z.object({
    source: z.enum(OVERHEAD_SOURCES),
    monthlyOverhead: z.number().nullable(),
    monthlyUnits: z.number().nullable(),
    fromDay: z.string().optional(),
    toDay: z.string().optional(),
    months: z.number(),
  }),
  overheadPerUnit: z.number().nullable(),
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
      directCost: z.number().nullable(),
      overheadPerUnit: z.number(),
      fullCost: z.number().nullable(),
      markupBps: z.number(),
      markupIsDefault: z.boolean(),
      suggestedPriceToday: z.number().nullable(),
      suggestedPrice: z.number().nullable(),
      profitPerUnit: z.number().nullable(),
      currentMarkupRate: z.number().nullable(),
      monthlyUnits: z.number(),
    }),
  ),
});

export const ingredientResponseSchema: z.ZodType<Ingredient> = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.enum(INGREDIENT_UNITS),
  purchasePrice: z.number(),
  purchaseQuantity: z.number(),
  isActive: z.boolean(),
  updatedAt: z.string(),
});
export const ingredientListResponseSchema = z.array(ingredientResponseSchema);

export const recipeResponseSchema: z.ZodType<{ lines: RecipeLine[] }> = z.object({
  lines: z.array(z.object({ ingredientId: z.string(), quantity: z.number() })),
});

export const repricedResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  before: z.number(),
  after: z.number(),
});
