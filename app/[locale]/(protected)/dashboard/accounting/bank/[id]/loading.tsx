import { BankMatchWorkspaceSkeleton } from "@/src/presentation/dashboard/bank/BankMatchWorkspaceSkeleton";
import { DashboardPageHeaderSkeleton, DashboardSectionSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** The proof's lines: book balance, outstanding, cleared after, adjusted book, closing, difference. */
const SUMMARY_ROWS = 6;

/** Mirrors `BankReconciliationScreen`: the way back, title + balances with the add-lines button, then the workspace beside the proof from `xl`. */
export default function BankStatementLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={1} />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <BankMatchWorkspaceSkeleton />
        <DashboardSectionSkeleton>
          {Array.from({ length: SUMMARY_ROWS }, (_, index) => (
            <div key={index} className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-32 rounded-pill" />
              <Skeleton className="h-4 w-20 rounded-pill" />
            </div>
          ))}
          <Skeleton className="h-11 w-full rounded-button sm:h-9" />
        </DashboardSectionSkeleton>
      </div>
    </LoadingRegion>
  );
}
