import {
  DEFAULT_PAGE_SIZE,
  clampPageRequest,
  type PageRequest,
  type SortDirection,
} from "@/src/domain/entities/Pagination";

/**
 * The single wire contract for paging — shared by the client (which serialises a
 * page request into a URL) and the API routes (which parse it back), exactly as
 * `product-search-params.ts` does for catalog filters.
 *
 * Query-param names: `page`, `pageSize`, `sort`, `dir`.
 *
 * List state lives in the URL rather than in component state so a paged, sorted,
 * filtered table survives a refresh, a back button and a pasted link — and so the
 * screens can stay server-rendered with no client-side data cache to keep in sync.
 */

const DIRECTIONS = ["asc", "desc"] as const;
const DIRECTION_SET = new Set<string>(DIRECTIONS);

export type PageRequestDefaults<TSort extends string> = {
  sort?: TSort;
  direction?: SortDirection;
  pageSize?: number;
};

/**
 * Parse a page request from a `URLSearchParams`, falling back to `defaults` for
 * anything absent and *silently dropping* anything invalid.
 *
 * Dropping rather than erroring is deliberate: a hand-edited or stale URL should
 * land the user on a sane first page, not a 400. `allowedSorts` is the list's own
 * column vocabulary — a sort key outside it is discarded, so a query string can
 * never reach the repository asking to order by an arbitrary column.
 */
export function parsePageRequest<TSort extends string>(
  params: URLSearchParams,
  allowedSorts: readonly TSort[],
  defaults: PageRequestDefaults<TSort> = {},
): PageRequest<TSort> {
  const sortSet = new Set<string>(allowedSorts);

  const sortParam = params.get("sort");
  const sort = sortParam && sortSet.has(sortParam) ? (sortParam as TSort) : defaults.sort;

  const directionParam = params.get("dir");
  const direction =
    directionParam && DIRECTION_SET.has(directionParam)
      ? (directionParam as SortDirection)
      : defaults.direction;

  // clamp handles the NaN from a non-numeric param, so parsing stays a plain
  // Number() here rather than re-implementing the bounds.
  return clampPageRequest({
    page: Number(params.get("page")) || 1,
    pageSize: Number(params.get("pageSize")) || defaults.pageSize || DEFAULT_PAGE_SIZE,
    sort,
    direction,
  });
}

/**
 * Serialise a page request into query params. Values equal to the defaults are
 * omitted so an untouched table keeps a clean URL — the same rule
 * `buildProductFilterParams` follows for the default sort.
 */
export function buildPageParams<TSort extends string>(
  request: Partial<PageRequest<TSort>>,
  defaults: PageRequestDefaults<TSort> = {},
): URLSearchParams {
  const params = new URLSearchParams();
  const defaultPageSize = defaults.pageSize ?? DEFAULT_PAGE_SIZE;

  if (request.page != null && request.page > 1) params.set("page", String(request.page));
  if (request.pageSize != null && request.pageSize !== defaultPageSize) {
    params.set("pageSize", String(request.pageSize));
  }
  if (request.sort != null && request.sort !== defaults.sort) params.set("sort", request.sort);
  if (request.direction != null && request.direction !== defaults.direction) {
    params.set("dir", request.direction);
  }

  return params;
}

/**
 * Merge page params into an existing set, returning a new `URLSearchParams`.
 *
 * Paging and filtering share one query string, so a pager link has to preserve
 * the filters it was rendered under and a filter change has to reset to page 1
 * (page 7 of a narrower result set is usually empty). Callers get that by passing
 * the current params through with the fields they're changing.
 */
export function mergePageParams<TSort extends string>(
  current: URLSearchParams,
  changes: Partial<PageRequest<TSort>>,
  defaults: PageRequestDefaults<TSort> = {},
): URLSearchParams {
  const next = new URLSearchParams(current);
  const defaultPageSize = defaults.pageSize ?? DEFAULT_PAGE_SIZE;

  if (changes.page != null) {
    if (changes.page > 1) next.set("page", String(changes.page));
    else next.delete("page");
  }
  if (changes.pageSize != null) {
    if (changes.pageSize !== defaultPageSize) next.set("pageSize", String(changes.pageSize));
    else next.delete("pageSize");
  }
  if (changes.sort != null) {
    if (changes.sort !== defaults.sort) next.set("sort", changes.sort);
    else next.delete("sort");
  }
  if (changes.direction != null) {
    if (changes.direction !== defaults.direction) next.set("dir", changes.direction);
    else next.delete("dir");
  }

  return next;
}
