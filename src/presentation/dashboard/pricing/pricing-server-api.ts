import type { Ingredient, PricingReport, RecipeLine } from "@/src/domain/entities/Pricing";
import { serverApiGet } from "@/src/lib/api/server-client";

import {
  ingredientListResponseSchema,
  pricingReportResponseSchema,
  recipeResponseSchema,
} from "./pricing-response-schema";

/** Server-side pricing reads for the dashboard (BFF), fetched during server render. */
export const pricingServerApi = {
  getReport(): Promise<PricingReport> {
    return serverApiGet("/admin/pricing", pricingReportResponseSchema);
  },
};

export const ingredientsServerApi = {
  list(includeInactive: boolean): Promise<Ingredient[]> {
    return serverApiGet(
      "/admin/ingredients",
      ingredientListResponseSchema,
      includeInactive ? { params: { all: "true" } } : undefined,
    );
  },
};

export const recipesServerApi = {
  async getByProductId(productId: string): Promise<RecipeLine[]> {
    return (await serverApiGet(`/admin/recipes/${productId}`, recipeResponseSchema)).lines;
  },
};
