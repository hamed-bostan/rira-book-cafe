import { KitchenBoardSkeleton } from "@/src/presentation/dashboard/kitchen/KitchenBoardSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

export default function KitchenLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        {/* Title + subtitle. */}
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-7 w-40 rounded-button lg:h-8 lg:w-48" />
          <Skeleton className="h-5 w-72 max-w-full rounded-pill" />
        </div>
        {/* "Live · 11:42 AM" + the full-screen button. */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-24 rounded-pill" />
          <Skeleton className="h-11 w-32 rounded-button sm:h-9" />
        </div>
      </div>

      <KitchenBoardSkeleton />
    </LoadingRegion>
  );
}
