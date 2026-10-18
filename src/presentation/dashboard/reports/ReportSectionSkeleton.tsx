import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

type ReportSectionSkeletonProps = {
  /** Reserve the muted description line under the heading (hourly chart, unpaid orders). */
  description?: boolean;
  /** Reserve a control at the heading's inline-end: the daily chart's segmented metric toggle, or the top items' sort links. */
  action?: "toggle" | "links";
  /** Draw this many list rows (top items, top guests, unpaid orders) instead of a chart block. */
  rows?: number;
  /** Draw this many share bars (channels, kinds, payment methods) instead of a chart block. */
  bars?: number;
  /** Size of the chart block when neither `rows` nor `bars` is set — the chart's own height. */
  chartClassName?: string;
  className?: string;
};

/**
 * Placeholder for one of the reports' bordered sections (`p-4 md:p-6`): the
 * heading row, then a chart, a ranked list, or a set of share bars.
 */
export function ReportSectionSkeleton({
  description = false,
  action,
  rows,
  bars,
  chartClassName,
  className,
}: ReportSectionSkeletonProps) {
  return (
    <div className={cn("min-w-0 rounded-card-lg border border-border bg-background p-4 md:p-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-6 w-36 rounded-pill" />
        {action === "toggle" ? <Skeleton className="h-12 w-full rounded-card-md sm:h-9 sm:w-44" /> : null}
        {action === "links" ? <Skeleton className="h-5 w-32 rounded-pill" /> : null}
      </div>
      {description ? <Skeleton className="mt-1 h-4 w-56 max-w-full rounded-pill" /> : null}

      {rows !== undefined ? (
        <div className="mt-4 flex flex-col divide-y divide-border">
          {Array.from({ length: rows }, (_, row) => (
            <div key={row} className="flex items-center gap-3 py-2.5">
              <Skeleton className="h-4 w-6 shrink-0 rounded-pill" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-3/5 rounded-pill" />
                <Skeleton className="h-3.5 w-1/4 rounded-pill" />
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Skeleton className="h-4 w-20 rounded-pill" />
                <Skeleton className="h-3.5 w-14 rounded-pill" />
              </div>
            </div>
          ))}
        </div>
      ) : bars !== undefined ? (
        <div className="mt-4 flex flex-col gap-4">
          {Array.from({ length: bars }, (_, bar) => (
            <div key={bar} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-20 rounded-pill" />
                <Skeleton className="h-4 w-24 rounded-pill" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <Skeleton className={cn("mt-4 h-56 w-full rounded-card-md", chartClassName)} />
      )}
    </div>
  );
}
