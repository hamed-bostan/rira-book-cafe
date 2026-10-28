import { z } from "zod/mini";

import type { ProductTranslationInput } from "@/src/domain/repositories/IProductRepository";

/**
 * The product's stored per-locale translations (`GET /products/:id/translations`),
 * validated at the typed-service boundary (see `parseApiResponse`) before they
 * prefill the edit form. `satisfies` ties the shape to the repository input type, so
 * a field renamed there fails the compiler rather than the runtime.
 */
export const productTranslationResponseSchema = z.object({
  locale: z.string(),
  name: z.string(),
  unit: z.optional(z.string()),
  description: z.optional(z.string()),
  nutrition: z.optional(z.string()),
  origin: z.optional(z.string()),
}) satisfies z.ZodMiniType<ProductTranslationInput>;

export const productTranslationListResponseSchema = z.array(productTranslationResponseSchema);
