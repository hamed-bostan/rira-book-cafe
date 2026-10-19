import { parseAdminOrderFilters } from "@/src/lib/api/admin-order-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { withRememberedPageSize } from "@/src/presentation/dashboard/list/withRememberedPageSize";
import { ordersServerApi } from "@/src/presentation/dashboard/orders/order-server-api";
import { OrdersScreen } from "@/src/presentation/dashboard/orders/OrdersScreen";

// One page of orders and the status counts are fetched during server render over
// the REST API (BFF). Filters and paging live in the query string; the screen
// re-runs this render on an interval while open. A failed fetch surfaces via the
// dashboard error boundary. Reading orders needs only the dashboard (layout gate).
export const dynamic = "force-dynamic";

type DashboardOrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardOrdersPage({ searchParams }: DashboardOrdersPageProps) {
  const params = await withRememberedPageSize(toSearchParams(await searchParams));

  const [orders, counts] = await Promise.all([ordersServerApi.listPage(params), ordersServerApi.counts()]);

  return <OrdersScreen orders={orders} counts={counts} filters={parseAdminOrderFilters(params)} params={params} />;
}
