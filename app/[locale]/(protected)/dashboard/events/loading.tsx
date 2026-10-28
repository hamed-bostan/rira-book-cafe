import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Event cards drawn while the list loads. */
const EVENT_CARDS = 4;

/**
 * Mirrors `EventsScreen`: heading + summary with the new-event button, the
 * Upcoming / Past tabs, then the event cards — badges, title, date, seats bar and
 * the tables-held section.
 */
export default function EventsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-40 rounded-button lg:h-9 lg:w-48" />
          <Skeleton className="h-4 w-44 rounded-pill" />
        </div>
        <Skeleton className="h-11 w-32 rounded-button" />
      </div>

      <div className="flex h-12 items-center gap-6 border-b border-border">
        <Skeleton className="h-5 w-24 rounded-pill" />
        <Skeleton className="h-5 w-16 rounded-pill" />
      </div>

      <ul className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: EVENT_CARDS }, (_, index) => (
          <li
            key={index}
            className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-5 shadow-xs"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <Skeleton className="h-6 w-20 rounded-badge-md" />
              <Skeleton className="h-6 w-20 rounded-badge-md" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-56 max-w-full rounded-pill" />
              <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-4 w-32 rounded-pill" />
                <Skeleton className="h-4 w-24 rounded-pill" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex min-h-11 items-center justify-between gap-3 sm:min-h-9">
                <Skeleton className="h-4 w-24 rounded-pill" />
                <Skeleton className="h-11 w-32 rounded-button sm:h-9" />
              </div>
              <Skeleton className="h-4 w-48 max-w-full rounded-pill" />
            </div>
          </li>
        ))}
      </ul>
    </LoadingRegion>
  );
}
