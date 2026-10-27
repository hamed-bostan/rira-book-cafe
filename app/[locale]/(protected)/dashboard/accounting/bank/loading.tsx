import { AccountingHeaderSkeleton } from "@/src/presentation/dashboard/accounting/AccountingHeaderSkeleton";
import { AccountingTableSkeleton } from "@/src/presentation/dashboard/accounting/AccountingTableSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

const STATEMENT_COLUMNS = ["start", "end", "end", "end", "start"] as const;

/** Mirrors `BankStatementsScreen`: the Accounting header, the statements heading with its new-statement button, the statements table. */
export default function BankStatementsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <AccountingHeaderSkeleton intro />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-6 w-40 rounded-pill" />
        <Skeleton className="h-10 w-32 rounded-button" />
      </div>
      <AccountingTableSkeleton columns={STATEMENT_COLUMNS} rows={6} />
    </LoadingRegion>
  );
}
