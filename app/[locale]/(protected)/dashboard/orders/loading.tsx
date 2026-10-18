import { OrdersTableSkeleton } from "@/src/presentation/dashboard/orders/OrdersTableSkeleton";
import { DashboardHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** All · active · pending · accepted · preparing · ready · completed · cancelled. */
const STATUS_TABS = 8;

export default function OrdersLoading() {
  return (
    <LoadingRegion className="@container flex min-w-0 flex-col gap-4 sm:gap-6">
      <DashboardHeaderSkeleton />

      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: STATUS_TABS }, (_, tab) => (
          <Skeleton key={tab} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>

      <OrdersTableSkeleton />
    </LoadingRegion>
  );
}
