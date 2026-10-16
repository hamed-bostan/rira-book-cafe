/**
 * Filter and sort vocabulary for the *catalog management* category list —
 * mirrors `AdminProductFilters`, the same split for the sibling list.
 */

/** Columns the management list can be ordered by; each maps to a single column (or derived count) in the repository. */
export const ADMIN_CATEGORY_SORTS = ["name", "productCount", "updatedAt"] as const;
export type AdminCategorySort = (typeof ADMIN_CATEGORY_SORTS)[number];

/** Alphabetical by default — an operator scanning the category list expects the storefront's own order. */
export const DEFAULT_ADMIN_CATEGORY_SORT: AdminCategorySort = "name";
export const DEFAULT_ADMIN_CATEGORY_DIRECTION = "asc";

/** Status states the list can be narrowed to; omitted means both. */
export const ADMIN_CATEGORY_STATUSES = ["active", "inactive"] as const;
export type AdminCategoryStatus = (typeof ADMIN_CATEGORY_STATUSES)[number];

export type AdminCategoryFilters = {
  /** Free-text term matched against name. */
  query?: string;
  /** Narrow to active or inactive categories; omitted means both. */
  status?: AdminCategoryStatus;
};
