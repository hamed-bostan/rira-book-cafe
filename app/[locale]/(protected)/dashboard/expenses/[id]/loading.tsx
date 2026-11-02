import { EntryListSkeleton } from "@/src/presentation/dashboard/accounting/EntryListSkeleton";
import { DashboardPageHeaderSkeleton, DashboardSectionSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Date, supplier, account, payment, net, VAT, total. */
const DETAIL_FIELDS = 7;

/** Mirrors `ExpenseDetailScreen`: the way back, title + status with void / pay, the detail card, the journal entries it posted. */
export default function ExpenseLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton />
      <DashboardSectionSkeleton>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
          {Array.from({ length: DETAIL_FIELDS }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-16 rounded-pill" />
              <Skeleton className="h-4 w-28 max-w-full rounded-pill" />
            </div>
          ))}
        </div>
      </DashboardSectionSkeleton>
      <EntryListSkeleton />
    </LoadingRegion>
  );
}
