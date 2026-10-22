import { auth } from "@/auth";
import { TOP_ITEM_SORTS, type TopItemSort } from "@/src/domain/entities/Analytics";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { sessionHas } from "@/src/lib/require-permission";
import { DashboardOverviewScreen } from "@/src/presentation/dashboard/DashboardOverviewScreen";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { ordersServerApi } from "@/src/presentation/dashboard/orders/order-server-api";
import { TOP_ITEMS_PARAM } from "@/src/presentation/dashboard/overview/TopItemsPanel";
import { reportsServerApi } from "@/src/presentation/dashboard/reports/report-server-api";
import { reservationsServerApi } from "@/src/presentation/dashboard/reservations/reservation-server-api";

// The overview is read over the REST API (BFF) per request. The operational
// numbers, the order queue and today's bookings are for everyone with the
// dashboard; the week's sales are fetched only for viewers who may see revenue
// (`reports.view`) — the endpoint would refuse anyone else anyway.
export const dynamic = "force-dynamic";

/** Enough of the queue to count long waits and placed/preparing; the card lists fewer. */
const QUEUE_FETCH = 50;

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const requested = (await searchParams)[TOP_ITEMS_PARAM];
  const topSort: TopItemSort = (TOP_ITEM_SORTS as readonly unknown[]).includes(requested)
    ? (requested as TopItemSort)
    : "revenue";

  const session = await auth();
  const [canViewReports, canViewStock, canFulfill, canManageReservations] = await Promise.all([
    sessionHas(session, "reports.view"),
    sessionHas(session, "inventory.view"),
    sessionHas(session, "orders.fulfill"),
    sessionHas(session, "reservations.manage"),
  ]);

  const now = new Date();
  const [overview, queue, reservations, week, stock] = await Promise.all([
    reportsServerApi.overview(),
    ordersServerApi.listPage(
      new URLSearchParams({ status: "active", sort: "placedAt", dir: "asc", pageSize: String(QUEUE_FETCH) }),
    ),
    reservationsServerApi.listForDay(cafeDayOf(now)),
    canViewReports ? reportsServerApi.sales({ range: "7d", sort: topSort }) : Promise.resolve(null),
    // Low and empty stock is everyone-on-the-floor's business, shown at the top.
    canViewStock ? inventoryServerApi.getSummary() : Promise.resolve(null),
  ]);

  return (
    <DashboardOverviewScreen
      overview={overview}
      queue={queue}
      reservations={reservations}
      week={week}
      topSort={topSort}
      stockItems={stock?.items ?? []}
      now={now.toISOString()}
      canFulfill={canFulfill}
      canManageReservations={canManageReservations}
    />
  );
}
