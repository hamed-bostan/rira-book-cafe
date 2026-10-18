import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

type RecordRowSkeletonProps = {
  /** Reserve the amount at the inline-end (an order's total). */
  amount?: boolean;
  className?: string;
};

/**
 * Placeholder for one bordered record row (an order, a reservation, a suite
 * stay, a book loan): a strong title line over a caption, then the status badge.
 */
export function RecordRowSkeleton({ amount = false, className }: RecordRowSkeletonProps) {
  return (
    <div className={cn("flex items-center gap-3 rounded-card-md border border-border p-4", className)}>
      <div className="flex min-w-0 flex-1 flex-col">
        <Skeleton className="h-5.25 w-40 max-w-full rounded-pill" />
        <Skeleton className="h-4.5 w-56 max-w-full rounded-pill" />
      </div>
      <Skeleton className="h-6.5 w-16 shrink-0 rounded-badge-md" />
      {amount ? <Skeleton className="h-5.25 w-20 shrink-0 rounded-pill" /> : null}
    </div>
  );
}
