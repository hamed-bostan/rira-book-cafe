import { OrderDetailSkeleton } from "@/src/presentation/dashboard/orders/OrderDetailSkeleton";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

export default function OrderDetailLoading() {
  return (
    <LoadingRegion className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {/* Back to orders. */}
        <Skeleton className="h-4 w-28 rounded-pill" />
        {/* Order number + placed-on, with the status badge at the inline-end. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-40 rounded-button sm:h-9 sm:w-48" />
            <Skeleton className="h-4 w-44 rounded-pill" />
          </div>
          <Skeleton className="h-6 w-20 rounded-pill" />
        </div>
        {/* Status actions. */}
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-32 rounded-button" />
          <Skeleton className="h-10 w-24 rounded-button" />
        </div>
      </div>

      <OrderDetailSkeleton />
    </LoadingRegion>
  );
}
