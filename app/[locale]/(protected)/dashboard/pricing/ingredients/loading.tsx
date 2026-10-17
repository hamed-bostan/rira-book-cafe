import { PricingTabsSkeleton } from "@/src/presentation/dashboard/pricing/PricingTabsSkeleton";
import { DashboardTableSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

export default function IngredientsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <PricingTabsSkeleton />

      {/* New ingredient. */}
      <Skeleton className="h-10 w-36 rounded-button" />

      {/* Name · bought · unit cost · edit. */}
      <DashboardTableSkeleton toolbar={false} pager={false} columns={4} rows={10} />
    </LoadingRegion>
  );
}
