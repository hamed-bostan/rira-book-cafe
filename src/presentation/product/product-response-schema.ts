import { z } from "zod/mini";

import { BOOK_AVAILABILITIES, PRODUCT_KINDS, type Product } from "@/src/domain/entities/Product";

/**
 * The shape a product endpoint promises to return, validated at the typed-service
 * boundary (see `parseApiResponse`). The menu's canonical response schema — the
 * dashboard and the public site read items from the same endpoints, so they all
 * read them through this.
 *
 * Distinct from `src/contracts/product-schema.ts`, which validates *form
 * input* (strings coerced to numbers, no `id`). This one describes what the API
 * sends back.
 */
export const productResponseSchema = z.object({
  id: z.string(),
  kind: z.enum(PRODUCT_KINDS),
  name: z.string(),
  price: z.number(),
  originalPrice: z.optional(z.number()),
  // Only the dashboard's endpoints return it.
  costPrice: z.optional(z.number()),
  discountPercent: z.optional(z.number()),
  rating: z.number(),
  ratingCount: z.number(),
  stockQuantity: z.number(),
  madeToOrder: z.boolean(),
  imageUrl: z.string(),
  categoryId: z.string(),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
  badge: z.optional(z.string()),
  images: z.optional(z.array(z.string())),
  unit: z.optional(z.string()),
  description: z.optional(z.string()),
  nutrition: z.optional(z.string()),
  origin: z.optional(z.string()),
  dietary: z.optional(z.array(z.string())),
  taxExempt: z.boolean(),
  book: z.optional(
    z.object({
      author: z.string(),
      isbn: z.optional(z.string()),
      availability: z.enum(BOOK_AVAILABILITIES),
    }),
  ),
}) satisfies z.ZodMiniType<Product>;

export const productListResponseSchema = z.array(productResponseSchema);
