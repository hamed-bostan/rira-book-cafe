import { AccountingTableSkeleton } from "@/src/presentation/dashboard/accounting/AccountingTableSkeleton";
import { PeriodPickerSkeleton } from "@/src/presentation/dashboard/accounting/PeriodPickerSkeleton";
import { DashboardStatGridSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

const EXPENSE_COLUMNS = ["start", "start", "start", "start", "start", "end"] as const;

/** Mirrors `ExpensesScreen`: heading with suppliers / new buttons, the owed tile, period + status / supplier filters, the bills table and pager. */
export default function ExpensesLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-40 rounded-button sm:h-9 sm:w-48" />
          <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-28 rounded-button" />
          <Skeleton className="h-10 w-28 rounded-button" />
        </div>
      </div>

      <DashboardStatGridSkeleton count={1} className="max-w-sm grid-cols-1 sm:grid-cols-1 xl:grid-cols-1" />

      <div className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 md:flex-row md:items-start md:justify-between md:p-6">
        <PeriodPickerSkeleton />
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3.5 w-12 rounded-pill" />
            <Skeleton className="h-9 w-36 rounded-input" />
          </div>
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3.5 w-16 rounded-pill" />
            <Skeleton className="h-9 w-40 rounded-input" />
          </div>
        </div>
      </div>

      <AccountingTableSkeleton columns={EXPENSE_COLUMNS} rows={10} pager />
    </LoadingRegion>
  );
}
