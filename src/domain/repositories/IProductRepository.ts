import type { AuditHook } from "./AuditHook";
import type { AdminProductFilters, AdminProductSort } from "../entities/AdminProductFilters";
import type { Page, PageRequest } from "../entities/Pagination";
import type { Product } from "../entities/Product";
import type { ProductFilters } from "../entities/ProductFilters";

/**
 * One locale's content overrides for an item — the admin-authored translation.
 * `name` is required (the base row's name is never blank); the rest fall back to the
 * base row field-by-field when omitted.
 */
export type ProductTranslationInput = {
  locale: string;
  name: string;
  unit?: string;
  description?: string;
  nutrition?: string;
  origin?: string;
};

/**
 * An item before it exists. The admin controls these fields; everything derived
 * (id, ratings, `discountPercent`) is filled in by the repository on create.
 *
 * `translations` carries the per-locale content to persist alongside the base row:
 * `undefined` leaves any existing translations untouched, while a list *replaces*
 * them (locales absent from it are removed, so `[]` clears all).
 */
export type NewProduct = Omit<Product, "id" | "discountPercent" | "rating" | "ratingCount" | "images"> & {
  translations?: ProductTranslationInput[];
};

/**
 * The one field a bulk action sets, and what to set it to.
 *
 * A closed union rather than a partial `Product`: a bulk edit is only safe for
 * fields where "the same value for all of them" is a sensible thing to want. Price,
 * stock and name are emphatically not that, so they aren't expressible here.
 */
export type BulkProductChange = { field: "isPublished"; value: boolean } | { field: "categoryId"; value: string };

/**
 * One item a bulk change actually altered, paired with how it looked first — the
 * audit entry needs the "before". Items the change would have been a no-op for
 * never appear here at all.
 */
export type BulkProductUpdate = {
  product: Product;
  previous: Product;
};

export type IProductRepository = {
  // `locale` selects the language for user-facing text (name/unit/detail copy):
  // omitted or the default locale returns the canonical (base row) copy; a supported
  // locale overlays its translation, falling back field-by-field to the base row.
  //
  // Visibility splits these reads in two, and the split is in the *names* rather
  // than in a flag: the public reads filter unconditionally, and where both sides
  // need the same lookup there are two methods with different names.
  /** The published menu, for the public site. Unpublished items are excluded. */
  getAll(locale?: string): Promise<Product[]>;
  /** One item in any visibility state — the dashboard's read, and the one every write path checks against. */
  getById(id: string, locale?: string): Promise<Product | null>;
  /** One item, but only if the public site may show it — `null` for an unpublished one. */
  getPublishedById(id: string, locale?: string): Promise<Product | null>;
  /**
   * Resolve several items at once, for screens that hold a set of ids (an order's
   * lines). Missing ids are simply absent; deliberately *not* filtered by visibility.
   */
  getByIds(ids: readonly string[], locale?: string): Promise<Product[]>;
  /** Featured items for the public site. Published only. */
  getFeatured(locale?: string): Promise<Product[]>;
  /** Menu search. At least one criterion is always set. Published only. */
  search(filters: ProductFilters, locale?: string): Promise<Product[]>;
  /** One page of the management list, plus the total matching the filters. An empty filter means the whole menu, paged. */
  listPage(filters: AdminProductFilters, page: PageRequest<AdminProductSort>, locale?: string): Promise<Page<Product>>;
  create(input: NewProduct, audit?: AuditHook<Product>): Promise<Product>;
  update(id: string, input: NewProduct, audit?: AuditHook<Product>): Promise<Product>;
  /** `audit` records the deletion inside the same transaction — the entry is the only record the item ever existed. */
  delete(id: string, audit?: AuditHook<void>): Promise<void>;
  /**
   * Apply one field change to many items at once, atomically, with one audit entry
   * per item actually changed. Unknown ids and items already holding the value are
   * skipped, so the result can be shorter than `ids`.
   */
  applyBulkChange(
    ids: readonly string[],
    change: BulkProductChange,
    audit?: AuditHook<BulkProductUpdate>,
  ): Promise<BulkProductUpdate[]>;
  /** The stored per-locale translations for an item (for the admin edit form); empty when none. */
  getTranslations(productId: string): Promise<ProductTranslationInput[]>;
};
