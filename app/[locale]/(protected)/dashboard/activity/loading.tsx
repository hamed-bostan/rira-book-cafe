import { ActivityEntrySkeletons } from "@/src/presentation/dashboard/activity/ActivityListSkeleton";
import { ListPagerSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Changed by, Area, Field. */
const FILTERS = 3;
/** Entries drawn under the first day's header — the log's first screen. */
const ENTRY_ROWS = 6;

/**
 * Mirrors `ActivityScreen`: heading with the line under it, then the log card —
 * the three labelled filters, a day header, its entries, and the pager.
 */
export default function ActivityLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-36 rounded-button lg:h-9" />
        <Skeleton className="h-4 w-96 max-w-full rounded-pill" />
      </div>

      <div className="rounded-card-lg border border-border bg-background shadow-xs">
        <div className="grid gap-x-4 gap-y-3 border-b border-border px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: FILTERS }, (_, index) => (
            <div key={index} className="flex min-w-0 flex-col gap-1.5">
              <Skeleton className="h-4 w-20 rounded-pill" />
              <Skeleton className="h-11 w-full rounded-input sm:h-9" />
            </div>
          ))}
        </div>
        <div className="border-b border-border bg-muted px-5 py-2">
          <Skeleton className="h-4 w-16 rounded-pill" />
        </div>
        <ActivityEntrySkeletons rows={ENTRY_ROWS} />
        <div className="border-t border-border px-5 py-3">
          <ListPagerSkeleton />
        </div>
      </div>
    </LoadingRegion>
  );
}
