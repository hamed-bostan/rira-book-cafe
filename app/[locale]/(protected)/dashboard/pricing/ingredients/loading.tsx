import { PricingTabsSkeleton } from "@/src/presentation/dashboard/pricing/PricingTabsSkeleton";
import { DashboardTableSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";

export default function IngredientsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <PricingTabsSkeleton />

      {/* Name · bought · unit cost · edit. */}
      <DashboardTableSkeleton toolbar={false} pager={false} columns={4} rows={10} />
    </LoadingRegion>
  );
}
