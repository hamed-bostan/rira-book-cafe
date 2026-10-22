import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Category rows drawn while the list loads. */
const ROWS = 6;

/** Mirrors `CategoriesScreen`: heading + subtitle with the new-category button, then one numbered row per category. */
export default function CategoriesLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-40 rounded-button lg:h-9" />
          <Skeleton className="h-4 w-72 max-w-full rounded-pill" />
        </div>
        <Skeleton className="h-11 w-36 rounded-button" />
      </div>

      <div className="rounded-card-lg border border-border bg-background shadow-xs">
        {Array.from({ length: ROWS }, (_, row) => (
          <div key={row} className="flex items-center gap-4 border-t border-border px-5 py-3 first-of-type:border-t-0">
            <Skeleton className="h-4 w-5 shrink-0 rounded-pill" />
            <Skeleton className="size-10 shrink-0 rounded-button" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-36 rounded-pill" />
              <Skeleton className="h-3 w-24 rounded-pill" />
            </div>
            <div className="flex shrink-0 gap-2">
              <Skeleton className="size-11 rounded-button sm:size-9" />
              <Skeleton className="size-11 rounded-button sm:size-9" />
              <Skeleton className="size-11 rounded-button sm:size-9" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
