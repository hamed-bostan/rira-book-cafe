import { DashboardHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Floor cards, then money cards — as a revenue viewer sees them. */
const FLOOR_CARDS = 3;
const MONEY_CARDS = 2;
/** Rows in each of the queue and reservations cards. */
const PANEL_ROWS = 3;
/** Days in the week chart, and best sellers beside it. */
const DAYS = 7;
const TOP_ITEMS = 5;

/** A card shell matching the overview's cards: white, hairline border, a soft lift. */
const CARD = "min-w-0 rounded-card-lg border border-border bg-background shadow-xs";

/**
 * Mirrors `DashboardOverviewScreen` as a revenue viewer sees it: the heading and
 * date, five number cards, the order queue beside today's bookings, then the
 * week's chart beside the best sellers.
 */
export default function DashboardOverviewLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardHeaderSkeleton />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6 xl:grid-cols-5">
        {Array.from({ length: FLOOR_CARDS + MONEY_CARDS }, (_, index) => (
          <div
            key={index}
            className={`${CARD} flex flex-col gap-4 px-5 py-4 ${index < FLOOR_CARDS ? "sm:col-span-2" : "sm:col-span-3"} xl:col-span-1`}
          >
            <Skeleton className="h-4 w-28 rounded-pill" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-20 rounded-button" />
              <Skeleton className="h-3.5 w-36 rounded-pill" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, panel) => (
          <div key={panel} className={CARD}>
            <div className="flex items-center justify-between px-5 py-4">
              <Skeleton className="h-5 w-36 rounded-pill" />
              <Skeleton className="h-4 w-14 rounded-pill" />
            </div>
            {Array.from({ length: PANEL_ROWS }, (_, row) => (
              <div key={row} className="flex items-center gap-4 border-t border-border px-5 py-3">
                <div className="flex w-20 flex-col gap-1.5">
                  <Skeleton className="h-4 w-14 rounded-pill" />
                  <Skeleton className="h-3 w-12 rounded-pill" />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-3/5 rounded-pill" />
                  <Skeleton className="h-3 w-2/5 rounded-pill" />
                </div>
                <Skeleton className="h-9 w-28 rounded-button" />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className={`${CARD} flex flex-col gap-6 p-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-28 rounded-pill" />
              <Skeleton className="h-7 w-40 rounded-button" />
            </div>
            <Skeleton className="h-9 w-44 rounded-button" />
          </div>
          <div className="flex h-48 items-end gap-2 ps-11">
            {Array.from({ length: DAYS }, (_, day) => (
              <Skeleton key={day} className="h-1/2 flex-1 rounded-t-badge-md rounded-b-none" />
            ))}
          </div>
        </div>

        <div className={`${CARD} flex flex-col gap-2 p-5`}>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-24 rounded-pill" />
            <Skeleton className="h-9 w-36 rounded-button" />
          </div>
          <ul className="mt-2 flex flex-col">
            {Array.from({ length: TOP_ITEMS }, (_, index) => (
              <li key={index} className="flex items-center gap-3 border-t border-border py-3">
                <Skeleton className="size-4 shrink-0 rounded-pill" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-3/5 rounded-pill" />
                  <Skeleton className="h-3 w-16 rounded-pill" />
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-4 w-20 rounded-pill" />
                  <Skeleton className="h-3 w-14 rounded-pill" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </LoadingRegion>
  );
}
