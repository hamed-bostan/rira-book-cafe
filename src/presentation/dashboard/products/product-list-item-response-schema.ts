import { z } from "zod";

import type { ProductListItem } from "@/src/domain/entities/Product";
import { pageResponseSchema } from "@/src/lib/api/page-response-schema";
import { productResponseSchema } from "@/src/presentation/product/product-response-schema";

/**
 * One row of `GET /api/admin/products`: the product, plus — for a made-to-order
 * item with an ingredient out or running low — the ingredient to warn about.
 */
export const productListItemResponseSchema = productResponseSchema.extend({
  ingredientAlert: z.object({ level: z.enum(["out", "low"]), ingredient: z.string() }).optional(),
}) satisfies z.ZodType<ProductListItem>;

/** What `GET /api/admin/products` promises: a page of rows plus the total behind it. */
export const productPageResponseSchema = pageResponseSchema(productListItemResponseSchema);
