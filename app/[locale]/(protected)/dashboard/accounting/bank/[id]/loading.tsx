import { BankMatchWorkspaceSkeleton } from "@/src/presentation/dashboard/bank/BankMatchWorkspaceSkeleton";
import { BreadcrumbSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

/** The proof's lines: book balance, outstanding, cleared after, adjusted book, closing, difference. */
const SUMMARY_ROWS = 6;

/** Mirrors `BankReconciliationScreen`: breadcrumb, title + balances with the status badge, then the proof beside the matching workspace. */
export default function BankStatementLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <BreadcrumbSkeleton />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-64 max-w-full rounded-button sm:h-9 sm:w-80" />
          <Skeleton className="h-4 w-56 max-w-full rounded-pill" />
        </div>
        <Skeleton className="h-7 w-20 rounded-pill" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* ReconciliationSummaryPanel */}
        <div className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 md:p-6">
          <Skeleton className="h-6 w-36 rounded-pill" />
          <div className="flex flex-col divide-y divide-border">
            {Array.from({ length: SUMMARY_ROWS }, (_, index) => (
              <div key={index} className="flex items-center justify-between gap-3 py-2">
                <Skeleton className="h-4 w-32 rounded-pill" />
                <Skeleton className="h-5 w-20 rounded-pill" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-44 rounded-pill" />
            <Skeleton className="h-5 w-40 rounded-pill" />
          </div>
          <Skeleton className="h-11 w-32 rounded-button" />
        </div>
        <BankMatchWorkspaceSkeleton />
      </div>
    </LoadingRegion>
  );
}
