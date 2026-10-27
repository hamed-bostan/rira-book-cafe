import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { rangeParams, selectedRangeOption } from "@/src/lib/api/analytics-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { PaymentReportScreen } from "@/src/presentation/dashboard/reports/PaymentReportScreen";
import { reportsServerApi } from "@/src/presentation/dashboard/reports/report-server-api";

export const dynamic = "force-dynamic";

type PaymentReportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaymentReportPage({ searchParams }: PaymentReportPageProps) {
  await requirePermission("reports.view");
  const params = toSearchParams(await searchParams);
  const { sort: _sort, ...rangeQuery } = rangeParams(params);
  // Marking an order paid is the orders' own permission; without it the list is read-only.
  const [report, canMarkPaid] = await Promise.all([
    reportsServerApi.payments(rangeQuery),
    auth().then((session) => sessionHas(session, "orders.fulfill")),
  ]);

  return (
    <PaymentReportScreen
      report={report}
      selected={selectedRangeOption(params)}
      rangeQuery={rangeQuery}
      today={cafeDayOf(new Date())}
      canMarkPaid={canMarkPaid}
    />
  );
}
