import { parseTopItemSort, rangeParams, selectedRangeOption } from "@/src/lib/api/analytics-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission } from "@/src/lib/require-permission";
import { reportsServerApi } from "@/src/presentation/dashboard/reports/report-server-api";
import { SalesReportScreen } from "@/src/presentation/dashboard/reports/SalesReportScreen";

// The report is read over the REST API (BFF) per request; the range and sort live
// in the query string. A malformed range is a 400 from the API, which surfaces via
// the dashboard error boundary.
export const dynamic = "force-dynamic";

type SalesReportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SalesReportPage({ searchParams }: SalesReportPageProps) {
  await requirePermission("reports.view");
  const params = toSearchParams(await searchParams);
  const forwarded = rangeParams(params);
  const report = await reportsServerApi.sales(forwarded);
  const { sort: _sort, ...range } = forwarded;

  return <SalesReportScreen report={report} selected={selectedRangeOption(params)} sort={parseTopItemSort(params)} keep={range} />;
}
