import type { ProductKind } from "./Product";

/**
 * Menu filter vocabulary and the filter criteria the search use-case accepts.
 * Framework-free domain constants: the public filter UI reads its options from
 * here and the API validates query params against them — one source of truth so
 * options never drift from the items that carry them.
 */

/** Dietary tags an item can carry; an item may hold several. */
export const DIETARY_TAGS = ["Vegan", "Vegetarian", "Gluten-Free", "Dairy-Free", "Sugar-Free", "Caffeine-Free"] as const;
export type DietaryTag = (typeof DIETARY_TAGS)[number];

/**
 * Result orderings the search supports. `name` (A–Z) is the default; the rest map
 * to a single column each in the repository.
 */
export const PRODUCT_SORTS = ["name", "price-asc", "price-desc", "rating"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
export const DEFAULT_PRODUCT_SORT: ProductSort = "name";

/**
 * Criteria for a menu search. Every field is optional and combines with AND (an
 * item must satisfy all supplied criteria); `dietary` matches ANY of its values.
 * An all-empty filter is "no search" — the use-case returns nothing rather than the
 * whole menu.
 */
export type ProductFilters = {
  /** Free-text term matched against name, description and (for books) author. */
  query?: string;
  categoryId?: string;
  kind?: ProductKind;
  /** Inclusive price bounds, in Toman. */
  minPrice?: number;
  maxPrice?: number;
  /** Match items carrying ANY of these dietary tags. */
  dietary?: string[];
  /** Result ordering; defaults to `name` when omitted. */
  sort?: ProductSort;
};

/**
 * True when the filters carry at least one *matching* criterion. `sort` alone
 * doesn't count — there's nothing to order without a search — so a bare sort
 * resolves to no results rather than the whole menu.
 */
export function hasProductSearchCriteria(filters: ProductFilters): boolean {
  return (
    filters.query != null ||
    filters.categoryId != null ||
    filters.kind != null ||
    filters.minPrice != null ||
    filters.maxPrice != null ||
    (filters.dietary?.length ?? 0) > 0
  );
}
