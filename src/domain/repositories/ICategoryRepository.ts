import type { AuditHook } from "./AuditHook";
import type { Category } from "../entities/Category";

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
 *
 * `parentId`: `null` makes it a top-level category, an id files it under that
 * one; omitted leaves it where it is (top level for a new one). A category that
 * moves under another parent goes to the end of its new siblings.
 */
export type NewCategory = Omit<
  Category,
  "id" | "createdAt" | "updatedAt" | "productCount" | "hiddenProductCount" | "isActive" | "parentId"
> & {
  /** Omitted means "leave the default/current value" — see the repository impls. */
  isActive?: boolean;
  parentId?: string | null;
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
  //
  // `getAll` answers in menu order — the order guests see the categories in: each
  // top-level category followed by its subcategories (see `inMenuOrder`).
  getAll(locale?: string): Promise<Category[]>;
  getById(id: string, locale?: string): Promise<Category | null>;
  getBySlug(slug: string, locale?: string): Promise<Category | null>;
  /** A new category goes to the end of the menu. */
  create(input: NewCategory, audit?: AuditHook<Category>): Promise<Category>;
  update(id: string, input: NewCategory, audit?: AuditHook<Category>): Promise<Category>;
  /** `audit` records the deletion inside the same transaction — the entry outlives the row. */
  delete(id: string, audit?: AuditHook<void>): Promise<void>;
  /** The stored per-locale translations for a category (for the admin edit form); empty when none. */
  getTranslations(categoryId: string): Promise<CategoryTranslationInput[]>;

  /**
   * Put one parent's categories in this order, first id first — the top-level
   * ones (`parentId` `null`) or one parent's subcategories. Places are counted
   * among siblings only. Ids that no longer exist, or no longer sit under that
   * parent, are skipped, and a sibling the list leaves out (one added since the
   * caller read the order) keeps its place after the listed ones — so a stale
   * list can't leave two categories sharing a place. Each of `audits` runs once,
   * inside the same transaction.
   */
  setOrder(parentId: string | null, ids: readonly string[], audits?: readonly AuditHook<void>[]): Promise<void>;

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
};
