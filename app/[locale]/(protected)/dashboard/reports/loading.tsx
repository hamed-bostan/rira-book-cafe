import { MetricGridSkeleton } from "@/src/presentation/dashboard/reports/MetricGridSkeleton";
import { ReportPanelSkeleton } from "@/src/presentation/dashboard/reports/ReportPanelSkeleton";
import { ReportsFrameSkeleton } from "@/src/presentation/dashboard/reports/ReportsFrameSkeleton";

/** Mirrors the Sales tab: four figures, the chart, then best sellers beside drinks / food / books. */
export default function SalesReportLoading() {
  return (
    <ReportsFrameSkeleton>
      <MetricGridSkeleton count={4} className="sm:grid-cols-2 xl:grid-cols-4" />
      <ReportPanelSkeleton body="chart" action />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ReportPanelSkeleton body="ranked" count={6} action />
        <ReportPanelSkeleton body="shares" />
      </div>
    </ReportsFrameSkeleton>
  );
}
