import { ClipboardList, SearchX } from "lucide-react";
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
import { AutoRefresh } from "@/src/presentation/components/AutoRefresh";
import { BulkActionBar, BulkSelectionProvider } from "@/src/presentation/dashboard/bulk";
import {
  ListChoiceFilter,
  ListFilterReset,
  ListPager,
  ListSearchInput,
  ListSortSelect,
  type ListSortOption,
} from "@/src/presentation/dashboard/list";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";

import { OrderBulkActions } from "./OrderBulkActions";
import { OrdersTable } from "./OrdersTable";
import { OrderStatusTabs } from "./OrderStatusTabs";

/** How often an open order list re-reads — short enough that the counter sees new orders promptly. */
const REFRESH_SECONDS = 20;

/** The params the toolbar's filters write — what "Clear all" removes. The sort and tab stay. */
const FILTER_PARAMS = ["q", "service", "payment"];

type OrdersScreenProps = {
  orders: Page<Order>;
  counts: OrderStatusCounts;
  /** The filters this page was fetched with, to tell "no orders yet" from "no matches". */
  filters: AdminOrderFilters;
  /** The page's query string, for the status tabs' links. */
  params: URLSearchParams;
  /**
   * Whether the viewer may move orders along (`orders.fulfill`). Decides whether the
   * selection and row menus are drawn; the endpoints behind them check for themselves.
   */
  canFulfill: boolean;
};

/**
 * Dashboard order list. Presentational: the page fetches one page and the status
 * counts over the REST API (BFF) during server render. Search, tabs, filters,
 * sorting and paging all live in the URL; the list re-reads itself every few
 * seconds while open, and the row and bulk actions `router.refresh()`.
 */
export async function OrdersScreen({ orders, counts, filters, params, canFulfill }: OrdersScreenProps) {
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

      <BulkSelectionProvider ids={orders.items.map((order) => order.id)}>
        {canFulfill && orders.items.length > 0 ? (
          <BulkActionBar>
            <OrderBulkActions
              orders={orders.items.map(({ id, status, paymentStatus }) => ({ id, status, paymentStatus }))}
            />
          </BulkActionBar>
        ) : null}

        <OrdersTable
          orders={orders.items}
          canFulfill={canFulfill}
          tabs={<OrderStatusTabs current={filters.status} counts={counts} params={params} />}
          toolbar={
            <section aria-label={t("searchLabel")} className="flex min-w-0 flex-wrap items-center gap-2">
              <ListSearchInput
                label={t("searchLabel")}
                placeholder={t("searchPlaceholder")}
                className="min-w-0 flex-[1_1_20rem] sm:max-w-none"
              />
              <ListChoiceFilter
                paramName="service"
                label={t("filterService")}
                allLabel={t("filterAny")}
                showAllValue
                options={SERVICE_TYPES.map((service) => ({ value: service, label: t(`service.${service}`) }))}
              />
              <ListChoiceFilter
                paramName="payment"
                label={t("filterPayment")}
                allLabel={t("filterAny")}
                showAllValue
                options={PAYMENT_STATUSES.map((payment) => ({ value: payment, label: t(`payment.${payment}`) }))}
              />
              <ListSortSelect
                label={t("sortLabel")}
                triggerLabel={t("sortShort")}
                options={sortOptions}
                defaultSort={DEFAULT_ADMIN_ORDER_SORT}
                defaultDirection={DEFAULT_ADMIN_ORDER_DIRECTION}
              />
              <ListFilterReset
                label={t("clearAll")}
                paramNames={FILTER_PARAMS}
                icon={false}
                className="h-11 px-2 sm:h-10"
              />
            </section>
          }
          emptyState={
            <EmptyState
              icon={isFiltered ? SearchX : ClipboardList}
              title={isFiltered ? tList("noResultsTitle") : t("emptyTitle")}
              description={isFiltered ? tList("noResultsBody") : t("emptyBody")}
              action={
                isFiltered ? (
                  <Button asChild size="control-md" variant="outline">
                    <Link href="/dashboard/orders">{tList("clearFilters")}</Link>
                  </Button>
                ) : undefined
              }
            />
          }
          footer={<ListPager page={orders} />}
        />
      </BulkSelectionProvider>
    </div>
  );
}
