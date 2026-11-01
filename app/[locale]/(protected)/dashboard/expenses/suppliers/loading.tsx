import { PAGE_CARD } from "@/src/presentation/dashboard/pageStyles";
import { DashboardPageHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Suppliers drawn while the list loads. */
const SUPPLIER_ROWS = 6;

/** Mirrors `SuppliersScreen`: the way back, heading with the add-supplier button, the supplier rows with what's owed and their edit buttons. */
export default function SuppliersLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={1} />
      <ul className={`${PAGE_CARD} divide-y divide-border overflow-hidden`}>
        {Array.from({ length: SUPPLIER_ROWS }, (_, index) => (
          <li key={index} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40 rounded-pill" />
              <Skeleton className="h-3.5 w-32 rounded-pill" />
            </div>
            <Skeleton className="h-4 w-24 rounded-pill" />
            <div className="flex min-w-32 flex-col items-end gap-1.5">
              <Skeleton className="h-4 w-24 rounded-pill" />
              <Skeleton className="h-3.5 w-16 rounded-pill" />
            </div>
            <Skeleton className="h-11 w-14 shrink-0 rounded-button sm:h-8" />
          </li>
        ))}
      </ul>
    </LoadingRegion>
  );
}
