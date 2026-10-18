import { describe, expect, it } from "vitest";

import { MAX_RECIPE_LINES } from "@/src/domain/entities/Pricing";

import {
  applyPriceSchema,
  ingredientSchema,
  itemMarkupSchema,
  pricingSettingsSchema,
  recipeSchema,
  type IngredientFormInput,
  type PricingSettingsInput,
} from "../pricing-schema";

import { messagesAt } from "./zod-issues";

const INGREDIENT: IngredientFormInput = {
  name: " Arabica beans ",
  unit: "g",
  purchasePrice: "1200000",
  purchaseQuantity: "1000",
  isActive: true,
};

const SETTINGS: PricingSettingsInput = {
  defaultMarkup: "30",
  roundingStep: "1000",
  overheadSource: "ledger",
  manualMonthlyOverhead: "",
  expectedMonthlyUnits: "",
  overheadMonths: "3",
};

const settingsErrors = (input: unknown): Record<string, string[] | undefined> | undefined =>
  pricingSettingsSchema.safeParse(input).error?.flatten().fieldErrors;

describe("ingredientSchema", () => {
  it("parses the purchase into numbers", () => {
    expect(ingredientSchema.parse(INGREDIENT)).toEqual({
      name: "Arabica beans",
      unit: "g",
      purchasePrice: 1200000,
      purchaseQuantity: 1000,
      isActive: true,
    });
    expect(ingredientSchema.parse({ ...INGREDIENT, purchaseQuantity: "1000000" }).purchaseQuantity).toBe(1_000_000);
  });

  it("maps each invalid field to its message key", () => {
    const fieldErrors = ingredientSchema.safeParse({ ...INGREDIENT, name: "", unit: "kg", purchasePrice: "", purchaseQuantity: "0" }).error?.flatten()
      .fieldErrors;
    expect(fieldErrors?.name).toEqual(["nameRequired"]);
    expect(fieldErrors?.unit).toEqual(["unitInvalid"]);
    expect(fieldErrors?.purchasePrice).toContain("amountRequired");
    expect(fieldErrors?.purchaseQuantity).toEqual(["quantityInvalid"]);
  });

  it("caps the name and the purchase quantity", () => {
    expect(ingredientSchema.safeParse({ ...INGREDIENT, name: "n".repeat(81) }).error?.flatten().fieldErrors.name).toEqual(["textTooLong"]);
    for (const purchaseQuantity of ["1000001", "0.0005"]) {
      expect(ingredientSchema.safeParse({ ...INGREDIENT, purchaseQuantity }).error?.flatten().fieldErrors.purchaseQuantity).toEqual([
        "quantityInvalid",
      ]);
    }
  });
});

describe("recipeSchema", () => {
  it("parses quantities per serving, and allows an empty recipe", () => {
    expect(
      recipeSchema.parse({
        lines: [
          { ingredientId: "beans", quantity: "18" },
          { ingredientId: "milk", quantity: " 0.5 " },
        ],
      }),
    ).toEqual({
      lines: [
        { ingredientId: "beans", quantity: 18 },
        { ingredientId: "milk", quantity: 0.5 },
      ],
    });
    expect(recipeSchema.parse({ lines: [] })).toEqual({ lines: [] });
  });

  it("refuses the same ingredient twice", () => {
    const result = recipeSchema.safeParse({
      lines: [
        { ingredientId: "beans", quantity: "18" },
        { ingredientId: "beans", quantity: "2" },
      ],
    });
    expect(messagesAt(result, "lines")).toEqual(["ingredientRepeated"]);
  });

  it("caps the lines and requires an ingredient on each", () => {
    const tooMany = Array.from({ length: MAX_RECIPE_LINES + 1 }, (_, index) => ({ ingredientId: `i${index}`, quantity: "1" }));
    expect(messagesAt(recipeSchema.safeParse({ lines: tooMany }), "lines")).toContain("linesTooMany");
    expect(messagesAt(recipeSchema.safeParse({ lines: [{ ingredientId: " ", quantity: "1" }] }), "lines.0.ingredientId")).toEqual([
      "ingredientRequired",
    ]);
  });
});

describe("pricingSettingsSchema", () => {
  it("stores percentages in basis points and reads blanks as unset", () => {
    expect(pricingSettingsSchema.parse(SETTINGS)).toEqual({
      defaultMarkup: 3000,
      roundingStep: 1000,
      overheadSource: "ledger",
      manualMonthlyOverhead: undefined,
      expectedMonthlyUnits: undefined,
      overheadMonths: 3,
    });
    expect(pricingSettingsSchema.parse({ ...SETTINGS, defaultMarkup: "12.5", expectedMonthlyUnits: "1200" })).toMatchObject({
      defaultMarkup: 1250,
      expectedMonthlyUnits: 1200,
    });
  });

  it("accepts the markup cap and refuses anything above or malformed", () => {
    expect(pricingSettingsSchema.parse({ ...SETTINGS, defaultMarkup: "1000" }).defaultMarkup).toBe(100_000);
    for (const defaultMarkup of ["1000.01", "abc", "12.345", "-5"]) {
      expect(settingsErrors({ ...SETTINGS, defaultMarkup })?.defaultMarkup).toEqual(["markupInvalid"]);
    }
  });

  it("bounds the rounding step and the overhead months", () => {
    for (const roundingStep of ["0", "1000001", "1.5"]) {
      expect(settingsErrors({ ...SETTINGS, roundingStep })?.roundingStep).toEqual(["numberInvalid"]);
    }
    expect(pricingSettingsSchema.parse({ ...SETTINGS, overheadMonths: "12" }).overheadMonths).toBe(12);
    for (const overheadMonths of ["0", "13", "x"]) {
      expect(settingsErrors({ ...SETTINGS, overheadMonths })?.overheadMonths).toEqual(["numberInvalid"]);
    }
  });

  it("refuses an unknown overhead source", () => {
    expect(settingsErrors({ ...SETTINGS, overheadSource: "guess" })?.overheadSource).toEqual([
      "overheadSourceInvalid",
    ]);
  });

  it("needs a monthly figure when the overhead is entered by hand", () => {
    expect(settingsErrors({ ...SETTINGS, overheadSource: "manual" })?.manualMonthlyOverhead).toEqual(["overheadRequired"]);
    expect(pricingSettingsSchema.parse({ ...SETTINGS, overheadSource: "manual", manualMonthlyOverhead: "40000000" }).manualMonthlyOverhead).toBe(
      40_000_000,
    );
    expect(settingsErrors({ ...SETTINGS, manualMonthlyOverhead: "1e6" })?.manualMonthlyOverhead).toEqual(["numberInvalid"]);
  });

  it("refuses zero expected units", () => {
    expect(settingsErrors({ ...SETTINGS, expectedMonthlyUnits: "0" })?.expectedMonthlyUnits).toEqual(["numberInvalid"]);
  });
});

describe("itemMarkupSchema", () => {
  it("reads blank as back-to-default and a percentage as basis points", () => {
    expect(itemMarkupSchema.parse({ markup: "  " })).toEqual({ markup: null });
    expect(itemMarkupSchema.parse({ markup: "45" })).toEqual({ markup: 4500 });
  });

  it("refuses a malformed markup", () => {
    expect(itemMarkupSchema.safeParse({ markup: "x" }).error?.flatten().fieldErrors.markup).toEqual(["markupInvalid"]);
  });
});

describe("applyPriceSchema", () => {
  it("takes a whole, non-negative expected price", () => {
    expect(applyPriceSchema.parse({ expectedPrice: 185000 })).toEqual({ expectedPrice: 185000 });
    expect(applyPriceSchema.safeParse({ expectedPrice: 0 }).success).toBe(true);
    expect(applyPriceSchema.safeParse({ expectedPrice: -1 }).success).toBe(false);
    expect(applyPriceSchema.safeParse({ expectedPrice: 1.5 }).success).toBe(false);
  });
});
