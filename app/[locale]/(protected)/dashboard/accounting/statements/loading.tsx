import { AccountingHeaderSkeleton } from "@/src/presentation/dashboard/accounting/AccountingHeaderSkeleton";
import { PAGE_CARD } from "@/src/presentation/dashboard/pageStyles";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** One card per statement on offer (P&L, balance sheet, trial balance, VAT, margins). */
const STATEMENT_COUNT = 5;

/** Mirrors `StatementsScreen`: the Accounting header, then the grid of statement link cards. */
export default function StatementsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <AccountingHeaderSkeleton />
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: STATEMENT_COUNT }, (_, index) => (
          <li key={index} className={`${PAGE_CARD} flex flex-col gap-1.5 px-5 py-4`}>
            <Skeleton className="h-5 w-36 rounded-pill" />
            <Skeleton className="h-4 w-full rounded-pill" />
          </li>
        ))}
      </ul>
    </LoadingRegion>
  );
}
