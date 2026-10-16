import { PRODUCT_KINDS, type ProductKind } from "@/src/domain/entities/Product";
import type { ProductFilters, ProductSort } from "@/src/domain/entities/ProductFilters";
import { DEFAULT_PRODUCT_SORT, DIETARY_TAGS, PRODUCT_SORTS } from "@/src/domain/entities/ProductFilters";

/**
 * The single wire contract for product-search filters — shared by the client
 * (which serialises filters into a URL) and the API route + HTTP repo (which parse
 * them back). Query-param names: `q`, `categoryId`, `kind`, `minPrice`,
 * `maxPrice`, and the repeatable `dietary`.
 */

const DIETARY_SET = new Set<string>(DIETARY_TAGS);
const SORT_SET = new Set<string>(PRODUCT_SORTS);
const KIND_SET = new Set<string>(PRODUCT_KINDS);

/** Parse filters from a `URLSearchParams`, dropping blank/invalid values. */
export function parseProductFilters(params: URLSearchParams): ProductFilters {
  const filters: ProductFilters = {};

  const query = params.get("q")?.trim();
  if (query) filters.query = query;

  const categoryId = params.get("categoryId")?.trim();
  if (categoryId) filters.categoryId = categoryId;

  const minPrice = toPrice(params.get("minPrice"));
  if (minPrice != null) filters.minPrice = minPrice;

  const maxPrice = toPrice(params.get("maxPrice"));
  if (maxPrice != null) filters.maxPrice = maxPrice;

  // Only keep dietary tags we recognise, so a hand-edited URL can't inject junk.
  const dietary = params.getAll("dietary").filter((tag) => DIETARY_SET.has(tag));
  if (dietary.length) filters.dietary = dietary;

  const kind = params.get("kind");
  if (kind && KIND_SET.has(kind)) filters.kind = kind as ProductKind;

  const sort = params.get("sort");
  if (sort && SORT_SET.has(sort)) filters.sort = sort as ProductSort;

  return filters;
}

/** Serialise filters into a `URLSearchParams` for a `/search` (or `/api/products`) URL. */
export function buildProductFilterParams(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.query) params.set("q", filters.query);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.minPrice != null) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice != null) params.set("maxPrice", String(filters.maxPrice));
  filters.dietary?.forEach((tag) => params.append("dietary", tag));
  // Omit the default so a plain name-sorted search keeps a clean URL.
  if (filters.sort && filters.sort !== DEFAULT_PRODUCT_SORT) params.set("sort", filters.sort);

  return params;
}

/** A non-negative finite price, or `undefined` for blank/invalid input. */
function toPrice(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
