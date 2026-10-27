import { dateToWallTime } from "@/src/domain/entities/CafeTime";
import { parseTopItemSort, rangeParams, selectedRangeOption } from "@/src/lib/api/analytics-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission } from "@/src/lib/require-permission";
import { reportsServerApi } from "@/src/presentation/dashboard/reports/report-server-api";
import { SalesReportScreen } from "@/src/presentation/dashboard/reports/SalesReportScreen";

// Reports open on Sales. The report is read over the REST API (BFF) per request;
// the range and the best-sellers ranking live in the query string. A malformed
// range is a 400 from the API, which surfaces via the dashboard error boundary.
export const dynamic = "force-dynamic";

type SalesReportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SalesReportPage({ searchParams }: SalesReportPageProps) {
  await requirePermission("reports.view");
  const params = toSearchParams(await searchParams);
  const forwarded = rangeParams(params);
  const report = await reportsServerApi.sales(forwarded);
  const { sort: _sort, ...rangeQuery } = forwarded;
  // "YYYY-MM-DDTHH:mm" on the cafe's clock — which bar is still filling up.
  const wallTime = dateToWallTime(new Date());

  return (
    <SalesReportScreen
      report={report}
      selected={selectedRangeOption(params)}
      sort={parseTopItemSort(params)}
      rangeQuery={rangeQuery}
      now={{ day: wallTime.slice(0, 10), hour: Number(wallTime.slice(11, 13)) }}
    />
  );
}
