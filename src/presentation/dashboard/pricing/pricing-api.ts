import type {
  IngredientFormInput,
  ItemMarkupInput,
  PricingSettingsInput,
  RecipeFormInput,
} from "@/src/contracts/pricing-schema";
import type { Ingredient, PricingSettings } from "@/src/domain/entities/Pricing";
import { apiPatch, apiPost, apiPut } from "@/src/lib/api/client";

import {
  ingredientResponseSchema,
  pricingSettingsResponseSchema,
  recipeResponseSchema,
  repricedResponseSchema,
} from "./pricing-response-schema";

/** Typed client for pricing writes. Callers `router.refresh()` or navigate after. */
export const pricingApi = {
  setItemMarkup(productId: string, values: ItemMarkupInput): Promise<void> {
    return apiPatch(`/admin/pricing/items/${productId}`, values);
  },

  /** Set the menu price to the server's suggestion; 409 if the price changed meanwhile. */
  async applySuggestion(productId: string, expectedPrice: number): Promise<number> {
    return (await apiPost(`/admin/pricing/items/${productId}/apply`, { expectedPrice }, repricedResponseSchema)).after;
  },

  updateSettings(values: PricingSettingsInput): Promise<PricingSettings> {
    return apiPut("/admin/pricing/settings", values, pricingSettingsResponseSchema);
  },
};

export const ingredientsApi = {
  create(values: IngredientFormInput): Promise<Ingredient> {
    return apiPost("/admin/ingredients", values, ingredientResponseSchema);
  },

  update(id: string, values: IngredientFormInput): Promise<Ingredient> {
    return apiPut(`/admin/ingredients/${id}`, values, ingredientResponseSchema);
  },
};

export const recipesApi = {
  async save(productId: string, values: RecipeFormInput): Promise<void> {
    await apiPut(`/admin/recipes/${productId}`, values, recipeResponseSchema);
  },
};
