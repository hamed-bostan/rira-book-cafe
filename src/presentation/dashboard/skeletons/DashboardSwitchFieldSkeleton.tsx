import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Placeholder for `DashboardSwitchField`: the small switch, then its label and hint. */
export function DashboardSwitchFieldSkeleton() {
  return (
    <div className="flex items-start gap-3">
      <Skeleton className="mt-0.5 h-5 w-9 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-24 rounded-pill" />
        <Skeleton className="h-3.5 w-48 max-w-full rounded-pill" />
      </div>
    </div>
  );
}
