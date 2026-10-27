import { MetricGridSkeleton } from "@/src/presentation/dashboard/reports/MetricGridSkeleton";
import { ReportPanelSkeleton } from "@/src/presentation/dashboard/reports/ReportPanelSkeleton";
import { ReportsFrameSkeleton } from "@/src/presentation/dashboard/reports/ReportsFrameSkeleton";

/** Mirrors the Guests tab: four figures, then the top guests. */
export default function GuestReportLoading() {
  return (
    <ReportsFrameSkeleton>
      <MetricGridSkeleton count={4} className="sm:grid-cols-2 xl:grid-cols-4" />
      <ReportPanelSkeleton body="rows" count={5} />
    </ReportsFrameSkeleton>
  );
}
