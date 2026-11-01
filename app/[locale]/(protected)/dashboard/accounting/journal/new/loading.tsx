import { PAGE_CARD } from "@/src/presentation/dashboard/pageStyles";
import { DashboardFieldSkeleton, DashboardPageHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Mirrors the new-entry page: the way back and heading, then `ManualEntryForm` — date + description, two lines, add-line row, submit. */
export default function NewJournalEntryLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={0} />
      <div className={`${PAGE_CARD} flex flex-col gap-5 p-5`}>
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
          <DashboardFieldSkeleton hint />
          <DashboardFieldSkeleton />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="mb-3 h-5 w-16 rounded-pill" />
          {Array.from({ length: 2 }, (_, index) => (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] md:grid-cols-[minmax(0,2fr)_8rem_8rem_minmax(0,1fr)_2.25rem]"
            >
              <Skeleton className="col-span-full h-11 rounded-input sm:h-9 md:col-span-1" />
              <Skeleton className="h-11 rounded-input sm:h-9" />
              <Skeleton className="h-11 rounded-input sm:h-9" />
              <Skeleton className="col-span-2 h-11 rounded-input sm:h-9 md:col-span-1" />
              <Skeleton className="size-11 justify-self-end rounded-button sm:size-9" />
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-11 w-28 rounded-button sm:h-9" />
            <Skeleton className="h-4 w-56 rounded-pill" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-24 rounded-button sm:h-9" />
          <Skeleton className="h-11 w-20 rounded-button sm:h-9" />
        </div>
      </div>
    </LoadingRegion>
  );
}
