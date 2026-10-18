import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

/** Upcoming event cards drawn while the list loads. */
const EVENT_CARDS = 4;

/** Mirrors `EventsScreen`: heading + summary with the new-event button, then the upcoming section's two-up event cards. */
export default function EventsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-40 rounded-button sm:h-9 sm:w-48" />
          <Skeleton className="h-4 w-32 rounded-pill" />
        </div>
        <Skeleton className="h-11 w-32 rounded-button" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-32 rounded-pill" />
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: EVENT_CARDS }, (_, index) => (
            <li key={index} className="flex flex-col gap-2 rounded-card-md border border-border bg-background p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-6 w-20 rounded-pill" />
                <Skeleton className="h-6 w-16 rounded-pill" />
              </div>
              <Skeleton className="h-5 w-48 max-w-full rounded-pill" />
              <Skeleton className="h-4 w-40 rounded-pill" />
              <Skeleton className="h-4 w-32 rounded-pill" />
            </li>
          ))}
        </ul>
      </div>
    </LoadingRegion>
  );
}
