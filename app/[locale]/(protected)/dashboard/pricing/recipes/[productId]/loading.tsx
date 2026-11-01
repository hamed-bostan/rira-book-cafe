import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Ingredient lines drawn — a typical recipe. */
const RECIPE_LINES = 3;

export default function RecipeLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      {/* Back to pricing. */}
      <Skeleton className="h-5 w-24 rounded-pill" />

      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-56 rounded-button lg:h-8" />
        <Skeleton className="h-5 w-96 max-w-full rounded-pill" />
      </div>

      <div className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-5 shadow-xs">
        {/* Ingredient · amount · remove. */}
        <div className="flex flex-col gap-3">
          {Array.from({ length: RECIPE_LINES }, (_, line) => (
            <div
              key={line}
              className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_2.25rem] md:grid-cols-[minmax(0,1fr)_10rem_2.25rem]"
            >
              <Skeleton className="col-span-full h-11 rounded-input sm:h-9 md:col-span-1" />
              <Skeleton className="h-11 rounded-input sm:h-9" />
              <Skeleton className="size-11 rounded-button sm:size-9" />
            </div>
          ))}
        </div>

        {/* Add ingredient, running cost. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-11 w-36 rounded-button sm:h-9" />
          <Skeleton className="h-4 w-48 rounded-pill" />
        </div>

        <div className="flex gap-2">
          <Skeleton className="h-11 w-28 rounded-button sm:h-9" />
          <Skeleton className="h-11 w-20 rounded-button sm:h-9" />
        </div>
      </div>
    </LoadingRegion>
  );
}
