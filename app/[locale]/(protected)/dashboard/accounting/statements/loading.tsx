import { AccountingHeaderSkeleton } from "@/src/presentation/dashboard/accounting/AccountingHeaderSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** One card per statement on offer (P&L, balance sheet, trial balance, VAT, margins). */
const STATEMENT_COUNT = 5;

/** Mirrors `StatementsScreen`: the Accounting header, then the two-up grid of statement link cards. */
export default function StatementsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <AccountingHeaderSkeleton intro />
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: STATEMENT_COUNT }, (_, index) => (
          <li
            key={index}
            className="flex items-start gap-4 rounded-card-lg border border-border bg-background p-4 md:p-5"
          >
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-5 w-36 rounded-pill" />
              <Skeleton className="h-4 w-full rounded-pill" />
              <Skeleton className="h-4 w-2/3 rounded-pill" />
            </div>
            <Skeleton className="mt-1 size-4 shrink-0 rounded-full" />
          </li>
        ))}
      </ul>
    </LoadingRegion>
  );
}
