import { DashboardStatGridSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Closed shifts drawn in the history panel. */
const HISTORY_ROWS = 5;

/**
 * Mirrors `CashShiftsScreen` with a shift open — the usual state while the cafe
 * trades: the open-shift panel with its four till tiles, the close form, then the
 * history of closed shifts.
 */
export default function CashShiftsLoading() {
  return (
    <LoadingRegion className="@container flex min-w-0 flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-44 rounded-button sm:h-9 sm:w-52" />
        <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
      </div>

      <div className="rounded-card-lg border border-border bg-background p-4 sm:p-5">
        <Skeleton className="h-6 w-40 rounded-pill" />
        <Skeleton className="mt-1.5 h-4 w-56 max-w-full rounded-pill" />
        <DashboardStatGridSkeleton
          count={4}
          className="mt-4 grid-cols-2 sm:grid-cols-2 xl:grid-cols-2 @min-[50rem]:grid-cols-4"
        />
        <Skeleton className="mt-3 h-3.5 w-28 rounded-pill" />
      </div>

      <div className="rounded-card-lg border border-border bg-background p-4 sm:p-5">
        <Skeleton className="h-6 w-36 rounded-pill" />
        <Skeleton className="mt-1.5 h-4 w-72 max-w-full rounded-pill" />
        <div className="mt-4 flex max-w-md flex-col gap-4">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-24 rounded-pill" />
              <Skeleton className="h-10 w-full rounded-input" />
            </div>
          ))}
          <Skeleton className="h-11 w-28 rounded-button" />
        </div>
      </div>

      <div className="rounded-card-lg border border-border bg-background p-4 sm:p-5">
        <Skeleton className="h-6 w-32 rounded-pill" />
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {Array.from({ length: HISTORY_ROWS }, (_, index) => (
            <li key={index} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-40 rounded-pill" />
                <Skeleton className="h-3.5 w-32 rounded-pill" />
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Skeleton className="h-3.5 w-36 rounded-pill" />
                <Skeleton className="h-4 w-16 rounded-pill" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </LoadingRegion>
  );
}
