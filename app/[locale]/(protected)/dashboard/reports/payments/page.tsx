import { rangeParams, selectedRangeOption } from "@/src/lib/api/analytics-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission } from "@/src/lib/require-permission";
import { PaymentReportScreen } from "@/src/presentation/dashboard/reports/PaymentReportScreen";
import { reportsServerApi } from "@/src/presentation/dashboard/reports/report-server-api";

export const dynamic = "force-dynamic";

type PaymentReportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaymentReportPage({ searchParams }: PaymentReportPageProps) {
  await requirePermission("reports.view");
  const params = toSearchParams(await searchParams);
  const report = await reportsServerApi.payments(rangeParams(params));

  return <PaymentReportScreen report={report} selected={selectedRangeOption(params)} />;
}
