import { z } from "zod";

import type { Page } from "@/src/domain/entities/Pagination";

/**
 * Wrap an item schema into the paged-response schema its endpoint promises —
 * `{ items, total, page, pageSize }`. Every paged list validates through this, so
 * the envelope is described once instead of per feature.
 *
 * A function rather than a constant because the item type varies: each caller
 * gets a schema whose `items` are its own entity, still checked at the typed-
 * service boundary like every other response.
 */
export function pageResponseSchema<T>(itemSchema: z.ZodType<T>): z.ZodType<Page<T>> {
  return z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  });
}
