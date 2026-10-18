import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

type DashboardHeaderSkeletonProps = {
  /** Reserve the primary action button at the inline-end ("New category"). */
  action?: boolean;
  /** Reserve the muted line under the title (a count or subtitle). */
  subtitle?: boolean;
  className?: string;
};

/**
 * Placeholder for a dashboard page's title row: the `dashboard-page-title`
 * heading, its subtitle, and the optional action — stacked on phones and side by
 * side from `sm`, exactly like the list screens' header.
 */
export function DashboardHeaderSkeleton({ action = false, subtitle = true, className }: DashboardHeaderSkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex flex-col gap-2">
        {/* Heading line-height: text-heading-section / sm:text-heading-page. */}
        <Skeleton className="h-8 w-48 rounded-button sm:h-9 sm:w-56" />
        {subtitle ? <Skeleton className="h-4 w-32 rounded-pill" /> : null}
      </div>
      {action ? <Skeleton className="h-11 w-full shrink-0 rounded-button sm:w-40" /> : null}
    </div>
  );
}
