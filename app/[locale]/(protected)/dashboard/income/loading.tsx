import { ListPagerSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Income rows drawn while the list loads. */
const INCOME_ROWS = 8;

/** Mirrors `IncomeScreen`: heading with the record button, the month's figure, then the list. */
export default function IncomeLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-40 rounded-button lg:h-9" />
          <Skeleton className="h-4 w-80 max-w-full rounded-pill" />
        </div>
        <Skeleton className="h-11 w-40 rounded-button" />
      </div>
      <Skeleton className="h-28 rounded-card-lg" />
      <div className="min-w-0 rounded-card-lg border border-border bg-background shadow-xs">
        {Array.from({ length: INCOME_ROWS }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
            <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
            <Skeleton className="h-4 w-24 rounded-pill" />
          </div>
        ))}
        <ListPagerSkeleton />
      </div>
    </LoadingRegion>
  );
}
