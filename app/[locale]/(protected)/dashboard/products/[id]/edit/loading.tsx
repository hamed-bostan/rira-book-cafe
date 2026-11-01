import { ProductFormSkeleton } from "@/src/presentation/dashboard/products/ProductFormSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";

export default function EditProductLoading() {
  return (
    <LoadingRegion>
      <ProductFormSkeleton activity />
    </LoadingRegion>
  );
}
