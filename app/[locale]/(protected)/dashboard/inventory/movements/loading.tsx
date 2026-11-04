import { cn } from "@/src/lib/utils";
import { StackedTableSkeleton } from "@/src/presentation/dashboard/accounting/StackedTableSkeleton";
import { PAGE_CARD } from "@/src/presentation/dashboard/pageStyles";
import {
  DashboardFieldSkeleton,
  DashboardPageHeaderSkeleton,
  ListPagerSkeleton,
} from "@/src/presentation/dashboard/skeletons";
import { STACKED_TABLE } from "@/src/presentation/dashboard/stackedTableStyles";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";

const MOVEMENT_COLUMNS = ["start", "start", "start", "end", "end", "start"] as const;

/**
 * Mirrors `MovementsScreen`: the header, then one card with the item and type
 * filters, the movements — stacked under a laptop's card as the screen's are —
 * and the pager.
 */
export default function StockMovementsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={1} />
      <section className={cn(PAGE_CARD, "overflow-hidden")}>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-border px-5 py-4">
          <div className="w-48">
            <DashboardFieldSkeleton />
          </div>
          <div className="w-40">
            <DashboardFieldSkeleton />
          </div>
          {/* The date span. */}
          <div className="w-40">
            <DashboardFieldSkeleton />
          </div>
        </div>
        {/* Date · item · type · quantity · value · by, inside this card rather than in one of its own. */}
        <StackedTableSkeleton
          layout={STACKED_TABLE.wide}
          columns={MOVEMENT_COLUMNS}
          rows={10}
          className="rounded-none border-0 shadow-none"
        />
        <div className="border-t border-border px-5 py-3">
          <ListPagerSkeleton />
        </div>
      </section>
    </LoadingRegion>
  );
}
