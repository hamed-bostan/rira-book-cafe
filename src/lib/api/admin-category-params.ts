import {
  ADMIN_CATEGORY_STATUSES,
  type AdminCategoryFilters,
  type AdminCategoryStatus,
} from "@/src/domain/entities/AdminCategoryFilters";

/**
 * The wire contract for the category-management list's filters — shared by the
 * dashboard toolbar and the admin route, the same split `admin-product-params.ts`
 * uses for the catalog list.
 *
 * Query-param names: `q`, `status`. Paging and ordering ride in the same query
 * string but are parsed separately by `pagination-params.ts`.
 */

const STATUS_SET = new Set<string>(ADMIN_CATEGORY_STATUSES);

/** Parse management-list filters from a `URLSearchParams`, dropping blank/unrecognised values. */
export function parseAdminCategoryFilters(params: URLSearchParams): AdminCategoryFilters {
  const filters: AdminCategoryFilters = {};

  const query = params.get("q")?.trim();
  if (query) filters.query = query;

  const status = params.get("status");
  if (status && STATUS_SET.has(status)) filters.status = status as AdminCategoryStatus;

  return filters;
}

/** Serialise management-list filters into query params, omitting anything unset. */
export function buildAdminCategoryParams(filters: AdminCategoryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.status) params.set("status", filters.status);
  return params;
}
