/**
 * Data-cache tags shared by both halves of the BFF: the storefront's server reads
 * tag the public catalog responses they cache (`serverApiGet`'s `cache` option),
 * and the REST write routes invalidate them (`invalidatesCatalog`). Kept in `lib`
 * because `app/api` may not import from `presentation`.
 */
export const CATALOG_TAGS = {
  products: "catalog:products",
  categories: "catalog:categories",
  events: "catalog:events",
} as const;

export type CatalogTag = (typeof CATALOG_TAGS)[keyof typeof CATALOG_TAGS];

/**
 * How long a cached catalog read may be served without a write having invalidated
 * it, in seconds. Writes invalidate immediately; this only bounds staleness from a
 * change no tag covers (an event starting, a stock change made outside the API).
 */
export const CATALOG_REVALIDATE_SECONDS = 60;
