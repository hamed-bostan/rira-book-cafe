import type { AuditHook } from "./AuditHook";
import type { AdminCategoryFilters, AdminCategorySort } from "../entities/AdminCategoryFilters";
import type { Category } from "../entities/Category";
import type { Page, PageRequest } from "../entities/Pagination";

/** One locale's content override for a category — the admin-authored translated `name`. */
export type CategoryTranslationInput = {
  locale: string;
  name: string;
};

/**
 * A category before it exists — the database assigns the id and timestamps.
 * `translations` carries the per-locale names to persist alongside the base row:
 * `undefined` leaves existing translations untouched, a list replaces them (locales
 * absent from it are removed, so `[]` clears all).
 */
export type NewCategory = Omit<Category, "id" | "createdAt" | "updatedAt" | "productCount" | "isActive"> & {
  /** Omitted means "leave the default/current value" — see the repository impls. */
  isActive?: boolean;
  translations?: CategoryTranslationInput[];
};

/**
 * The one field a bulk action sets, and what to set it to.
 *
 * A closed union rather than a bare boolean parameter, for the same reason
 * `BulkProductChange` is one: it's the guard rail that keeps the bulk endpoint
 * from becoming a way to set anything other than what the UI has buttons for.
 * Categories currently offer exactly one bulk action (activate/deactivate), so
 * the union has one variant — but it's still a union, not a boolean, so adding a
 * second bulk-safe field later is additive rather than a signature break.
 */
export type BulkCategoryChange = { field: "isActive"; value: boolean };

/**
 * One category a bulk change actually altered, paired with how it looked first —
 * the same shape `BulkProductUpdate` uses, and for the same reason: the audit
 * entry needs the "before" to say what changed.
 */
export type BulkCategoryUpdate = {
  category: Category;
  previous: Category;
};

export type ICategoryRepository = {
  // `locale` selects the language for the category `name`: omitted or the default
  // locale returns the canonical (base row) name; a supported locale overlays its
  // translation, falling back to the base row when none exists.
  getAll(locale?: string): Promise<Category[]>;
  /** One page of the category-management list — filtered, sorted, and counted. */
  listPage(filters: AdminCategoryFilters, page: PageRequest<AdminCategorySort>, locale?: string): Promise<Page<Category>>;
  getById(id: string, locale?: string): Promise<Category | null>;
  getBySlug(slug: string, locale?: string): Promise<Category | null>;
  create(input: NewCategory, audit?: AuditHook<Category>): Promise<Category>;
  update(id: string, input: NewCategory, audit?: AuditHook<Category>): Promise<Category>;
  /** `audit` records the deletion inside the same transaction — the entry outlives the row. */
  delete(id: string, audit?: AuditHook<void>): Promise<void>;
  /** The stored per-locale translations for a category (for the admin edit form); empty when none. */
  getTranslations(categoryId: string): Promise<CategoryTranslationInput[]>;

  /**
   * Apply one field change to many categories at once, returning the rows as
   * written. Backs the management list's bulk actions (activate/deactivate).
   *
   * Mirrors `IProductRepository.applyBulkChange`: ids that don't exist are
   * skipped, categories already holding the target value are left alone and
   * produce no audit entry, and `audit` is invoked once per category actually
   * changed so each one's own activity history shows what happened to it.
   */
  applyBulkChange(
    ids: readonly string[],
    change: BulkCategoryChange,
    audit?: AuditHook<BulkCategoryUpdate>,
  ): Promise<BulkCategoryUpdate[]>;
}
