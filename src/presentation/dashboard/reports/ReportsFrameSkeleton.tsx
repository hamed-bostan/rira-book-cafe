import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

import type { ReactNode } from "react";

/** Today · 7 days · 30 days · 90 days. */
const RANGE_OPTIONS = 4;
/** Sales · Payments · Guests. */
const TABS = 3;

/**
 * Mirrors `ReportsFrame` while a report loads: the heading and the range switch,
 * the tabs and the range line — then whatever the tab draws below.
 */
export function ReportsFrameSkeleton({ children }: { children: ReactNode }) {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-36 rounded-button lg:h-9" />
          <Skeleton className="h-4 w-80 max-w-full rounded-pill" />
        </div>
        <div className="flex gap-1 rounded-button bg-muted p-0.5">
          {Array.from({ length: RANGE_OPTIONS }, (_, index) => (
            <Skeleton key={index} className="h-11 w-16 rounded-button sm:h-8" />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex h-12 items-center gap-6 border-b border-border">
          {Array.from({ length: TABS }, (_, index) => (
            <Skeleton key={index} className="h-5 w-20 shrink-0 rounded-pill" />
          ))}
        </div>
        <Skeleton className="h-3.5 w-64 max-w-full rounded-pill" />
      </div>

      {children}
    </LoadingRegion>
  );
}
