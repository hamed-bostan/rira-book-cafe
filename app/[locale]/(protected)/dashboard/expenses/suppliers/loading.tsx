import { BreadcrumbSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

/** Suppliers drawn while the list loads. */
const SUPPLIER_ROWS = 6;

/** Mirrors `SuppliersScreen`: breadcrumb, heading with the add-supplier button, the bordered supplier list with edit buttons. */
export default function SuppliersLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <BreadcrumbSkeleton />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-40 rounded-button sm:h-9 sm:w-48" />
          <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
        </div>
        <Skeleton className="h-10 w-32 rounded-button" />
      </div>

      <ul className="min-w-0 divide-y divide-border overflow-hidden rounded-card-lg border border-border bg-background">
        {Array.from({ length: SUPPLIER_ROWS }, (_, index) => (
          <li key={index} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-40 rounded-pill" />
              <Skeleton className="h-3.5 w-32 rounded-pill" />
            </div>
            <Skeleton className="h-10 w-16 shrink-0 rounded-button" />
          </li>
        ))}
      </ul>
    </LoadingRegion>
  );
}
