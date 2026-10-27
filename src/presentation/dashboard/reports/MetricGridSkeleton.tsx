import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

type MetricGridSkeletonProps = {
  count: number;
  /** The grid's columns, as the screen sets them. */
  className?: string;
};

/** A row of `MetricCard` placeholders: the label, then the figure and its hint. */
export function MetricGridSkeleton({ count, className }: MetricGridSkeletonProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-3", className)}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex flex-col justify-between gap-4 rounded-card-lg border border-border bg-background px-5 py-4 shadow-xs"
        >
          <Skeleton className="h-4 w-24 rounded-pill" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-7 w-28 rounded-button" />
            <Skeleton className="h-3.5 w-36 max-w-full rounded-pill" />
          </div>
        </div>
      ))}
    </div>
  );
}
