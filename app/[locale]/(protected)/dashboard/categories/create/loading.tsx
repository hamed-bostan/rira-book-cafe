import { CategoryFormSkeleton } from "@/src/presentation/dashboard/categories/CategoryFormSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Mirrors the create-category page: heading + subtitle over `CategoryForm`, in the `max-w-xl` form column. */
export default function CreateCategoryLoading() {
  return (
    <LoadingRegion className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-44 rounded-button" />
        <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
      </div>
      <CategoryFormSkeleton />
    </LoadingRegion>
  );
}
