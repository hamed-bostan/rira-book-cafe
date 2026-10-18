import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

type DashboardPanelSkeletonProps = {
  /** Size of the body block — a chart's height, a list's height (`h-64`, `h-80`). */
  bodyClassName?: string;
  /** Reserve a control at the header's inline-end (a segmented range picker). */
  action?: boolean;
  className?: string;
};

/** Placeholder `DashboardPanel`: a header row over one body block (chart, list, summary). */
export function DashboardPanelSkeleton({ bodyClassName, action = false, className }: DashboardPanelSkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-36 rounded-pill" />
        {action ? <Skeleton className="h-9 w-32 rounded-button" /> : null}
      </div>
      <Skeleton className={cn("h-64 w-full rounded-card-md", bodyClassName)} />
    </div>
  );
}
