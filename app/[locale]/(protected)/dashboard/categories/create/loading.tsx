import { CategoryFormSkeleton } from "@/src/presentation/dashboard/categories/CategoryFormSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";

export default function CreateCategoryLoading() {
  return (
    <LoadingRegion>
      <CategoryFormSkeleton />
    </LoadingRegion>
  );
}
