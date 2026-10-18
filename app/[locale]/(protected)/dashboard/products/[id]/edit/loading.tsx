import { ProductFormSkeleton } from "@/src/presentation/dashboard/products/ProductFormSkeleton";
import { DashboardHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

export default function EditProductLoading() {
  return (
    <LoadingRegion className="flex max-w-xl flex-col gap-6">
      <DashboardHeaderSkeleton />
      <ProductFormSkeleton />

      {/* The product's activity history below the form. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-24 rounded-pill" />
          <Skeleton className="h-4 w-56 max-w-full rounded-pill" />
        </div>
        <Skeleton className="h-28 w-full rounded-card-lg" />
      </div>
    </LoadingRegion>
  );
}
