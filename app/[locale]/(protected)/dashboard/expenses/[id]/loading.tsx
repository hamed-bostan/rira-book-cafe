import { BreadcrumbSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Date, supplier, account, payment, net, VAT — the total takes its own full-width row. */
const DETAIL_FIELDS = 6;

/** Mirrors `ExpenseDetailScreen`: breadcrumb, title + status with pay / void actions, the detail card, the journal entries it posted. */
export default function ExpenseLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <BreadcrumbSkeleton />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-40 rounded-button sm:h-9 sm:w-48" />
            <Skeleton className="h-6 w-16 rounded-pill" />
          </div>
          <Skeleton className="h-5 w-64 max-w-full rounded-pill" />
          <Skeleton className="h-3.5 w-36 rounded-pill" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-24 rounded-button" />
          <Skeleton className="h-10 w-20 rounded-button" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-card-lg border border-border bg-background p-4 sm:grid-cols-2 md:p-6">
        {Array.from({ length: DETAIL_FIELDS }, (_, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-16 rounded-pill" />
            <Skeleton className="h-4 w-32 rounded-pill" />
          </div>
        ))}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Skeleton className="h-3.5 w-12 rounded-pill" />
          <Skeleton className="h-6 w-36 rounded-pill" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40 rounded-pill" />
        <ul className="divide-y divide-border overflow-hidden rounded-card-lg border border-border bg-background">
          {Array.from({ length: 2 }, (_, index) => (
            <li key={index} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Skeleton className="h-4 w-14 rounded-pill" />
              <Skeleton className="h-4 w-24 rounded-pill" />
              <div className="flex h-5 min-w-0 flex-1 items-center">
                <Skeleton className="h-4 w-24 rounded-pill" />
              </div>
              <Skeleton className="h-4 w-20 rounded-pill" />
            </li>
          ))}
        </ul>
      </div>
    </LoadingRegion>
  );
}
