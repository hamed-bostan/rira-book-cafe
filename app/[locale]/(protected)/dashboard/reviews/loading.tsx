import { DashboardHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

/** Review cards drawn — the queue's first screen. */
const REVIEW_CARDS = 5;

export default function ReviewsLoading() {
  return (
    <LoadingRegion className="@container flex min-w-0 flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3">
        <DashboardHeaderSkeleton />
        {/* Search beside the view filter. */}
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 min-w-56 flex-1 rounded-input sm:max-w-xs" />
          <Skeleton className="h-9 w-48 rounded-input" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: REVIEW_CARDS }, (_, card) => (
          <div
            key={card}
            className="flex flex-col gap-3 rounded-card-md border border-border bg-background p-4 @min-[40rem]:flex-row @min-[40rem]:items-start"
          >
            {/* Product + status, stars + author, comment, date. */}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-4 w-36 rounded-pill" />
                <Skeleton className="h-6 w-20 rounded-pill" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-4 w-20 rounded-pill" />
                <Skeleton className="h-4 w-24 rounded-pill" />
              </div>
              <Skeleton className="h-4 w-full max-w-md rounded-pill" />
              <Skeleton className="h-3.5 w-28 rounded-pill" />
            </div>
            <div className="flex shrink-0 gap-2">
              <Skeleton className="h-10 w-24 rounded-button" />
              <Skeleton className="h-10 w-24 rounded-button" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
