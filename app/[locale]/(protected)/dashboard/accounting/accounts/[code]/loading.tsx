import { AccountingTableSkeleton } from "@/src/presentation/dashboard/accounting/AccountingTableSkeleton";
import { PeriodPickerSkeleton } from "@/src/presentation/dashboard/accounting/PeriodPickerSkeleton";
import { BreadcrumbSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

const LEDGER_COLUMNS = ["start", "start", "start", "end", "end", "end"] as const;

/** Mirrors `AccountLedgerScreen`: breadcrumb, code · name with the type badge, period picker, ledger table with closing total. */
export default function AccountLedgerLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <BreadcrumbSkeleton />
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-8 w-56 rounded-button sm:h-9 sm:w-72" />
        <Skeleton className="h-6 w-16 rounded-pill" />
      </div>
      <div className="rounded-card-lg border border-border bg-background p-4 md:p-6">
        <PeriodPickerSkeleton />
      </div>
      {/* The opening-balance row plus the period's movements. */}
      <AccountingTableSkeleton columns={LEDGER_COLUMNS} rows={9} totals />
    </LoadingRegion>
  );
}
