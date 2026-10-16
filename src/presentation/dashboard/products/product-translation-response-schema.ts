import { z } from "zod";

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
  unit: z.string().optional(),
  description: z.string().optional(),
  nutrition: z.string().optional(),
  origin: z.string().optional(),
}) satisfies z.ZodType<ProductTranslationInput>;

export const productTranslationListResponseSchema = z.array(productTranslationResponseSchema);
