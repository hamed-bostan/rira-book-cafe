import { DashboardHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

/** Ingredient lines drawn — a typical recipe. */
const RECIPE_LINES = 3;

export default function RecipeLoading() {
  return (
    <LoadingRegion className="flex max-w-2xl flex-col gap-6">
      {/* Pricing › item name. */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-16 rounded-pill" />
        <Skeleton className="size-3.5 rounded-full" />
        <Skeleton className="h-3.5 w-24 rounded-pill" />
      </div>

      <DashboardHeaderSkeleton />

      <div className="flex flex-col gap-4">
        {/* Ingredient · quantity · remove. */}
        {Array.from({ length: RECIPE_LINES }, (_, line) => (
          <div key={line} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-start gap-2">
            <Skeleton className="h-10 rounded-input" />
            <Skeleton className="h-10 rounded-input" />
            <Skeleton className="size-10 rounded-button" />
          </div>
        ))}

        {/* Add line, running cost. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-10 w-32 rounded-button" />
          <Skeleton className="h-4 w-28 rounded-pill" />
        </div>

        <div className="flex gap-3 pt-2">
          <Skeleton className="h-11 w-28 rounded-button" />
          <Skeleton className="h-11 w-24 rounded-button" />
        </div>
      </div>
    </LoadingRegion>
  );
}
