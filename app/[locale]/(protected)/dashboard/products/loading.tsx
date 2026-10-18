import { ProductsTableSkeleton } from "@/src/presentation/dashboard/products/ProductsTableSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

export default function ProductsLoading() {
  return (
    <LoadingRegion className="@container/products flex min-w-0 flex-col gap-4 sm:gap-6">
      {/* Title + count, beside "New product" once the container is wide enough. */}
      <div className="flex flex-col gap-4 @xl/products:flex-row @xl/products:items-center @xl/products:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40 rounded-button sm:h-9 sm:w-48" />
          <Skeleton className="h-4 w-24 rounded-pill" />
        </div>
        <Skeleton className="h-11 w-36 rounded-button" />
      </div>

      <ProductsTableSkeleton />
    </LoadingRegion>
  );
}
