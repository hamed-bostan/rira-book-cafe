import { BreadcrumbSkeleton } from "@/src/presentation/dashboard/skeletons";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

import { PeriodPickerSkeleton } from "./PeriodPickerSkeleton";

/** Placeholder for `StatementHeader`: breadcrumb, title and subtitle, then the period picker panel. */
export function StatementHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <BreadcrumbSkeleton />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-48 rounded-button sm:h-9 sm:w-56" />
        <Skeleton className="h-4 w-72 max-w-full rounded-pill" />
      </div>
      <div className="rounded-card-lg border border-border bg-background p-4 md:p-6">
        <PeriodPickerSkeleton />
      </div>
    </div>
  );
}
