/**
 * Paging vocabulary shared by every list that can't be read whole — the admin
 * tables today, any long storefront list later. Framework-free: the repositories
 * translate a `PageRequest` into `skip`/`take`, the route handlers parse one off
 * the query string, and the screens render a `Page<T>` without knowing which of
 * those produced it.
 *
 * Sort keys stay a *generic* parameter rather than a shared union: "which columns
 * can this list be ordered by" is a property of each list, and each repository is
 * the only place that can honour one. A shared union would let a screen ask for an
 * ordering its table has no column for.
 */

/** Rows per page when the caller doesn't say. */
export const DEFAULT_PAGE_SIZE = 25;

/** Page sizes offered by full management tables. */
export const TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * Hard ceiling on rows per page. The page size arrives from the query string, so
 * it's caller-controlled input: without a clamp, `?pageSize=100000` is a way to
 * ask the server to do the very thing paging exists to prevent.
 */
export const MAX_PAGE_SIZE = 100;

export type SortDirection = "asc" | "desc";

/**
 * Which slice of a list to read, and in what order. `page` is 1-based — it comes
 * from and goes back into a URL that people read and share, and `?page=0` for the
 * first page is a nasty surprise there.
 *
 * `TSort` is the set of column keys the list being read can order by.
 */
export type PageRequest<TSort extends string = string> = {
  /** 1-based page number. */
  page: number;
  pageSize: number;
  sort?: TSort;
  direction?: SortDirection;
};

/**
 * One slice of a list plus the count it was cut from. `total` is the number of
 * rows matching the *filters*, not the number returned — the pager needs to know
 * how many pages exist, which the items alone can never say.
 */
export type Page<T> = {
  items: T[];
  /** Rows matching the filters across all pages. */
  total: number;
  /** 1-based page number this slice came from. */
  page: number;
  pageSize: number;
};

/** How many pages `total` rows fill at this page size; always at least 1, so the UI never renders "page 1 of 0". */
export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * Coerce a possibly-hostile page request into a safe one: whole numbers, page at
 * least 1, page size within {@link MAX_PAGE_SIZE}. Repositories can assume a
 * clamped request, so the guard lives here once instead of in each of them.
 */
export function clampPageRequest<TSort extends string>(request: PageRequest<TSort>): PageRequest<TSort> {
  const page = Math.max(1, Math.floor(request.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(request.pageSize) || DEFAULT_PAGE_SIZE));
  return { ...request, page, pageSize };
}

/** Translate a page request into the `skip`/`take` a query takes. Clamps first, so callers can't skip the guard. */
export function toSkipTake(request: PageRequest): { skip: number; take: number } {
  const { page, pageSize } = clampPageRequest(request);
  return { skip: (page - 1) * pageSize, take: pageSize };
}

/** Assemble a page from a query's rows and its matching count. */
export function createPage<T>(items: T[], total: number, request: PageRequest): Page<T> {
  const { page, pageSize } = clampPageRequest(request);
  return { items, total, page, pageSize };
}

/** A page with nothing in it — for the "no criteria, nothing to show" paths. */
export function emptyPage<T>(request: PageRequest): Page<T> {
  return createPage<T>([], 0, request);
}

/**
 * Page an already-in-memory array. For the mock repositories and for lists whose
 * rows are *derived* rather than queried (e.g. customer summaries aggregated from
 * order history), where there's no `skip`/`take` to push into a query.
 */
export function paginateArray<T>(items: readonly T[], request: PageRequest): Page<T> {
  const { skip, take } = toSkipTake(request);
  return createPage(items.slice(skip, skip + take), items.length, request);
}
