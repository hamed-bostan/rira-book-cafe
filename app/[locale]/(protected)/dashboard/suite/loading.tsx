import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Stay rows drawn while the list loads. */
const ROWS = 4;

/**
 * Mirrors `SuiteBookingsScreen`: heading + subtitle with the new-stay button, the
 * availability strip's card, then the stays card — tabs over rows.
 */
export default function SuiteLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-28 rounded-button lg:h-9" />
          <Skeleton className="h-4 w-80 max-w-full rounded-pill" />
        </div>
        <Skeleton className="h-11 w-32 rounded-button" />
      </div>

      <div className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-28 rounded-pill" />
            <Skeleton className="h-4 w-40 rounded-pill" />
          </div>
          <Skeleton className="h-11 w-36 rounded-button sm:h-9" />
        </div>
        <Skeleton className="h-36 w-full rounded-button" />
        <Skeleton className="h-4 w-80 max-w-full rounded-pill" />
      </div>

      <div className="rounded-card-lg border border-border bg-background shadow-xs">
        <div className="flex h-12 items-center gap-6 border-b border-border px-4">
          <Skeleton className="h-5 w-24 rounded-pill" />
          <Skeleton className="h-5 w-16 rounded-pill" />
        </div>
        <ul>
          {Array.from({ length: ROWS }, (_, index) => (
            <li
              key={index}
              className="flex flex-wrap items-start gap-x-5 gap-y-3 border-t border-border px-5 py-4 first:border-t-0"
            >
              <div className="flex w-40 flex-col gap-1.5">
                <Skeleton className="h-6 w-36 rounded-pill" />
                <Skeleton className="h-4 w-24 rounded-pill" />
              </div>
              <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-2">
                <Skeleton className="h-5 w-48 max-w-full rounded-pill" />
                <Skeleton className="h-4 w-56 max-w-full rounded-pill" />
              </div>
              <Skeleton className="ms-auto h-11 w-24 rounded-button sm:h-9" />
            </li>
          ))}
        </ul>
      </div>
    </LoadingRegion>
  );
}
