import { StockLinesSkeleton } from "@/src/presentation/dashboard/inventory/StockLinesSkeleton";
import { DashboardHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

export default function OpeningStockLoading() {
  return (
    <LoadingRegion className="flex max-w-4xl flex-col gap-6">
      <DashboardHeaderSkeleton />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-16 rounded-pill" />
          <Skeleton className="h-10 w-full max-w-48 rounded-input" />
          <Skeleton className="h-3.5 w-24 rounded-pill" />
        </div>

        <StockLinesSkeleton />

        <div className="flex gap-3 pt-2">
          <Skeleton className="h-11 w-28 rounded-button" />
          <Skeleton className="h-11 w-24 rounded-button" />
        </div>
      </div>
    </LoadingRegion>
  );
}
