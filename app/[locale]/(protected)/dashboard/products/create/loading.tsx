import { ProductFormSkeleton } from "@/src/presentation/dashboard/products/ProductFormSkeleton";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

export default function CreateProductLoading() {
  return (
    <LoadingRegion className="flex max-w-xl flex-col gap-6">
      {/* This page's title is `text-heading-section` at every width. */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40 rounded-button" />
        <Skeleton className="h-4 w-56 max-w-full rounded-pill" />
      </div>
      <ProductFormSkeleton />
    </LoadingRegion>
  );
}
