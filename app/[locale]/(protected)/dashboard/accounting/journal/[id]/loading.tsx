import { AccountingTableSkeleton } from "@/src/presentation/dashboard/accounting/AccountingTableSkeleton";
import { BreadcrumbSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

const ENTRY_COLUMNS = ["start", "start", "end", "end"] as const;

/** Mirrors `JournalEntryScreen`: breadcrumb, title / description / source line with the reverse action, the notice, the lines table with totals. */
export default function JournalEntryLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <BreadcrumbSkeleton />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48 rounded-button sm:h-9 sm:w-56" />
          <Skeleton className="h-5 w-72 max-w-full rounded-pill" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-pill" />
            <Skeleton className="h-3.5 w-24 rounded-pill" />
            <Skeleton className="h-3.5 w-40 rounded-pill" />
          </div>
        </div>
        <Skeleton className="h-10 w-28 rounded-button" />
      </div>
      {/* The notices column (an automatic entry links to the order or bill behind it). */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
      </div>
      <AccountingTableSkeleton columns={ENTRY_COLUMNS} rows={3} totals />
    </LoadingRegion>
  );
}
