import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Book groups, and guests per group, drawn while the lines load. */
const GROUPS = 3;
const ENTRIES = 2;

/** Mirrors `BookHoldsScreen`: heading + subtitle with the add button, then the tabs over one group per book. */
export default function BookHoldsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-40 rounded-button lg:h-9" />
          <Skeleton className="h-4 w-96 max-w-full rounded-pill" />
        </div>
        <Skeleton className="h-11 w-32 rounded-button" />
      </div>

      <div className="rounded-card-lg border border-border bg-background shadow-xs">
        <div className="flex h-12 items-center gap-6 border-b border-border px-4">
          <Skeleton className="h-5 w-16 rounded-pill" />
          <Skeleton className="h-5 w-20 rounded-pill" />
        </div>
        {Array.from({ length: GROUPS }, (_, group) => (
          <div key={group} className="border-t border-border px-5 pt-4 pb-2 first-of-type:border-t-0">
            <div className="flex items-center justify-between gap-3 pb-2">
              <Skeleton className="h-5 w-48 max-w-full rounded-pill" />
              <Skeleton className="h-4 w-40 rounded-pill" />
            </div>
            {Array.from({ length: ENTRIES }, (_, entry) => (
              <div key={entry} className="flex items-center gap-4 py-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-40 rounded-pill" />
                  <Skeleton className="h-3 w-32 rounded-pill" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
