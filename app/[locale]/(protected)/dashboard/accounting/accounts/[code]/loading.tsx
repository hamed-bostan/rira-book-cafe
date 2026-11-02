import { PeriodPickerSkeleton } from "@/src/presentation/dashboard/accounting/PeriodPickerSkeleton";
import { StackedTableSkeleton } from "@/src/presentation/dashboard/accounting/StackedTableSkeleton";
import { PAGE_CARD } from "@/src/presentation/dashboard/pageStyles";
import { STACKED_TABLE } from "@/src/presentation/dashboard/stackedTableStyles";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

const LEDGER_COLUMNS = ["start", "start", "start", "end", "end", "end"] as const;

/** Mirrors `AccountLedgerScreen`: the way back, code · name with the type badge, period picker, ledger table with closing total. */
export default function AccountLedgerLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <Skeleton className="h-5 w-36 rounded-pill" />
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-7 w-56 rounded-button sm:w-72 lg:h-8" />
        <Skeleton className="h-6 w-16 rounded-pill" />
      </div>
      <div className={`${PAGE_CARD} px-5 py-4`}>
        <PeriodPickerSkeleton />
      </div>
      {/* The opening-balance row plus the period's movements. */}
      <StackedTableSkeleton layout={STACKED_TABLE.wide} columns={LEDGER_COLUMNS} rows={9} totals />
    </LoadingRegion>
  );
}
