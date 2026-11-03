import { auth } from "@/auth";
import { parseAdminOrderFilters } from "@/src/lib/api/admin-order-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { sessionHas } from "@/src/lib/require-permission";
import { withRememberedPageSize } from "@/src/presentation/dashboard/list/withRememberedPageSize";
import { onlinePaymentsServerApi } from "@/src/presentation/dashboard/orders/online-payment-server-api";
import { ordersServerApi } from "@/src/presentation/dashboard/orders/order-server-api";
import { OrdersScreen } from "@/src/presentation/dashboard/orders/OrdersScreen";

// One page of orders, the status counts and the online payments still to give back
// are fetched during server render over the REST API (BFF). Filters and paging live
// in the query string; the screen re-runs this render on an interval while open. A
// failed fetch surfaces via the dashboard error boundary. Reading orders needs only
// the dashboard (layout gate); whether the row and bulk actions are drawn is
// `orders.fulfill`, resolved here.
export const dynamic = "force-dynamic";

type DashboardOrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardOrdersPage({ searchParams }: DashboardOrdersPageProps) {
  const params = await withRememberedPageSize(toSearchParams(await searchParams));

  const [orders, counts, unappliedPayments, canFulfill] = await Promise.all([
    ordersServerApi.listPage(params),
    ordersServerApi.counts(),
    onlinePaymentsServerApi.listUnapplied(),
    auth().then((session) => sessionHas(session, "orders.fulfill")),
  ]);

  return (
    <OrdersScreen
      orders={orders}
      counts={counts}
      unappliedPayments={unappliedPayments}
      filters={parseAdminOrderFilters(params)}
      params={params}
      canFulfill={canFulfill}
    />
  );
}
