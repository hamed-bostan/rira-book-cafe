import { DEFAULT_PAGE_SIZE, TABLE_PAGE_SIZE_OPTIONS } from "@/src/domain/entities/Pagination";

/**
 * Remembers the rows-per-page a staff member last picked, across every admin list.
 * Same sticky-preference pattern as the sidebar cookie: written by the pager when
 * the size changes, read server-side by each list page before it fetches — so the
 * first render already has the right number of rows, with no second round trip to
 * swap them after the page has loaded.
 */
export const PAGE_SIZE_COOKIE_NAME = "dashboard-page-size";
export const PAGE_SIZE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** Which sizes a list offers and which it uses when nothing is chosen. */
export type PageSizeChoices = {
  options?: readonly number[];
  defaultPageSize?: number;
};

/**
 * The size to ask the API for, or `undefined` when that's the API's own default
 * (`DEFAULT_PAGE_SIZE`) and nothing needs sending. The remembered size wins; one the
 * list doesn't offer (the categories list stops at 50) falls back to the list's default.
 */
export function rememberedPageSize(
  cookieValue: string | undefined,
  { options = TABLE_PAGE_SIZE_OPTIONS, defaultPageSize = DEFAULT_PAGE_SIZE }: PageSizeChoices = {},
): number | undefined {
  const remembered = Number(cookieValue);
  const size = options.includes(remembered) ? remembered : defaultPageSize;
  return size === DEFAULT_PAGE_SIZE ? undefined : size;
}

/** Write the choice from the browser; no reload needed — the pager navigates anyway. */
export function writePageSizeCookie(pageSize: number): void {
  document.cookie = `${PAGE_SIZE_COOKIE_NAME}=${pageSize}; path=/; max-age=${PAGE_SIZE_COOKIE_MAX_AGE}; samesite=lax`;
}
