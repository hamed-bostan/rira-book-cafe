import { auth } from "@/auth";
import { MAX_PAGE_SIZE } from "@/src/domain/entities/Pagination";
import { sessionHas } from "@/src/lib/require-permission";
import { KitchenScreen } from "@/src/presentation/dashboard/kitchen/KitchenScreen";
import { ordersServerApi } from "@/src/presentation/dashboard/orders/order-server-api";

// The live queue, fetched over the REST API (BFF) during server render and
// re-fetched by the board's own refresh.
export const dynamic = "force-dynamic";

export default async function DashboardKitchenPage() {
  const [page, canFulfill] = await Promise.all([
    // Every active order, oldest first — a working queue fits one page.
    ordersServerApi.listPage(
      new URLSearchParams({ status: "active", sort: "placedAt", dir: "asc", pageSize: String(MAX_PAGE_SIZE) }),
    ),
    auth().then((session) => sessionHas(session, "orders.fulfill")),
  ]);

  return <KitchenScreen orders={page.items} now={new Date().toISOString()} canFulfill={canFulfill} />;
}
