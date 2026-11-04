import { StockLinesSkeleton } from "@/src/presentation/dashboard/inventory/StockLinesSkeleton";
import { PAGE_CARD } from "@/src/presentation/dashboard/pageStyles";
import { DashboardFieldSkeleton, DashboardPageHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Mirrors `SupplierReturnForm`: date, supplier and delivery, the lines, the credit, and the buttons. */
export default function NewSupplierReturnLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={0} />
      <div className={`${PAGE_CARD} flex flex-col gap-5 p-5`}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-4">
          <DashboardFieldSkeleton />
          <DashboardFieldSkeleton />
          <DashboardFieldSkeleton hint />
        </div>
        <StockLinesSkeleton />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-4">
          <DashboardFieldSkeleton hint />
          <DashboardFieldSkeleton />
          <DashboardFieldSkeleton hint />
        </div>
        <DashboardFieldSkeleton />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-32 rounded-button sm:h-9" />
          <Skeleton className="h-11 w-20 rounded-button sm:h-9" />
        </div>
      </div>
    </LoadingRegion>
  );
}
