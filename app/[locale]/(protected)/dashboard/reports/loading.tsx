import { cn } from "@/src/lib/utils";
import { DashboardHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

/** Sales · payments · guests — the last, odd one spans both columns from `md`. */
const REPORT_CARDS = 3;

export default function ReportsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardHeaderSkeleton />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: REPORT_CARDS }, (_, card) => (
          <div
            key={card}
            className={cn(
              "flex min-h-28 items-center gap-3 rounded-card-lg border border-border/80 bg-background p-4 sm:gap-4 sm:p-5",
              card === REPORT_CARDS - 1 && "md:col-span-2",
            )}
          >
            <Skeleton className="size-12 shrink-0 rounded-card-lg sm:size-14" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-28 rounded-pill" />
              <Skeleton className="h-4 w-4/5 rounded-pill" />
            </div>
            <Skeleton className="size-8 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
