import { ReportHeaderSkeleton } from "@/src/presentation/dashboard/reports/ReportHeaderSkeleton";
import { ReportSectionSkeleton } from "@/src/presentation/dashboard/reports/ReportSectionSkeleton";
import { DashboardStatGridSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";

export default function GuestReportLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <ReportHeaderSkeleton />

      <DashboardStatGridSkeleton count={4} />

      {/* Top guests beside the events tile. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ReportSectionSkeleton rows={8} />
        <DashboardStatGridSkeleton count={1} className="sm:grid-cols-1 xl:grid-cols-1" />
      </div>
    </LoadingRegion>
  );
}
