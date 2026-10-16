import { getTranslations } from "next-intl/server";

import {
  DEFAULT_ADMIN_ORDER_DIRECTION,
  DEFAULT_ADMIN_ORDER_SORT,
  hasAdminOrderFilters,
  type AdminOrderFilters,
  type AdminOrderSort,
  type OrderStatusCounts,
} from "@/src/domain/entities/AdminOrderFilters";
import { PAYMENT_STATUSES, SERVICE_TYPES, type Order } from "@/src/domain/entities/Order";
import type { Page } from "@/src/domain/entities/Pagination";
import { Link } from "@/src/i18n/navigation";
import {
  ListFilterSelect,
  ListPager,
  ListSearchInput,
  ListSortSelect,
  type ListSortOption,
} from "@/src/presentation/dashboard/list";

import { AutoRefresh } from "./AutoRefresh";
import { OrdersTable } from "./OrdersTable";
import { OrderStatusTabs } from "./OrderStatusTabs";

/** How often an open order list re-reads — short enough that the counter sees new orders promptly. */
const REFRESH_SECONDS = 20;

type OrdersScreenProps = {
  orders: Page<Order>;
  counts: OrderStatusCounts;
  /** The filters this page was fetched with, to tell "no orders yet" from "no matches". */
  filters: AdminOrderFilters;
  /** The page's query string, for the status tabs' links. */
  params: URLSearchParams;
};

/**
 * Dashboard order list. Presentational: the page fetches one page and the status
 * counts over the REST API (BFF) during server render. Search, tabs, filters,
 * sorting and paging all live in the URL; the list re-reads itself every few
 * seconds while open, and the detail screen's actions `router.refresh()`.
 */
export async function OrdersScreen({ orders, counts, filters, params }: OrdersScreenProps) {
  const t = await getTranslations("dashOrders");
  const tList = await getTranslations("dashList");
  const isFiltered = hasAdminOrderFilters(filters);

  const sortOptions: ListSortOption<AdminOrderSort>[] = [
    { sort: "placedAt", direction: "desc", label: t("sortNewest") },
    { sort: "placedAt", direction: "asc", label: t("sortOldest") },
    { sort: "total", direction: "desc", label: t("sortTotalHigh") },
    { sort: "total", direction: "asc", label: t("sortTotalLow") },
  ];

  return (
    <div className="@container flex min-w-0 flex-col gap-4 sm:gap-6">
      <AutoRefresh intervalSeconds={REFRESH_SECONDS} />

      <div className="min-w-0 space-y-1">
        <h1 className="dashboard-page-title">{t("heading")}</h1>
        <p className="text-body-small text-muted-foreground">{t("activeSummary", { count: counts.active })}</p>
      </div>

      <OrderStatusTabs current={filters.status} counts={counts} params={params} />

      <OrdersTable
        orders={orders.items}
        toolbar={(
          <section aria-label={t("searchLabel")} className="min-w-0 space-y-3">
            <div className="flex min-w-0 flex-col gap-3 @min-[36rem]:flex-row @min-[36rem]:items-center">
              <ListSearchInput
                label={t("searchLabel")}
                placeholder={t("searchPlaceholder")}
                className="min-w-0 flex-1 sm:max-w-none [&_input]:h-11 sm:[&_input]:h-10"
              />
              <div className="min-w-0 shrink-0 [&_select]:min-h-11 [&_select]:w-full">
                <ListSortSelect
                  label={t("sortLabel")}
                  options={sortOptions}
                  defaultSort={DEFAULT_ADMIN_ORDER_SORT}
                  defaultDirection={DEFAULT_ADMIN_ORDER_DIRECTION}
                />
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-2 border-t border-border pt-3 @sm:grid-cols-2">
              <ListFilterSelect
                className="h-11 w-full min-w-0 truncate"
                paramName="service"
                label={t("filterServiceLabel")}
                options={[
                  { value: "", label: t("filterServiceOption", { service: t("filterServiceAll") }) },
                  ...SERVICE_TYPES.map((service) => ({
                    value: service,
                    label: t("filterServiceOption", { service: t(`service.${service}`) }),
                  })),
                ]}
              />
              <ListFilterSelect
                className="h-11 w-full min-w-0 truncate"
                paramName="payment"
                label={t("filterPaymentLabel")}
                options={[
                  { value: "", label: t("filterPaymentOption", { payment: t("filterPaymentAll") }) },
                  ...PAYMENT_STATUSES.map((payment) => ({
                    value: payment,
                    label: t("filterPaymentOption", { payment: t(`payment.${payment}`) }),
                  })),
                ]}
              />
            </div>
          </section>
        )}
        emptyState={(
          <div className="px-6 py-16 text-center">
            <p className="text-body-strong text-foreground">{isFiltered ? tList("noResultsTitle") : t("emptyTitle")}</p>
            <p className="mt-1 text-body-small text-muted-foreground">{isFiltered ? tList("noResultsBody") : t("emptyBody")}</p>
            {isFiltered ? (
              <Link
                href="/dashboard/orders"
                className="mt-4 inline-flex min-h-11 items-center rounded-button px-4 text-body-small-emphasis text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {tList("clearFilters")}
              </Link>
            ) : null}
          </div>
        )}
        footer={<ListPager page={orders} />}
      />
    </div>
  );
}
