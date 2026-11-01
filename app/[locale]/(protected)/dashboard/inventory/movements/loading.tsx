import { AccountingTableSkeleton } from "@/src/presentation/dashboard/accounting/AccountingTableSkeleton";
import { DashboardPageHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";

const MOVEMENT_COLUMNS = ["start", "start", "start", "end", "end", "start"] as const;

export default function StockMovementsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={0} />
      {/* Date · item · type · quantity · value · by, with the pager inside the card. */}
      <AccountingTableSkeleton columns={MOVEMENT_COLUMNS} rows={10} pager />
    </LoadingRegion>
  );
}
