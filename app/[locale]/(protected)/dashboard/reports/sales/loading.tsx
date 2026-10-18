import { ReportHeaderSkeleton } from "@/src/presentation/dashboard/reports/ReportHeaderSkeleton";
import { ReportSectionSkeleton } from "@/src/presentation/dashboard/reports/ReportSectionSkeleton";
import { DashboardStatGridSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system";

export default function SalesReportLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <ReportHeaderSkeleton />

      <DashboardStatGridSkeleton count={4} />

      {/* Daily sales (220px chart) with its revenue / orders toggle. */}
      <ReportSectionSkeleton action="toggle" chartClassName="h-55" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Orders by hour (180px chart). */}
        <ReportSectionSkeleton description chartClassName="h-45" />
        <div className="flex flex-col gap-6">
          <ReportSectionSkeleton bars={3} />
          <ReportSectionSkeleton bars={3} />
        </div>
      </div>

      <ReportSectionSkeleton action="links" rows={8} />
    </LoadingRegion>
  );
}
