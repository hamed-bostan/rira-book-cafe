import { OrdersTableSkeleton } from "@/src/presentation/dashboard/orders/OrdersTableSkeleton";
import { DashboardHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";

export default function OrdersLoading() {
  return (
    <LoadingRegion className="@container flex min-w-0 flex-col gap-6">
      <DashboardHeaderSkeleton />
      <OrdersTableSkeleton />
    </LoadingRegion>
  );
}
