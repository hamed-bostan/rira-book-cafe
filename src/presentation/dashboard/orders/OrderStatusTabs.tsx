import { getLocale, getTranslations } from "next-intl/server";

import {
  ADMIN_ORDER_STATUS_FILTERS,
  type AdminOrderStatusFilter,
  type OrderStatusCounts,
} from "@/src/domain/entities/AdminOrderFilters";
import { ORDER_STATUSES } from "@/src/domain/entities/Order";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

type OrderStatusTabsProps = {
  /** The status filter the page was rendered with; `undefined` is "All". */
  current: AdminOrderStatusFilter | undefined;
  counts: OrderStatusCounts;
  /** The page's query string, so switching tab keeps search and the other filters. */
  params: URLSearchParams;
};

/**
 * The status tabs along the top edge of the order list, each with how many orders
 * it holds. The chosen tab is underlined, like the landing page's active link.
 *
 * Plain links rather than a client widget: a tab is a URL, so it can be bookmarked
 * ("the ready shelf"), and switching re-runs the server render like any filter.
 */
export async function OrderStatusTabs({ current, counts, params }: OrderStatusTabsProps) {
  const t = await getTranslations("dashOrders");
  const locale = await getLocale();

  function hrefFor(status: AdminOrderStatusFilter | undefined): string {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (status) next.set("status", status);
    else next.delete("status");
    const query = next.toString();
    return query ? `/dashboard/orders?${query}` : "/dashboard/orders";
  }

  const tabs: { value: AdminOrderStatusFilter | undefined; label: string; count: number }[] = [
    { value: undefined, label: t("tabAll"), count: ORDER_STATUSES.reduce((sum, status) => sum + counts[status], 0) },
    ...ADMIN_ORDER_STATUS_FILTERS.map((status) => ({
      value: status,
      label: status === "active" ? t("tabActive") : t(`status.${status}`),
      count: counts[status],
    })),
  ];

  return (
    <nav
      aria-label={t("tabsLabel")}
      className="scrollbar-hide flex gap-6 overflow-x-auto border-b border-border bg-background px-4"
    >
      {tabs.map((tab) => {
        const selected = tab.value === current;
        return (
          <Link
            key={tab.value ?? "all"}
            href={hrefFor(tab.value)}
            aria-current={selected ? "page" : undefined}
            className={cn(
              // Equal top and bottom borders keep the label centred while only the
              // bottom one is ever coloured.
              "flex h-12 shrink-0 items-center gap-2 border-y-2 border-t-transparent text-body-default whitespace-nowrap transition-colors sm:text-body-small",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
              selected
                ? "border-b-primary font-semibold text-foreground"
                : "border-b-transparent font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "inline-flex h-5 min-w-6 items-center justify-center rounded-badge-md px-1.5 text-body-caption font-semibold tabular-nums",
                selected ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {formatNumber(tab.count, locale)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
