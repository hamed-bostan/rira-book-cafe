import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Review rows drawn — the queue's first screen. */
const REVIEW_ROWS = 5;
/** Waiting, Shown, Hidden, All. */
const TABS = 4;

/**
 * Mirrors `ReviewsScreen`: heading with the average under it, then the reviews
 * card — tabs, search, rows.
 */
export default function ReviewsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-36 rounded-button lg:h-9" />
        <Skeleton className="h-4 w-96 max-w-full rounded-pill" />
      </div>

      <div className="rounded-card-lg border border-border bg-background shadow-xs">
        <div className="flex h-12 items-center gap-6 overflow-hidden border-b border-border px-4">
          {Array.from({ length: TABS }, (_, index) => (
            <Skeleton key={index} className="h-5 w-20 shrink-0 rounded-pill" />
          ))}
        </div>
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-11 w-full max-w-md rounded-input sm:h-10" />
        </div>
        <ul>
          {Array.from({ length: REVIEW_ROWS }, (_, index) => (
            <li
              key={index}
              className="flex flex-wrap items-start gap-x-5 gap-y-3 border-t border-border px-5 py-4 first:border-t-0"
            >
              {/* Item + status, stars + guest + date, the words. */}
              <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-2">
                <Skeleton className="h-5 w-56 max-w-full rounded-pill" />
                <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
                <Skeleton className="h-4 w-full max-w-md rounded-pill" />
              </div>
              <div className="ms-auto flex gap-2">
                <Skeleton className="h-10 w-24 rounded-button" />
                <Skeleton className="h-10 w-16 rounded-button" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </LoadingRegion>
  );
}
