import { ReportHeaderSkeleton } from "@/src/presentation/dashboard/reports/ReportHeaderSkeleton";
import { ReportSectionSkeleton } from "@/src/presentation/dashboard/reports/ReportSectionSkeleton";
import { DashboardStatGridSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";

export default function PaymentReportLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <ReportHeaderSkeleton />

      <DashboardStatGridSkeleton count={2} className="xl:grid-cols-2" />

      {/* Paid / unpaid split. */}
      <ReportSectionSkeleton bars={2} />

      {/* Unpaid orders. */}
      <ReportSectionSkeleton description rows={5} />
    </LoadingRegion>
  );
}
