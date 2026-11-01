import { OrderDetailSkeleton } from "@/src/presentation/dashboard/orders/OrderDetailSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";

export default function OrderDetailLoading() {
  return (
    <LoadingRegion>
      <OrderDetailSkeleton />
    </LoadingRegion>
  );
}
