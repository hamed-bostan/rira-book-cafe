import { KitchenBoardSkeleton } from "@/src/presentation/dashboard/kitchen/KitchenBoardSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

export default function KitchenLoading() {
  return (
    <LoadingRegion className="@container flex min-w-0 flex-col gap-4">
      {/* Title + subtitle. */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40 rounded-button sm:h-9 sm:w-48" />
        <Skeleton className="h-4 w-56 rounded-pill" />
      </div>

      <KitchenBoardSkeleton />
    </LoadingRegion>
  );
}
