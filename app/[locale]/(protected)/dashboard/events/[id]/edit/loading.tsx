import { ActivityPanelSkeleton } from "@/src/presentation/dashboard/activity/ActivityPanelSkeleton";
import { EventFormSkeleton } from "@/src/presentation/dashboard/events/EventFormSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Guests drawn in the registrations panel. */
const REGISTRATION_ROWS = 4;

/**
 * Mirrors the edit-event page: the form column (heading with delete, `EventForm`,
 * activity) beside the registrations panel from `lg`.
 */
export default function EditEventLoading() {
  return (
    <LoadingRegion className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex max-w-xl flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-8 w-40 rounded-button sm:h-9 sm:w-48" />
            <Skeleton className="h-4 w-48 max-w-full rounded-pill" />
          </div>
          <Skeleton className="h-10 w-24 rounded-button" />
        </div>
        <EventFormSkeleton />
        <ActivityPanelSkeleton />
      </div>

      {/* EventRegistrationsPanel */}
      <div>
        <div className="rounded-card-lg border border-border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-32 rounded-pill" />
            <Skeleton className="h-4 w-24 rounded-pill" />
          </div>
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {Array.from({ length: REGISTRATION_ROWS }, (_, index) => (
              <li key={index} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-32 rounded-pill" />
                  <Skeleton className="h-3.5 w-48 max-w-full rounded-pill" />
                </div>
                <Skeleton className="h-10 w-20 shrink-0 rounded-button" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </LoadingRegion>
  );
}
