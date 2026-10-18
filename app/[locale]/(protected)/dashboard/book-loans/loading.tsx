import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Loan cards drawn while the lending book loads. */
const LOAN_ROWS = 5;

/** Mirrors `BookLoansScreen`: heading with the lend button, search + view filter, then the loan cards. */
export default function BookLoansLoading() {
  return (
    <LoadingRegion className="@container flex min-w-0 flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-8 w-44 rounded-button sm:h-9 sm:w-52" />
            <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
          </div>
          <Skeleton className="h-11 w-32 rounded-button" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 min-w-56 flex-1 rounded-input sm:max-w-xs" />
          <Skeleton className="h-9 w-48 rounded-input" />
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {Array.from({ length: LOAN_ROWS }, (_, index) => (
          <li
            key={index}
            className="flex flex-col gap-3 rounded-card-md border border-border bg-background p-4 @min-[40rem]:flex-row @min-[40rem]:items-start"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="h-4 w-40 rounded-pill" />
                <Skeleton className="h-4 w-24 rounded-pill" />
                <Skeleton className="h-5 w-16 rounded-pill" />
              </div>
              <Skeleton className="h-4 w-48 rounded-pill" />
              <Skeleton className="h-3.5 w-72 max-w-full rounded-pill" />
            </div>
            <div className="flex shrink-0 gap-2">
              <Skeleton className="h-10 w-24 rounded-button" />
              <Skeleton className="h-10 w-20 rounded-button" />
            </div>
          </li>
        ))}
      </ul>
    </LoadingRegion>
  );
}
