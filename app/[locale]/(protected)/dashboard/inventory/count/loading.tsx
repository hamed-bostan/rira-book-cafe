import { StackedTableSkeleton } from "@/src/presentation/dashboard/accounting/StackedTableSkeleton";
import { PAGE_CARD } from "@/src/presentation/dashboard/pageStyles";
import { DashboardFieldSkeleton, DashboardPageHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { STACKED_TABLE } from "@/src/presentation/dashboard/stackedTableStyles";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

const COUNT_COLUMNS = ["start", "end", "end", "end"] as const;

export default function StockCountLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={0} />
      <div className={`${PAGE_CARD} flex flex-col gap-5 p-5`}>
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
          <DashboardFieldSkeleton hint />
          <DashboardFieldSkeleton />
        </div>
        {/* Item · expected · counted · difference, stacked on a phone as the form's are. */}
        <StackedTableSkeleton layout={STACKED_TABLE.compact} columns={COUNT_COLUMNS} rows={8} className="shadow-none" />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-32 rounded-button sm:h-9" />
          <Skeleton className="h-11 w-20 rounded-button sm:h-9" />
        </div>
      </div>
    </LoadingRegion>
  );
}
