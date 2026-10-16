import { z } from "zod";

import {
  ADMIN_STOCK_FILTERS,
  ADMIN_VISIBILITY_FILTERS,
  type AdminProductFilters,
} from "@/src/domain/entities/AdminProductFilters";
import { PRODUCT_KINDS } from "@/src/domain/entities/Product";

import { trimmedTextParamSchema } from "./trimmed-text-param";

/**
 * The wire contract for the catalog-management list's filters — shared by the
 * dashboard toolbar (which serialises them into the URL) and the admin route
 * (which parses them back), the same split `product-search-params.ts` uses for
 * the storefront's catalog search.
 *
 * Query-param names: `q`, `categoryId`, `stock`, `visibility`. Paging and ordering ride in the
 * same query string but are parsed separately by `pagination-params.ts`.
 *
 * `q`/`categoryId` are free text: a blank value means "no filter", never an
 * error. `stock`/`visibility` are the domain's own closed vocabulary, so an
 * unrecognised value fails validation — the toolbar never produces one, and a
 * request that names one is asking the repository for a state that doesn't
 * exist (see `AdminStockFilter`), which is worth rejecting rather than
 * silently widening the list.
 */
export const adminProductFiltersSchema = z.object({
  q: trimmedTextParamSchema,
  categoryId: trimmedTextParamSchema,
  kind: z.enum(PRODUCT_KINDS).optional(),
  stock: z.enum(ADMIN_STOCK_FILTERS).optional(),
  // Absent means both states — the management list deliberately shows withdrawn
  // products alongside live ones.
  visibility: z.enum(ADMIN_VISIBILITY_FILTERS).optional(),
});

/** Parse management-list filters from a `URLSearchParams`. Throws `ZodError` for a recognised-but-invalid value. */
export function parseAdminProductFilters(params: URLSearchParams): AdminProductFilters {
  const parsed = adminProductFiltersSchema.parse(Object.fromEntries(params));
  const filters: AdminProductFilters = {};
  if (parsed.q) filters.query = parsed.q;
  if (parsed.categoryId) filters.categoryId = parsed.categoryId;
  if (parsed.kind) filters.kind = parsed.kind;
  if (parsed.stock) filters.stock = parsed.stock;
  if (parsed.visibility) filters.visibility = parsed.visibility;
  return filters;
}

/** Serialise management-list filters into query params, omitting anything unset. */
export function buildAdminProductParams(filters: AdminProductFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.stock) params.set("stock", filters.stock);
  if (filters.visibility) params.set("visibility", filters.visibility);
  return params;
}
