import { KitchenBoardSkeleton } from "@/src/presentation/dashboard/kitchen/KitchenBoardSkeleton";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

export default function KitchenLoading() {
  return (
    <LoadingRegion className="@container flex min-w-0 flex-col gap-4">
      {/* Title + subtitle beside the all / bar / kitchen station switch. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40 rounded-button sm:h-9 sm:w-48" />
          <Skeleton className="h-4 w-56 rounded-pill" />
        </div>
        <Skeleton className="h-10 w-60 rounded-full" />
      </div>

      <KitchenBoardSkeleton />
    </LoadingRegion>
  );
}
