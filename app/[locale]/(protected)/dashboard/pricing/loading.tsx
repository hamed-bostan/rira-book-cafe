import { PricingTabsSkeleton } from "@/src/presentation/dashboard/pricing/PricingTabsSkeleton";
import { DashboardStatGridSkeleton, DashboardTableSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

export default function PricingLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <PricingTabsSkeleton />

      {/* Monthly overhead · monthly units · overhead per unit. */}
      <DashboardStatGridSkeleton count={3} className="sm:grid-cols-3 xl:grid-cols-3" />

      {/* The formula line. */}
      <Skeleton className="h-4 w-full max-w-xl rounded-pill" />

      {/* Item · ingredients · overhead · full cost · profit · suggested · current · earns now. */}
      <DashboardTableSkeleton toolbar={false} pager={false} columns={8} rows={10} />
    </LoadingRegion>
  );
}
