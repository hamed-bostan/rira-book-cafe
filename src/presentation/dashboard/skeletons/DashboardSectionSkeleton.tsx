import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

import type { ReactNode } from "react";

type DashboardSectionSkeletonProps = {
  /** Reserve the line under the title. */
  description?: boolean;
  /** The content draws its own inset, as a list of rows does — as on `DashboardSection`. */
  flush?: boolean;
  children: ReactNode;
};

/** Placeholder for `DashboardSection`: the ruled header over its fields or rows. */
export function DashboardSectionSkeleton({
  description = false,
  flush = false,
  children,
}: DashboardSectionSkeletonProps) {
  return (
    <div className="min-w-0 rounded-card-lg border border-border bg-background shadow-xs">
      <div className="flex flex-col gap-1.5 border-b border-border px-5 py-4">
        <Skeleton className="h-6 w-32 rounded-pill" />
        {description ? <Skeleton className="h-4 w-64 max-w-full rounded-pill" /> : null}
      </div>
      {flush ? children : <div className="flex flex-col gap-4 p-5">{children}</div>}
    </div>
  );
}
