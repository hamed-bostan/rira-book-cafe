import { AccountingTableSkeleton } from "@/src/presentation/dashboard/accounting/AccountingTableSkeleton";
import { AccountingTabsSkeleton } from "@/src/presentation/dashboard/accounting/AccountingTabsSkeleton";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

const STATEMENT_COLUMNS = ["start", "end", "end", "end", "start"] as const;

/** Mirrors `BankStatementsScreen`: tabs, the statements heading with its new-statement button, the statements table. */
export default function BankStatementsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <AccountingTabsSkeleton />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-6 w-40 rounded-pill" />
        <Skeleton className="h-10 w-32 rounded-button" />
      </div>
      <AccountingTableSkeleton columns={STATEMENT_COLUMNS} rows={6} />
    </LoadingRegion>
  );
}
