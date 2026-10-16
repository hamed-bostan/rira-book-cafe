import { z } from "zod";

import type { Category } from "@/src/domain/entities/Category";

/**
 * The shape a category endpoint promises to return, validated at the typed-service
 * boundary (both the browser `categoriesApi` and the server `categoriesServerApi`)
 * so a malformed or drifted body fails as an `ApiError` instead of being cast to
 * `Category` on faith.
 *
 * Distinct from `category-schema.ts`, which validates *form input*: that one is
 * about what a user may submit (trimmed, length-capped, slug-cased), this one about
 * what the API sends back (an `id` the form never provides). They're deliberately
 * not the same schema.
 *
 * `satisfies` ties it to the domain entity: drop or rename a field here and the
 * compiler fails rather than the runtime. Lives in `presentation` — the entity it
 * mirrors is in `domain`, which must not learn about the API layer.
 */
export const categoryResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  iconUrl: z.string(),
  isActive: z.boolean(),
  productCount: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
}) satisfies z.ZodType<Category>;

/** Collection endpoints (`GET /categories`, `?slug=` included) always return an array. */
export const categoryListResponseSchema = z.array(categoryResponseSchema);
