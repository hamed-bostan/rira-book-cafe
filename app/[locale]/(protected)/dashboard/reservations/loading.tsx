import { DashboardHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

/** Booking cards drawn — a typical day's first screen. */
const BOOKING_CARDS = 5;

export default function ReservationsLoading() {
  return (
    <LoadingRegion className="@container flex min-w-0 flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3">
        <DashboardHeaderSkeleton />
        {/* Previous / today / next / date, beside the status filter. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="size-10 rounded-button" />
            <Skeleton className="h-10 w-20 rounded-button" />
            <Skeleton className="size-10 rounded-button" />
            <Skeleton className="h-9 w-36 rounded-input" />
          </div>
          <Skeleton className="h-9 w-48 rounded-input" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: BOOKING_CARDS }, (_, card) => (
          <div
            key={card}
            className="flex flex-col gap-3 rounded-card-md border border-border bg-background p-4 @min-[40rem]:flex-row @min-[40rem]:items-start"
          >
            {/* Time + reference. */}
            <div className="flex w-20 shrink-0 flex-col gap-1.5">
              <Skeleton className="h-5 w-14 rounded-pill" />
              <Skeleton className="h-3.5 w-16 rounded-pill" />
            </div>
            {/* Guest + status, phone, party / table. */}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-4 w-32 rounded-pill" />
                <Skeleton className="h-6 w-20 rounded-pill" />
              </div>
              <Skeleton className="h-4 w-28 rounded-pill" />
              <Skeleton className="h-4 w-40 rounded-pill" />
            </div>
            <div className="flex shrink-0 gap-2">
              <Skeleton className="h-10 w-24 rounded-button" />
              <Skeleton className="h-10 w-20 rounded-button" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
