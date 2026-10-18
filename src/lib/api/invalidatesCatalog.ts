import { revalidateTag } from "next/cache";

import type { CatalogTag } from "../cache-tags";

/**
 * Wraps a write route handler so every successful (2xx) response expires the
 * cached catalog reads it affects — whatever path through the handler succeeded,
 * so a new early `return` can't forget to. Failures leave the cache alone.
 *
 * `{ expire: 0 }` rather than stale-while-revalidate: after a change (a price, an
 * item selling out, an event filling up) the very next storefront render must
 * show it, not one stale page first.
 */
export function invalidatesCatalog<Args extends unknown[], R extends Response>(
  tags: readonly CatalogTag[],
  handler: (...args: Args) => Promise<R>,
): (...args: Args) => Promise<R> {
  return async (...args: Args): Promise<R> => {
    const response = await handler(...args);
    if (response.ok) for (const tag of tags) revalidateTag(tag, { expire: 0 });
    return response;
  };
}
