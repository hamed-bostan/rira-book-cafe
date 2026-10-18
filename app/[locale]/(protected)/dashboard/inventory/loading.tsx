import { DashboardStatGridSkeleton, DashboardTableSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

export default function InventoryLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      {/* Title + subtitle beside the movements / count / receive buttons. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40 rounded-button sm:h-9 sm:w-48" />
          <Skeleton className="h-4 w-56 rounded-pill" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-28 rounded-button" />
          <Skeleton className="h-10 w-28 rounded-button" />
          <Skeleton className="h-10 w-28 rounded-button" />
        </div>
      </div>

      <DashboardStatGridSkeleton count={3} className="sm:grid-cols-3 xl:grid-cols-3" />

      {/* All / low / out chips. */}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-16 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>

      <DashboardTableSkeleton toolbar={false} pager={false} columns={6} rows={8} />

      <Skeleton className="h-3.5 w-64 rounded-pill" />
    </LoadingRegion>
  );
}
