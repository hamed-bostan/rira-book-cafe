import { StackedTableSkeleton } from "@/src/presentation/dashboard/accounting/StackedTableSkeleton";
import { DashboardFieldSkeleton, DashboardPageHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { STACKED_TABLE } from "@/src/presentation/dashboard/stackedTableStyles";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";

const MOVEMENT_COLUMNS = ["start", "start", "start", "end", "end", "start"] as const;

export default function StockMovementsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={0} />
      {/* The item and type filters, then date · item · type · quantity · value · by,
          stacked under a laptop's card as the screen's are, with the pager inside the card. */}
      <StackedTableSkeleton
        layout={STACKED_TABLE.wide}
        columns={MOVEMENT_COLUMNS}
        rows={10}
        pager
        toolbar={
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-border px-5 py-4">
            <div className="w-48">
              <DashboardFieldSkeleton />
            </div>
            <div className="w-40">
              <DashboardFieldSkeleton />
            </div>
          </div>
        }
      />
    </LoadingRegion>
  );
}
