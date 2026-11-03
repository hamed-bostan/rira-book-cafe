import { auth } from "@/auth";
import { TOP_ITEM_SORTS, type TopItemSort } from "@/src/domain/entities/Analytics";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { sessionHas } from "@/src/lib/require-permission";
import { DashboardOverviewScreen } from "@/src/presentation/dashboard/DashboardOverviewScreen";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { ordersServerApi } from "@/src/presentation/dashboard/orders/order-server-api";
import { readOrNull } from "@/src/presentation/dashboard/overview/readOrNull";
import { TOP_ITEMS_PARAM } from "@/src/presentation/dashboard/overview/TopItemsPanel";
import { reportsServerApi } from "@/src/presentation/dashboard/reports/report-server-api";
import { reservationsServerApi } from "@/src/presentation/dashboard/reservations/reservation-server-api";

// The overview is read over the REST API (BFF) per request. The operational
// numbers, the order queue and today's bookings are for everyone with the
// dashboard; the week's sales are fetched only for viewers who may see revenue
// (`reports.view`) — the endpoint would refuse anyone else anyway.
//
// The five reads stand apart: one failing blanks only the parts drawn from it,
// each with its own retry, and the rest of the page renders. None is the page's
// backbone — the date in the header is today's, worked out here — so the route's
// error boundary is left for what the page can't do without: the session and
// its permissions, and rendering itself.
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
  const today = cafeDayOf(now);
  const [overview, queue, reservations, week, stock] = await Promise.all([
    readOrNull(reportsServerApi.overview()),
    readOrNull(
      ordersServerApi.listPage(
        new URLSearchParams({ status: "active", sort: "placedAt", dir: "asc", pageSize: String(QUEUE_FETCH) }),
      ),
    ),
    readOrNull(reservationsServerApi.listForDay(today)),
    canViewReports ? readOrNull(reportsServerApi.sales({ range: "7d", sort: topSort })) : null,
    // Low and empty stock is everyone-on-the-floor's business, shown at the top.
    canViewStock ? readOrNull(inventoryServerApi.getSummary().then((summary) => summary.items)) : [],
  ]);

  return (
    <DashboardOverviewScreen
      today={today}
      overview={overview}
      queue={queue}
      reservations={reservations}
      canViewReports={canViewReports}
      week={week}
      topSort={topSort}
      stockItems={stock}
      now={now.toISOString()}
      canFulfill={canFulfill}
      canManageReservations={canManageReservations}
    />
  );
}
