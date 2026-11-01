import { AccountingHeaderSkeleton } from "@/src/presentation/dashboard/accounting/AccountingHeaderSkeleton";
import { AccountingTableSkeleton } from "@/src/presentation/dashboard/accounting/AccountingTableSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

const STATEMENT_COLUMNS = ["start", "end", "end", "end", "end"] as const;

/** Mirrors `BankStatementsScreen`: the Accounting header, the new-statement button, the statements table. */
export default function BankStatementsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <AccountingHeaderSkeleton />
      <div className="flex">
        <Skeleton className="h-11 w-40 rounded-button sm:h-9" />
      </div>
      <AccountingTableSkeleton columns={STATEMENT_COLUMNS} rows={6} />
    </LoadingRegion>
  );
}
