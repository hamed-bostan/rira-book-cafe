import { PAGE_CARD, ROW_END } from "@/src/presentation/dashboard/pageStyles";
import { DashboardPageHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Rows drawn while it loads. */
const ROWS = 6;

/** Mirrors `EmployeesScreen`: the way back and heading with the add button, then the people with their pay and edit buttons. */
export default function EmployeesLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={1} />
      <ul className={`${PAGE_CARD} divide-y divide-border overflow-hidden`}>
        {Array.from({ length: ROWS }, (_, index) => (
          <li key={index} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40 rounded-pill" />
              <Skeleton className="h-3.5 w-24 rounded-pill" />
            </div>
            <div className={ROW_END}>
              <Skeleton className="h-4 w-28 rounded-pill" />
              <Skeleton className="h-11 w-14 shrink-0 rounded-button sm:h-8" />
            </div>
          </li>
        ))}
      </ul>
    </LoadingRegion>
  );
}
