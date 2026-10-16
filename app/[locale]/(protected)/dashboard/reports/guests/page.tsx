import { rangeParams, selectedRangeOption } from "@/src/lib/api/analytics-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission } from "@/src/lib/require-permission";
import { GuestReportScreen } from "@/src/presentation/dashboard/reports/GuestReportScreen";
import { reportsServerApi } from "@/src/presentation/dashboard/reports/report-server-api";

export const dynamic = "force-dynamic";

type GuestReportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GuestReportPage({ searchParams }: GuestReportPageProps) {
  await requirePermission("reports.view");
  const params = toSearchParams(await searchParams);
  const report = await reportsServerApi.guests(rangeParams(params));

  return <GuestReportScreen report={report} selected={selectedRangeOption(params)} />;
}
