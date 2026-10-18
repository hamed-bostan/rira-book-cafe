import { DashboardHeaderSkeleton, DashboardTableSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

export default function StockCountLoading() {
  return (
    <LoadingRegion className="flex max-w-4xl flex-col gap-6">
      <DashboardHeaderSkeleton />

      <div className="flex flex-col gap-5">
        {/* Date (with its formatted day) beside the note. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[12rem_1fr]">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-16 rounded-pill" />
            <Skeleton className="h-10 w-full rounded-input" />
            <Skeleton className="h-3.5 w-24 rounded-pill" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-20 rounded-pill" />
            <Skeleton className="h-10 w-full rounded-input" />
          </div>
        </div>

        {/* Item · expected · counted · difference. */}
        <DashboardTableSkeleton toolbar={false} pager={false} columns={4} rows={8} />

        <div className="flex gap-3">
          <Skeleton className="h-11 w-32 rounded-button" />
          <Skeleton className="h-11 w-24 rounded-button" />
        </div>
      </div>
    </LoadingRegion>
  );
}
