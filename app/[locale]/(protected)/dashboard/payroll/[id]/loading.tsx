import { EntryListSkeleton } from "@/src/presentation/dashboard/accounting/EntryListSkeleton";
import { StackedTableSkeleton } from "@/src/presentation/dashboard/accounting/StackedTableSkeleton";
import { DashboardPageHeaderSkeleton, DashboardSectionSkeleton } from "@/src/presentation/dashboard/skeletons";
import { STACKED_TABLE } from "@/src/presentation/dashboard/stackedTableStyles";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Booked on, payment, and the total paid. */
const DETAIL_FIELDS = 3;

/** Name and salary: runs are recorded with a salary alone, so few have the deductions' six columns. */
const PEOPLE_COLUMNS = ["start", "end"] as const;

/** Mirrors `PayRunScreen`: the way back and heading with its actions, the month's details, who's paid with the totals, the journal entries. */
export default function PayRunLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={2} />
      <DashboardSectionSkeleton>
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
          {Array.from({ length: DETAIL_FIELDS }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-16 rounded-pill" />
              <Skeleton className="h-4 w-28 max-w-full rounded-pill" />
            </div>
          ))}
        </div>
      </DashboardSectionSkeleton>
      <StackedTableSkeleton layout={STACKED_TABLE.narrow} columns={PEOPLE_COLUMNS} rows={4} totals title />
      <EntryListSkeleton />
    </LoadingRegion>
  );
}
