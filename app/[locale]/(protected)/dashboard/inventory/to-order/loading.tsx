import { StackedTableSkeleton } from "@/src/presentation/dashboard/accounting/StackedTableSkeleton";
import { DashboardPageHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { STACKED_TABLE } from "@/src/presentation/dashboard/stackedTableStyles";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";

const ORDER_COLUMNS = ["start", "end", "end", "end"] as const;

/** Mirrors `ToOrderScreen`: the header, then a supplier's card of items to order. */
export default function ToOrderLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={1} />
      <StackedTableSkeleton layout={STACKED_TABLE.compact} columns={ORDER_COLUMNS} rows={5} />
    </LoadingRegion>
  );
}
