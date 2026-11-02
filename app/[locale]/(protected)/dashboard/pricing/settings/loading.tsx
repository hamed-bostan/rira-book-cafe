import { PricingTabsSkeleton } from "@/src/presentation/dashboard/pricing/PricingTabsSkeleton";
import { DashboardFieldSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

export default function PricingSettingsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <PricingTabsSkeleton />

      {/* The settings card: markup, overhead source, months, expected units, rounding, save. */}
      <div className="rounded-card-lg border border-border bg-background p-5 shadow-xs">
        <div className="flex max-w-md flex-col gap-5">
          <DashboardFieldSkeleton hint />

          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-48 rounded-pill" />
            <Skeleton className="h-16 w-full rounded-button" />
            <Skeleton className="h-16 w-full rounded-button" />
          </div>

          <DashboardFieldSkeleton hint />
          <DashboardFieldSkeleton hint />
          <DashboardFieldSkeleton hint />
          <Skeleton className="h-11 w-20 rounded-button sm:h-9" />
        </div>
      </div>
    </LoadingRegion>
  );
}
