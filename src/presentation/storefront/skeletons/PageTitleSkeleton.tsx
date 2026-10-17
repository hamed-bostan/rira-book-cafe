import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system";

type PageTitleSkeletonProps = {
  /** Reserve the muted `text-body-small` line under the heading (`mt-1`). */
  subtitle?: boolean;
  className?: string;
};

/**
 * Placeholder for a storefront page's title block: the `text-heading-page` h1
 * (a 44.8px line) and, optionally, its one-line subtitle.
 */
export function PageTitleSkeleton({ subtitle = false, className }: PageTitleSkeletonProps) {
  return (
    <div className={cn(className)}>
      <Skeleton className="h-11.25 w-44 rounded-button" />
      {subtitle ? <Skeleton className="mt-1 h-5.25 w-full max-w-72 rounded-pill" /> : null}
    </div>
  );
}
