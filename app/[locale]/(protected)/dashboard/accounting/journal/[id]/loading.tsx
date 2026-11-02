import { StackedTableSkeleton } from "@/src/presentation/dashboard/accounting/StackedTableSkeleton";
import { DashboardPageHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { STACKED_TABLE } from "@/src/presentation/dashboard/stackedTableStyles";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

const ENTRY_COLUMNS = ["start", "start", "end", "end"] as const;

/** Mirrors `JournalEntryScreen`: the way back, title and who posted it with the reverse action, the notice, the lines with totals. */
export default function JournalEntryLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={1} />
      {/* The notice (an automatic entry links to the order or bill behind it). */}
      <Skeleton className="h-12 w-full rounded-card-lg" />
      <StackedTableSkeleton layout={STACKED_TABLE.compact} columns={ENTRY_COLUMNS} rows={3} totals />
    </LoadingRegion>
  );
}
