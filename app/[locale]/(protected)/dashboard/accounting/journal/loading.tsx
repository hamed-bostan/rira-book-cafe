import { AccountingTableSkeleton } from "@/src/presentation/dashboard/accounting/AccountingTableSkeleton";
import { AccountingTabsSkeleton } from "@/src/presentation/dashboard/accounting/AccountingTabsSkeleton";
import { PeriodPickerSkeleton } from "@/src/presentation/dashboard/accounting/PeriodPickerSkeleton";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

const JOURNAL_COLUMNS = ["start", "start", "start", "start", "end"] as const;

/** Mirrors `JournalScreen`: tabs, the period + source filter panel with the new-entry button, the entries table and pager. */
export default function JournalLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <AccountingTabsSkeleton />
      <div className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 md:flex-row md:items-start md:justify-between md:p-6">
        <PeriodPickerSkeleton />
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3.5 w-16 rounded-pill" />
            <Skeleton className="h-9 w-44 rounded-input" />
          </div>
          <Skeleton className="h-10 w-28 rounded-button" />
        </div>
      </div>
      <AccountingTableSkeleton columns={JOURNAL_COLUMNS} rows={10} pager />
    </LoadingRegion>
  );
}
