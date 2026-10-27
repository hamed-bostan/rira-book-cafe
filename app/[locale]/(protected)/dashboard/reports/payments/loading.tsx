import { MetricGridSkeleton } from "@/src/presentation/dashboard/reports/MetricGridSkeleton";
import { ReportPanelSkeleton } from "@/src/presentation/dashboard/reports/ReportPanelSkeleton";
import { ReportsFrameSkeleton } from "@/src/presentation/dashboard/reports/ReportsFrameSkeleton";

/** Mirrors the Payments tab: paid and unpaid, then how it was paid beside the orders still owed. */
export default function PaymentReportLoading() {
  return (
    <ReportsFrameSkeleton>
      <MetricGridSkeleton count={2} className="sm:grid-cols-2" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ReportPanelSkeleton body="shares" />
        <ReportPanelSkeleton body="rows" count={4} />
      </div>
    </ReportsFrameSkeleton>
  );
}
