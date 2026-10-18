import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

type DashboardStatGridSkeletonProps = {
  count?: number;
  /** The grid classes the real KPI row uses, so the tiles land where they will. */
  className?: string;
};

/** Placeholder KPI tiles (`StatCard`): label + icon badge on top, value pinned below. */
export function DashboardStatGridSkeleton({ count = 4, className }: DashboardStatGridSkeletonProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex h-full min-h-40 flex-col justify-between gap-1 overflow-hidden rounded-card-lg border border-border bg-background p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-4 w-24 rounded-pill" />
            <Skeleton className="size-10 shrink-0 rounded-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-28 rounded-button" />
            <Skeleton className="h-3.5 w-20 rounded-pill" />
          </div>
        </div>
      ))}
    </div>
  );
}
