import { auth } from "@/auth";
import { sessionHas } from "@/src/lib/require-permission";
import { DashboardOverviewScreen } from "@/src/presentation/dashboard/DashboardOverviewScreen";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { reportsServerApi } from "@/src/presentation/dashboard/reports/report-server-api";

// The overview is read over the REST API (BFF) per request. The operational
// numbers are for everyone with the dashboard; the week's sales are fetched only
// for viewers who may see revenue (`reports.view`) — the endpoint would refuse
// anyone else anyway.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const [canViewReports, canViewStock] = await Promise.all([sessionHas(session, "reports.view"), sessionHas(session, "inventory.view")]);

  const [overview, week, stock] = await Promise.all([
    reportsServerApi.overview(),
    canViewReports ? reportsServerApi.sales({ range: "7d", sort: "revenue" }) : Promise.resolve(null),
    // Low and empty stock is everyone-on-the-floor's business, shown at the top.
    canViewStock ? inventoryServerApi.getSummary() : Promise.resolve(null),
  ]);

  return <DashboardOverviewScreen overview={overview} week={week} stockItems={stock?.items ?? []} />;
}
