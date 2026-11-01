import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

type DashboardFieldSkeletonProps = {
  /** Reserve the hint under the control. */
  hint?: boolean;
  /** A textarea's height instead of an input's. */
  tall?: boolean;
};

/** Placeholder for `DashboardFormField`: its label, control and optional hint. */
export function DashboardFieldSkeleton({ hint = false, tall = false }: DashboardFieldSkeletonProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Skeleton className="h-5 w-20 rounded-pill" />
      <Skeleton className={cn("w-full rounded-input", tall ? "h-24" : "h-11 sm:h-9")} />
      {hint ? <Skeleton className="h-4 w-48 max-w-full rounded-pill" /> : null}
    </div>
  );
}
