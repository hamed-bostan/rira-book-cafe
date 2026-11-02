import { PricingTabsSkeleton } from "@/src/presentation/dashboard/pricing/PricingTabsSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Ingredient rows drawn while the list loads. */
const INGREDIENT_ROWS = 8;

/** Mirrors `IngredientsScreen`: the tabs, then the list card — the new-ingredient button and a row per ingredient. */
export default function IngredientsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <PricingTabsSkeleton />

      <div className="rounded-card-lg border border-border bg-background shadow-xs">
        <div className="flex justify-end border-b border-border px-5 py-4">
          <Skeleton className="h-11 w-36 rounded-button" />
        </div>
        <ul>
          {Array.from({ length: INGREDIENT_ROWS }, (_, index) => (
            <li
              key={index}
              className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border px-5 py-3 first:border-t-0"
            >
              <div className="flex min-w-0 flex-[1_1_12rem]">
                <Skeleton className="h-5 w-48 max-w-full rounded-pill" />
              </div>
              <Skeleton className="h-4 w-40 rounded-pill" />
              <Skeleton className="h-4 w-24 rounded-pill" />
              <Skeleton className="ms-auto size-11 rounded-button sm:size-8" />
            </li>
          ))}
        </ul>
      </div>
    </LoadingRegion>
  );
}
