import { z } from "zod";

import {
  INGREDIENT_UNITS,
  MAX_MARKUP_BPS,
  MAX_MONTHLY_INFLATION_BPS,
  MAX_OVERHEAD_MONTHS,
  MAX_PRICE_HORIZON_MONTHS,
  MAX_RECIPE_LINES,
  OVERHEAD_SOURCES,
} from "@/src/domain/entities/Pricing";

import { moneyField } from "./money-fields";

/** A positive quantity as typed: "18", "0.5", "1000". */
const quantityField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,3})?$/, "quantityInvalid")
  .transform(Number)
  .refine((n) => n > 0 && n <= 1_000_000, "quantityInvalid");

/** A profit percentage as typed ("30", "12.5"), in basis points. */
const percentField = z
  .string()
  .trim()
  .regex(/^\d{1,4}(\.\d{1,2})?$/, "markupInvalid")
  .transform((value) => Math.round(Number(value) * 100))
  .refine((bps) => bps <= MAX_MARKUP_BPS, "markupInvalid");

const optionalWholeNumber = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d+$/.test(value), "numberInvalid")
  .transform((value) => (value === "" ? undefined : Number(value)));

/** An ingredient as bought: e.g. 1,200,000 Toman for 1000 g. */
export const ingredientSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(80, "textTooLong"),
  unit: z.enum(INGREDIENT_UNITS, { message: "unitInvalid" }),
  purchasePrice: moneyField,
  purchaseQuantity: quantityField,
  isActive: z.boolean(),
});

export type IngredientFormInput = z.input<typeof ingredientSchema>;

/** An item's recipe: ingredients and how much of each goes into one serving. */
export const recipeSchema = z.object({
  lines: z
    .array(z.object({ ingredientId: z.string().trim().min(1, "ingredientRequired"), quantity: quantityField }))
    .max(MAX_RECIPE_LINES, "linesTooMany")
    .refine((lines) => new Set(lines.map((line) => line.ingredientId)).size === lines.length, "ingredientRepeated"),
});

export type RecipeFormInput = z.input<typeof recipeSchema>;

/** The advisor's settings as the form types them. */
export const pricingSettingsSchema = z
  .object({
    defaultMarkup: percentField,
    roundingStep: z
      .string()
      .trim()
      .regex(/^\d+$/, "numberInvalid")
      .transform(Number)
      .refine((n) => n >= 1 && n <= 1_000_000, "numberInvalid"),
    overheadSource: z.enum(OVERHEAD_SOURCES, { message: "overheadSourceInvalid" }),
    manualMonthlyOverhead: optionalWholeNumber,
    expectedMonthlyUnits: optionalWholeNumber.refine((n) => n === undefined || n > 0, "numberInvalid"),
    overheadMonths: z
      .string()
      .trim()
      .regex(/^\d+$/, "numberInvalid")
      .transform(Number)
      .refine((n) => n >= 1 && n <= MAX_OVERHEAD_MONTHS, "numberInvalid"),
    /** Expected monthly rise in costs as typed ("3", "4.5"), in basis points; blank is no inflation. */
    monthlyInflation: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d{1,2}(\.\d{1,2})?$/.test(value), "inflationInvalid")
      .transform((value) => (value === "" ? 0 : Math.round(Number(value) * 100)))
      .refine((bps) => bps <= MAX_MONTHLY_INFLATION_BPS, "inflationInvalid"),
    priceHorizonMonths: z
      .string()
      .trim()
      .regex(/^\d+$/, "numberInvalid")
      .transform(Number)
      .refine((n) => n >= 1 && n <= MAX_PRICE_HORIZON_MONTHS, "numberInvalid"),
  })
  .refine((value) => value.overheadSource !== "manual" || value.manualMonthlyOverhead !== undefined, {
    path: ["manualMonthlyOverhead"],
    message: "overheadRequired",
  });

export type PricingSettingsInput = z.input<typeof pricingSettingsSchema>;

/** One item's own profit target; blank clears it (back to the default). */
export const itemMarkupSchema = z.object({
  markup: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .pipe(percentField.nullable()),
});

export type ItemMarkupInput = z.input<typeof itemMarkupSchema>;

/** Apply the suggestion; `expectedPrice` is the price the owner saw, so a concurrent edit isn't overwritten. */
export const applyPriceSchema = z.object({ expectedPrice: z.number().int().nonnegative() });
