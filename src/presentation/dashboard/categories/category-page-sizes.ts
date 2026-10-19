import type { PageSizeChoices } from "../list/pageSizeCookie";

/** The categories list is short: smaller pages, and no 100-row option. Shared by the page and its pager. */
export const CATEGORY_PAGE_SIZES = { options: [10, 25, 50], defaultPageSize: 10 } as const satisfies PageSizeChoices;
