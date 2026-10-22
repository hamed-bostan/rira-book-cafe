import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Loan rows drawn while the lending book loads. */
const LOAN_ROWS = 5;
/** On loan, Overdue, Returned, Lost, All. */
const TABS = 5;

/**
 * Mirrors `BookLoansScreen`: heading with the lend button, the Book holds card,
 * then the loans card — tabs, search, rows.
 */
export default function BookLoansLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-44 rounded-button lg:h-9" />
          <Skeleton className="h-4 w-80 max-w-full rounded-pill" />
        </div>
        <Skeleton className="h-11 w-36 rounded-button" />
      </div>

      <div className="flex items-center gap-4 rounded-card-lg border border-border bg-background px-5 py-4 shadow-xs">
        <Skeleton className="size-10 shrink-0 rounded-button" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-28 rounded-pill" />
          <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
        </div>
      </div>

      <div className="rounded-card-lg border border-border bg-background shadow-xs">
        <div className="flex h-12 items-center gap-6 overflow-hidden border-b border-border px-4">
          {Array.from({ length: TABS }, (_, index) => (
            <Skeleton key={index} className="h-5 w-20 shrink-0 rounded-pill" />
          ))}
        </div>
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-11 w-full max-w-md rounded-input sm:h-10" />
        </div>
        <ul>
          {Array.from({ length: LOAN_ROWS }, (_, index) => (
            <li
              key={index}
              className="flex flex-wrap items-start gap-x-5 gap-y-3 border-t border-border px-5 py-4 first:border-t-0"
            >
              <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-2">
                <Skeleton className="h-5 w-64 max-w-full rounded-pill" />
                <Skeleton className="h-4 w-48 max-w-full rounded-pill" />
                <Skeleton className="h-3 w-56 max-w-full rounded-pill" />
              </div>
              <Skeleton className="ms-auto h-11 w-24 rounded-button sm:h-9" />
            </li>
          ))}
        </ul>
      </div>
    </LoadingRegion>
  );
}
