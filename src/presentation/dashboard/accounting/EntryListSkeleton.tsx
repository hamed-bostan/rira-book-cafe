import { DashboardSectionSkeleton } from "@/src/presentation/dashboard/skeletons";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

import { ROW_END } from "../pageStyles";

/**
 * Placeholder for the journal entries behind an expense or a pay run: a titled card
 * of rows, each its number and date, the source badge, and the total at the row's end.
 */
export function EntryListSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <DashboardSectionSkeleton flush>
      <ul className="divide-y divide-border">
        {Array.from({ length: rows }, (_, index) => (
          <li key={index} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-16 rounded-pill" />
              <Skeleton className="h-3.5 w-24 rounded-pill" />
            </div>
            <Skeleton className="h-6 w-20 rounded-pill" />
            <div className={ROW_END}>
              <Skeleton className="h-4 w-28 rounded-pill" />
            </div>
          </li>
        ))}
      </ul>
    </DashboardSectionSkeleton>
  );
}
