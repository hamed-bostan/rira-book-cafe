import { ActivityPanelSkeleton } from "@/src/presentation/dashboard/activity/ActivityPanelSkeleton";
import { CategoryFormSkeleton } from "@/src/presentation/dashboard/categories/CategoryFormSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Mirrors `EditCategoryScreen`: heading + subtitle, `CategoryForm`, then the category's activity panel. */
export default function EditCategoryLoading() {
  return (
    <LoadingRegion className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-44 rounded-button sm:h-9 sm:w-52" />
        <Skeleton className="h-4 w-56 max-w-full rounded-pill" />
      </div>
      <CategoryFormSkeleton />
      <ActivityPanelSkeleton />
    </LoadingRegion>
  );
}
