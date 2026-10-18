import { DashboardHeaderSkeleton, DashboardStatGridSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Best sellers listed beside the week's chart. */
const TOP_ITEMS = 5;

/**
 * Mirrors `DashboardOverviewScreen` as a revenue viewer sees it: heading + date,
 * the floor's three tiles, today's takings and orders with their sparklines, then
 * the week's chart beside the best sellers and the all-reports link.
 */
export default function DashboardOverviewLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardHeaderSkeleton />

      <DashboardStatGridSkeleton count={3} className="xl:grid-cols-3" />

      {/* Today's revenue / orders: StatCard with a sparkline in place of the icon badge. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="flex min-h-40 flex-col justify-between gap-1 rounded-card-lg border border-border bg-background p-5"
          >
            <Skeleton className="h-4 w-24 rounded-pill" />
            <div className="flex flex-col">
              <Skeleton className="h-8 w-32 rounded-button" />
              <Skeleton className="mt-2 h-4 w-36 rounded-pill" />
              <Skeleton className="mt-2 h-12 w-full rounded-card-md" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* DailySalesChart: heading + revenue/orders switch over a 220px chart. */}
        <div className="min-w-0 rounded-card-lg border border-border bg-background p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-6 w-36 rounded-pill" />
            <Skeleton className="h-9 w-40 rounded-button" />
          </div>
          <Skeleton className="mt-4 h-55 w-full rounded-card-md" />
        </div>

        {/* TopItemsTable: heading + sort links, then the ranked list. */}
        <div className="min-w-0 rounded-card-lg border border-border bg-background p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-6 w-32 rounded-pill" />
            <div className="flex gap-3">
              <Skeleton className="h-4 w-14 rounded-pill" />
              <Skeleton className="h-4 w-14 rounded-pill" />
            </div>
          </div>
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {Array.from({ length: TOP_ITEMS }, (_, index) => (
              <li key={index} className="flex items-center gap-3 py-2.5">
                <Skeleton className="h-4 w-4 shrink-0 rounded-pill" />
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

      <Skeleton className="h-4 w-28 rounded-pill" />
    </LoadingRegion>
  );
}
