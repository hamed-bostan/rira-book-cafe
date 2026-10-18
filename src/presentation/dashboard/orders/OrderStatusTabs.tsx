import { getTranslations } from "next-intl/server";

import {
  ADMIN_ORDER_STATUS_FILTERS,
  type AdminOrderStatusFilter,
  type OrderStatusCounts,
} from "@/src/domain/entities/AdminOrderFilters";
import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

type OrderStatusTabsProps = {
  /** The status filter the page was rendered with; `undefined` is "All". */
  current: AdminOrderStatusFilter | undefined;
  counts: OrderStatusCounts;
  /** The page's query string, so switching tab keeps search and the other filters. */
  params: URLSearchParams;
};

/**
 * The status tabs above the order list, each with how many orders it holds.
 * Plain links rather than a client widget: a tab is a URL, so it can be bookmarked
 * ("the ready shelf"), and switching re-runs the server render like any filter.
 */
export async function OrderStatusTabs({ current, counts, params }: OrderStatusTabsProps) {
  const t = await getTranslations("dashOrders");

  function hrefFor(status: AdminOrderStatusFilter | undefined): string {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (status) next.set("status", status);
    else next.delete("status");
    const query = next.toString();
    return query ? `/dashboard/orders?${query}` : "/dashboard/orders";
  }

  const tabs: { value: AdminOrderStatusFilter | undefined; label: string; count?: number }[] = [
    { value: undefined, label: t("tabAll") },
    ...ADMIN_ORDER_STATUS_FILTERS.map((status) => ({
      value: status,
      label: status === "active" ? t("tabActive") : t(`status.${status}`),
      count: counts[status],
    })),
  ];

  return (
    <nav aria-label={t("tabsLabel")} className="scrollbar-hide flex gap-2 overflow-x-auto">
      {tabs.map((tab) => {
        const selected = tab.value === current;
        return (
          <Link
            key={tab.value ?? "all"}
            href={hrefFor(tab.value)}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-button-default-medium whitespace-nowrap transition-colors",
              focusRing,
              selected ? "border-primary bg-accent text-primary" : "border-border text-foreground hover:bg-muted",
            )}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="text-muted-foreground tabular-nums">{tab.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
