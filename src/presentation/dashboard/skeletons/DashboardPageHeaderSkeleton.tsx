import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

type DashboardPageHeaderSkeletonProps = {
  /** How many buttons the header reserves at the inline-end. */
  actions?: number;
};

/** Placeholder for `DashboardPageHeader`: the way back, the title and subtitle, and the page's buttons. */
export function DashboardPageHeaderSkeleton({ actions = 2 }: DashboardPageHeaderSkeletonProps) {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-28 rounded-pill" />
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-44 rounded-button lg:h-8" />
          <Skeleton className="h-5 w-56 max-w-full rounded-pill" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: actions }, (_, action) => (
            <Skeleton key={action} className="h-11 w-24 rounded-button sm:h-9" />
          ))}
        </div>
      </div>
    </div>
  );
}
