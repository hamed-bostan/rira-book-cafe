/** The report tabs, in the order they sit along the top. */
export const REPORT_TABS = ["sales", "payments", "guests"] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

/** Sales is the page the sidebar opens; the other two sit beside it. */
const TAB_PATH: Record<ReportTab, string> = {
  sales: "/dashboard/reports",
  payments: "/dashboard/reports/payments",
  guests: "/dashboard/reports/guests",
};

/** The query params that say which days a report covers. */
const RANGE_KEYS = ["range", "from", "to"] as const;

/** A report tab's URL with the given query — the range, and the tab's own options. */
export function reportHref(tab: ReportTab, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return query ? `${TAB_PATH[tab]}?${query}` : TAB_PATH[tab];
}

/** `query` with its days replaced by `range` — a preset or a span — keeping every other option. */
export function withRange(query: Record<string, string>, range: Record<string, string>): Record<string, string> {
  const rest = Object.fromEntries(
    Object.entries(query).filter(([key]) => !(RANGE_KEYS as readonly string[]).includes(key)),
  );
  return { ...rest, ...range };
}
