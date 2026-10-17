import { cn } from "@/src/lib/utils";
import { ListPagerSkeleton } from "@/src/presentation/dashboard/skeletons";
import { Skeleton } from "@/src/presentation/design-system";

type ActivityListSkeletonProps = {
  rows?: number;
  /** Reserve the activity page's three labelled filter selects above the entries. */
  filters?: boolean;
  /** Reserve the pager row below the entries. */
  pager?: boolean;
  /** Draw the entity chip each entry leads with (the full log; per-entity panels omit it). */
  showEntity?: boolean;
};

/**
 * Placeholder for `ActivityList` in its `DataTable` frame: the history badge, the
 * chip + timestamp line, the sentence, and on every other entry a small field diff.
 */
export function ActivityListSkeleton({ rows = 6, filters = false, pager = false, showEntity = true }: ActivityListSkeletonProps) {
  return (
    <div className="overflow-hidden rounded-card-lg border border-border">
      {filters ? (
        <div className="grid gap-3 border-b border-border bg-background px-4 py-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex min-w-0 flex-col gap-1.5">
              <Skeleton className="h-4 w-20 rounded-pill" />
              <Skeleton className="h-11 w-full rounded-card-md sm:h-10" />
            </div>
          ))}
        </div>
      ) : null}

      <ul className="divide-y divide-border">
        {Array.from({ length: rows }, (_, row) => (
          <li key={row} className="flex gap-3 bg-background px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {showEntity ? <Skeleton className="h-6 w-16 rounded-pill" /> : null}
                <Skeleton className="h-4 w-28 rounded-pill sm:ms-auto" />
              </div>
              <Skeleton className={cn("h-4 rounded-pill", row % 2 === 0 ? "w-3/4" : "w-1/2")} />
              {row % 2 === 0 ? (
                <div className="flex flex-col gap-2 rounded-card-md border border-border/70 bg-surface px-3 py-2.5">
                  <Skeleton className="h-4 w-2/3 rounded-pill" />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {pager ? (
        <div className="border-t border-border bg-background px-4 py-3">
          <ListPagerSkeleton />
        </div>
      ) : null}
    </div>
  );
}
