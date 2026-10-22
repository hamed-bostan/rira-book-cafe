/**
 * The menu list's "Show" filter: a view the screen offers over two of the admin
 * product list's filters. "Low or out of stock" is `stock=needsRestock`; "Hidden
 * from menu" is `visibility=unpublished`. The URL carries one `show` param, and
 * the page turns it into the API's own vocabulary before fetching.
 */
export const MENU_ITEM_SHOWS = ["attention", "hidden"] as const;
export type MenuItemShow = (typeof MENU_ITEM_SHOWS)[number];

/** The `show` param's value, or `undefined` for "Everything" (absent or unrecognised). */
export function parseMenuItemShow(value: string | null): MenuItemShow | undefined {
  return MENU_ITEM_SHOWS.find((show) => show === value);
}

/** Filters an older link may carry that this screen no longer draws a control for. */
const RETIRED_PARAMS = ["kind", "stock", "visibility"] as const;

/**
 * The `GET /api/admin/products` params for the menu list's URL: `show` becomes
 * the filter it stands for. Filters the screen has no control for are dropped,
 * so the rows never answer to a filter nobody can see or clear.
 */
export function menuItemListParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  const show = parseMenuItemShow(next.get("show"));
  next.delete("show");
  for (const name of RETIRED_PARAMS) next.delete(name);
  if (show === "attention") next.set("stock", "needsRestock");
  if (show === "hidden") next.set("visibility", "unpublished");
  return next;
}
