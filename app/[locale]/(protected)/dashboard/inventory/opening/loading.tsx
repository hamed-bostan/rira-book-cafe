import { StockLinesSkeleton } from "@/src/presentation/dashboard/inventory/StockLinesSkeleton";
import { PAGE_CARD } from "@/src/presentation/dashboard/pageStyles";
import { DashboardFieldSkeleton, DashboardPageHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

export default function OpeningStockLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={0} />
      <div className={`${PAGE_CARD} flex flex-col gap-5 p-5`}>
        <div className="max-w-48">
          <DashboardFieldSkeleton hint />
        </div>
        <StockLinesSkeleton />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-40 rounded-button sm:h-9" />
          <Skeleton className="h-11 w-20 rounded-button sm:h-9" />
        </div>
      </div>
    </LoadingRegion>
  );
}
