import { Skeleton } from "@/src/presentation/design-system";

/**
 * Placeholder for `PricingTabs`: the page title and subtitle over the items /
 * ingredients / settings pills every pricing page leads with.
 */
export function PricingTabsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48 rounded-button sm:h-9 sm:w-56" />
        <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
      </div>
      <div className="flex gap-1 pb-1">
        <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
      </div>
    </div>
  );
}
