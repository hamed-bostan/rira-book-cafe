/** The report tabs, in the order they sit along the top. */
export const REPORT_TABS = ["sales", "payments", "guests"] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

/** Sales is the page the sidebar opens; the other two sit beside it. */
const TAB_PATH: Record<ReportTab, string> = {
  sales: "/dashboard/reports",
  payments: "/dashboard/reports/payments",
  guests: "/dashboard/reports/guests",
};

/** A report tab's URL with the given query — the range, and the tab's own options. */
export function reportHref(tab: ReportTab, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return query ? `${TAB_PATH[tab]}?${query}` : TAB_PATH[tab];
}
