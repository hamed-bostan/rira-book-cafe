import { z } from "zod";

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
  originalPrice: z.number().optional(),
  discountPercent: z.number().optional(),
  rating: z.number(),
  ratingCount: z.number(),
  stockQuantity: z.number(),
  imageUrl: z.string(),
  categoryId: z.string(),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
  badge: z.string().optional(),
  images: z.array(z.string()).optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
  nutrition: z.string().optional(),
  origin: z.string().optional(),
  dietary: z.array(z.string()).optional(),
  taxExempt: z.boolean(),
  book: z
    .object({
      author: z.string(),
      isbn: z.string().optional(),
      availability: z.enum(BOOK_AVAILABILITIES),
    })
    .optional(),
}) satisfies z.ZodType<Product>;

export const productListResponseSchema = z.array(productResponseSchema);
