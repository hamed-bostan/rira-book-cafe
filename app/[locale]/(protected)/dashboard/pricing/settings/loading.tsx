import { PricingTabsSkeleton } from "@/src/presentation/dashboard/pricing/PricingTabsSkeleton";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

export default function PricingSettingsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <PricingTabsSkeleton />

      {/* The settings card: markup, overhead source, months, expected units, rounding, save. */}
      <div className="flex max-w-xl flex-col gap-5 rounded-card-lg border border-border bg-background p-4 md:p-6">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-32 rounded-pill" />
          <Skeleton className="h-10 w-full max-w-32 rounded-input" />
          <Skeleton className="h-3.5 w-56 max-w-full rounded-pill" />
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="mb-1 h-4 w-36 rounded-pill" />
          <Skeleton className="h-14 w-full rounded-card-md" />
          <Skeleton className="h-14 w-full rounded-card-md" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28 rounded-pill" />
          <Skeleton className="h-10 w-full max-w-24 rounded-input" />
          <Skeleton className="h-3.5 w-56 max-w-full rounded-pill" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-32 rounded-pill" />
          <Skeleton className="h-10 w-full max-w-40 rounded-input" />
          <Skeleton className="h-3.5 w-56 max-w-full rounded-pill" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-24 rounded-pill" />
          <Skeleton className="h-10 w-full max-w-40 rounded-input" />
          <Skeleton className="h-3.5 w-56 max-w-full rounded-pill" />
        </div>

        <Skeleton className="h-11 w-24 rounded-button" />
      </div>
    </LoadingRegion>
  );
}
