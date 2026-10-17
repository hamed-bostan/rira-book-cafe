import { StockLinesSkeleton } from "@/src/presentation/dashboard/inventory/StockLinesSkeleton";
import { DashboardHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

export default function ReceiveStockLoading() {
  return (
    <LoadingRegion className="flex max-w-4xl flex-col gap-6">
      <DashboardHeaderSkeleton />

      <div className="flex flex-col gap-5">
        {/* Date (with its formatted day) beside the supplier. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28 rounded-pill" />
          <Skeleton className="h-10 w-full rounded-input" />
        </div>

        <StockLinesSkeleton />

        {/* VAT, with its hint. */}
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-20 rounded-pill" />
          <Skeleton className="h-10 w-full max-w-48 rounded-input" />
          <Skeleton className="h-3.5 w-56 rounded-pill" />
        </div>

        {/* Payment: unpaid / cash / bank. */}
        <div className="flex flex-col gap-2">
          <Skeleton className="mb-1 h-4 w-24 rounded-pill" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-24 rounded-card-md" />
            <Skeleton className="h-10 w-24 rounded-card-md" />
            <Skeleton className="h-10 w-24 rounded-card-md" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Skeleton className="h-11 w-28 rounded-button" />
          <Skeleton className="h-11 w-24 rounded-button" />
        </div>
      </div>
    </LoadingRegion>
  );
}
