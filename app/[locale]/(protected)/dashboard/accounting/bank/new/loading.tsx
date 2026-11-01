import { PAGE_CARD } from "@/src/presentation/dashboard/pageStyles";
import { DashboardFieldSkeleton, DashboardPageHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Mirrors the new-statement page: the way back and heading, then `NewBankStatementForm` — period and balances, the paste box, add-line row, submit. */
export default function NewBankStatementLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={0} />
      <div className={`${PAGE_CARD} flex flex-col gap-5 p-5`}>
        <div className="grid grid-cols-2 items-start gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <DashboardFieldSkeleton key={index} hint />
          ))}
        </div>
        {/* StatementLinesFields: legend, the paste box, the add-line row. */}
        <div className="flex flex-col gap-3">
          <Skeleton className="mb-3 h-5 w-16 rounded-pill" />
          <div className="flex flex-col gap-2 rounded-card-lg bg-muted p-4">
            <DashboardFieldSkeleton tall hint />
            <Skeleton className="h-11 w-24 rounded-button sm:h-9" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-11 w-28 rounded-button sm:h-9" />
            <Skeleton className="h-4 w-40 rounded-pill" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-28 rounded-button sm:h-9" />
          <Skeleton className="h-11 w-20 rounded-button sm:h-9" />
        </div>
      </div>
    </LoadingRegion>
  );
}
