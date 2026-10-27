import { AccountingHeaderSkeleton } from "@/src/presentation/dashboard/accounting/AccountingHeaderSkeleton";
import { ListPagerSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Entries drawn while the journal loads. */
const ENTRY_ROWS = 8;

/** Mirrors `JournalScreen`: the Accounting header and intro, then the journal card — "Posted by", entries, pager. */
export default function JournalLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <AccountingHeaderSkeleton intro />

      <div className="rounded-card-lg border border-border bg-background shadow-xs">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-11 w-48 rounded-button sm:h-9" />
        </div>
        <ul>
          {Array.from({ length: ENTRY_ROWS }, (_, index) => (
            <li
              key={index}
              className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border px-5 py-3 first:border-t-0"
            >
              <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1.5">
                <Skeleton className="h-5 w-48 max-w-full rounded-pill" />
                <Skeleton className="h-3.5 w-64 max-w-full rounded-pill" />
              </div>
              <Skeleton className="h-4 w-14 rounded-pill" />
              <Skeleton className="h-4 w-20 rounded-pill" />
              <Skeleton className="h-4 w-24 rounded-pill" />
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
