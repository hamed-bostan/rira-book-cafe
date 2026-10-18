import { DashboardHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Stay cards drawn — the list's first screen. */
const STAY_CARDS = 5;

export default function SuiteBookingsLoading() {
  return (
    <LoadingRegion className="@container flex min-w-0 flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3">
        <DashboardHeaderSkeleton />
        {/* Status filter. */}
        <Skeleton className="h-9 w-48 rounded-input" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: STAY_CARDS }, (_, card) => (
          <div
            key={card}
            className="flex flex-col gap-3 rounded-card-md border border-border bg-background p-4 @min-[40rem]:flex-row @min-[40rem]:items-start"
          >
            {/* Dates + nights. */}
            <div className="flex shrink-0 flex-col gap-1.5 @min-[40rem]:w-44">
              <Skeleton className="h-4 w-36 rounded-pill" />
              <Skeleton className="h-3.5 w-20 rounded-pill" />
            </div>
            {/* Guest + status, phone, party. */}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-4 w-32 rounded-pill" />
                <Skeleton className="h-6 w-20 rounded-pill" />
              </div>
              <Skeleton className="h-4 w-28 rounded-pill" />
              <Skeleton className="h-4 w-24 rounded-pill" />
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
