import { DashboardHeaderSkeleton, DashboardTableSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

export default function StockMovementsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      {/* Inventory › Movements. */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-16 rounded-pill" />
        <Skeleton className="size-3.5 rounded-full" />
        <Skeleton className="h-3.5 w-20 rounded-pill" />
      </div>

      <DashboardHeaderSkeleton />

      {/* Item and kind filters, each under its caption. */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3.5 w-12 rounded-pill" />
          <Skeleton className="h-9 w-48 rounded-input" />
        </div>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3.5 w-12 rounded-pill" />
          <Skeleton className="h-9 w-40 rounded-input" />
        </div>
      </div>

      {/* Date · item · kind · quantity · value · by, with the pager inside the card. */}
      <DashboardTableSkeleton toolbar={false} columns={6} rows={10} />
    </LoadingRegion>
  );
}
