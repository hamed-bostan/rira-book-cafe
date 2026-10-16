import { z } from "zod";

import type { CategoryTranslationInput } from "@/src/domain/repositories/ICategoryRepository";

/**
 * The category's stored per-locale translations (`GET /categories/:id/translations`),
 * validated at the typed-service boundary (see `parseApiResponse`) before they
 * prefill the edit form. `satisfies` ties the shape to the repository input type, so
 * a field renamed there fails the compiler rather than the runtime.
 */
export const categoryTranslationResponseSchema = z.object({
  locale: z.string(),
  name: z.string(),
}) satisfies z.ZodType<CategoryTranslationInput>;

export const categoryTranslationListResponseSchema = z.array(categoryTranslationResponseSchema);
