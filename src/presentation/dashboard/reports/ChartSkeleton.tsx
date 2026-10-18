import { Skeleton } from "@/src/presentation/design-system";

import type { JSX } from "react";

type ChartSkeletonProps = {
  /** The plot's height in pixels — the same `height` the chart gives its `ChartContainer`. */
  height: number;
};

/** Holds a lazily loaded chart's place — same card, same plot height — so the page doesn't jump when it lands. */
export function ChartSkeleton({ height }: ChartSkeletonProps): JSX.Element {
  return (
    <div className="min-w-0 rounded-card-lg border border-border bg-background p-4 md:p-6">
      <Skeleton className="h-9 w-48 rounded-card-md" />
      <Skeleton className="mt-4 w-full rounded-card-md" style={{ height }} />
    </div>
  );
}
