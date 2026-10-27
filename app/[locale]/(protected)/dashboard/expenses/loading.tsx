import { ListPagerSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Expense rows drawn while the list loads. */
const EXPENSE_ROWS = 8;
/** All, Owed, Paid, Void. */
const TABS = 4;

/**
 * Mirrors `ExpensesScreen`: heading with the suppliers / record buttons, the two
 * figures, then the list card — tabs, search and supplier, rows and the pager.
 */
export default function ExpensesLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-40 rounded-button lg:h-9" />
          <Skeleton className="h-4 w-80 max-w-full rounded-pill" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-11 w-28 rounded-button" />
          <Skeleton className="h-11 w-40 rounded-button" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="flex flex-col justify-between gap-4 rounded-card-lg border border-border bg-background px-5 py-4 shadow-xs"
          >
            <Skeleton className="h-4 w-40 rounded-pill" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-7 w-36 rounded-button" />
              <Skeleton className="h-3.5 w-32 max-w-full rounded-pill" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-card-lg border border-border bg-background shadow-xs">
        <div className="flex h-12 items-center gap-6 overflow-hidden border-b border-border px-4">
          {Array.from({ length: TABS }, (_, index) => (
            <Skeleton key={index} className="h-5 w-16 shrink-0 rounded-pill" />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3">
          <Skeleton className="h-11 min-w-0 flex-[1_1_15rem] rounded-input sm:h-10 sm:max-w-md" />
          <Skeleton className="h-11 w-48 rounded-input sm:h-10" />
        </div>
        <ul>
          {Array.from({ length: EXPENSE_ROWS }, (_, index) => (
            <li
              key={index}
              className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border px-5 py-3 first:border-t-0"
            >
              <div className="flex min-w-0 flex-[1_1_12rem] flex-col gap-1.5">
                <Skeleton className="h-5 w-48 max-w-full rounded-pill" />
                <Skeleton className="h-3.5 w-32 max-w-full rounded-pill" />
              </div>
              <Skeleton className="h-4 w-14 rounded-pill" />
              <Skeleton className="h-4 w-24 rounded-pill" />
              <Skeleton className="h-6 w-16 rounded-badge-md" />
              <Skeleton className="h-4 w-24 rounded-pill" />
              <Skeleton className="ms-auto size-11 rounded-button sm:size-9" />
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-4 py-3">
          <ListPagerSkeleton />
        </div>
      </div>
    </LoadingRegion>
  );
}
