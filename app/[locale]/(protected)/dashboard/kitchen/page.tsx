import { auth } from "@/auth";
import { KITCHEN_STATIONS, type KitchenStation } from "@/src/domain/entities/Kitchen";
import { MAX_PAGE_SIZE } from "@/src/domain/entities/Pagination";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { sessionHas } from "@/src/lib/require-permission";
import { KitchenScreen } from "@/src/presentation/dashboard/kitchen/KitchenScreen";
import { ordersServerApi } from "@/src/presentation/dashboard/orders/order-server-api";

// The live queue, fetched over the REST API (BFF) during server render and
// re-fetched by the board's own refresh. The station (`?station=`) lives in the URL.
export const dynamic = "force-dynamic";

type DashboardKitchenPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STATION_SET = new Set<string>(KITCHEN_STATIONS);

export default async function DashboardKitchenPage({ searchParams }: DashboardKitchenPageProps) {
  const params = toSearchParams(await searchParams);
  const stationParam = params.get("station");
  const station = stationParam && STATION_SET.has(stationParam) ? (stationParam as KitchenStation) : "all";

  const [page, canFulfill] = await Promise.all([
    // Every active order, oldest first — a working queue fits one page.
    ordersServerApi.listPage(new URLSearchParams({ status: "active", sort: "placedAt", dir: "asc", pageSize: String(MAX_PAGE_SIZE) })),
    auth().then((session) => sessionHas(session, "orders.fulfill")),
  ]);

  return <KitchenScreen orders={page.items} station={station} now={new Date().toISOString()} canFulfill={canFulfill} />;
}
