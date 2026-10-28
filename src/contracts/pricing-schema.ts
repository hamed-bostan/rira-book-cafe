import {
  INGREDIENT_UNITS,
  MAX_MARKUP_BPS,
  MAX_MONTHLY_INFLATION_BPS,
  MAX_OVERHEAD_MONTHS,
  MAX_PRICE_HORIZON_MONTHS,
  MAX_RECIPE_LINES,
  OVERHEAD_SOURCES,
} from "@/src/domain/entities/Pricing";
import * as z from "@/src/lib/zod";

import { fieldsParsed } from "./fields-parsed";
import { moneyField } from "./money-fields";

/** A positive quantity as typed: "18", "0.5", "1000". */
const quantityField = z
  .pipe(z.string().check(z.trim(), z.regex(/^\d+(\.\d{1,3})?$/, "quantityInvalid")), z.transform(Number))
  .check(z.refine((n) => n > 0 && n <= 1_000_000, "quantityInvalid"));

/** A profit percentage as typed ("30", "12.5"), in basis points. */
const percentField = z
  .pipe(
    z.string().check(z.trim(), z.regex(/^\d{1,4}(\.\d{1,2})?$/, "markupInvalid")),
    z.transform((value) => Math.round(Number(value) * 100)),
  )
  .check(z.refine((bps) => bps <= MAX_MARKUP_BPS, "markupInvalid"));

const optionalWholeNumber = z.pipe(
  z.string().check(
    z.trim(),
    z.refine((value) => value === "" || /^\d+$/.test(value), "numberInvalid"),
  ),
  z.transform((value) => (value === "" ? undefined : Number(value))),
);

/** An ingredient as bought: e.g. 1,200,000 Toman for 1000 g. */
export const ingredientSchema = z.object({
  name: z.string().check(z.trim(), z.minLength(1, "nameRequired"), z.maxLength(80, "textTooLong")),
  unit: z.enum(INGREDIENT_UNITS, { error: "unitInvalid" }),
  purchasePrice: moneyField,
  purchaseQuantity: quantityField,
  isActive: z.boolean(),
});

export type IngredientFormInput = z.input<typeof ingredientSchema>;

/** An item's recipe: ingredients and how much of each goes into one serving. */
export const recipeSchema = z.object({
  lines: z
    .array(
      z.object({
        ingredientId: z.string().check(z.trim(), z.minLength(1, "ingredientRequired")),
        quantity: quantityField,
      }),
    )
    .check(
      z.maxLength(MAX_RECIPE_LINES, "linesTooMany"),
      z.refine((lines) => new Set(lines.map((line) => line.ingredientId)).size === lines.length, {
        error: "ingredientRepeated",
        when: fieldsParsed("*.quantity"),
      }),
    ),
});

export type RecipeFormInput = z.input<typeof recipeSchema>;

/** The advisor's settings as the form types them. */
export const pricingSettingsSchema = z
  .object({
    defaultMarkup: percentField,
    roundingStep: z
      .pipe(z.string().check(z.trim(), z.regex(/^\d+$/, "numberInvalid")), z.transform(Number))
      .check(z.refine((n) => n >= 1 && n <= 1_000_000, "numberInvalid")),
    overheadSource: z.enum(OVERHEAD_SOURCES, { error: "overheadSourceInvalid" }),
    manualMonthlyOverhead: optionalWholeNumber,
    expectedMonthlyUnits: optionalWholeNumber.check(z.refine((n) => n === undefined || n > 0, "numberInvalid")),
    overheadMonths: z
      .pipe(z.string().check(z.trim(), z.regex(/^\d+$/, "numberInvalid")), z.transform(Number))
      .check(z.refine((n) => n >= 1 && n <= MAX_OVERHEAD_MONTHS, "numberInvalid")),
    /** Expected monthly rise in costs as typed ("3", "4.5"), in basis points; blank is no inflation. */
    monthlyInflation: z
      .pipe(
        z.string().check(
          z.trim(),
          z.refine((value) => value === "" || /^\d{1,2}(\.\d{1,2})?$/.test(value), "inflationInvalid"),
        ),
        z.transform((value) => (value === "" ? 0 : Math.round(Number(value) * 100))),
      )
      .check(z.refine((bps) => bps <= MAX_MONTHLY_INFLATION_BPS, "inflationInvalid")),
    priceHorizonMonths: z
      .pipe(z.string().check(z.trim(), z.regex(/^\d+$/, "numberInvalid")), z.transform(Number))
      .check(z.refine((n) => n >= 1 && n <= MAX_PRICE_HORIZON_MONTHS, "numberInvalid")),
  })
  .check(
    z.refine((value) => value.overheadSource !== "manual" || value.manualMonthlyOverhead !== undefined, {
      path: ["manualMonthlyOverhead"],
      error: "overheadRequired",
      when: fieldsParsed(
        "defaultMarkup",
        "roundingStep",
        "manualMonthlyOverhead",
        "expectedMonthlyUnits",
        "overheadMonths",
        "monthlyInflation",
        "priceHorizonMonths",
      ),
    }),
  );

export type PricingSettingsInput = z.input<typeof pricingSettingsSchema>;

/** One item's own profit target; blank clears it (back to the default). */
export const itemMarkupSchema = z.object({
  markup: z.pipe(
    z.pipe(
      z.string().check(z.trim()),
      z.transform((value) => (value === "" ? null : value)),
    ),
    z.nullable(percentField),
  ),
});

export type ItemMarkupInput = z.input<typeof itemMarkupSchema>;

/** Apply the suggestion; `expectedPrice` is the price the owner saw, so a concurrent edit isn't overwritten. */
export const applyPriceSchema = z.object({ expectedPrice: z.number().check(z.int(), z.nonnegative()) });
