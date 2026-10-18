import { EventFormSkeleton } from "@/src/presentation/dashboard/events/EventFormSkeleton";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

/** Mirrors the create-event page: heading + subtitle over `EventForm`, in the `max-w-xl` form column. */
export default function CreateEventLoading() {
  return (
    <LoadingRegion className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-40 rounded-button sm:h-9 sm:w-48" />
        <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
      </div>
      <EventFormSkeleton />
    </LoadingRegion>
  );
}
