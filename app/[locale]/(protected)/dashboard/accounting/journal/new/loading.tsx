import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

/** Mirrors the new-entry page: heading, then `ManualEntryForm` — date + description, two debit/credit lines, add-line row, submit. */
export default function NewJournalEntryLoading() {
  return (
    <LoadingRegion className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-48 rounded-button sm:h-9 sm:w-56" />
        <Skeleton className="h-4 w-72 max-w-full rounded-pill" />
      </div>

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[12rem_1fr]">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-16 rounded-pill" />
            <Skeleton className="h-10 w-full rounded-input" />
            <Skeleton className="h-3.5 w-28 rounded-pill" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-24 rounded-pill" />
            <Skeleton className="h-10 w-full rounded-input" />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Skeleton className="mb-2 h-4 w-16 rounded-pill" />
          {Array.from({ length: 2 }, (_, index) => (
            <div
              key={index}
              className="grid grid-cols-2 gap-2 rounded-card-md border border-border p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-start md:border-0 md:p-0"
            >
              <Skeleton className="col-span-2 h-10 rounded-input md:col-span-1" />
              <Skeleton className="h-10 rounded-input" />
              <Skeleton className="h-10 rounded-input" />
              <Skeleton className="col-span-2 h-10 rounded-input md:col-span-1" />
              <Skeleton className="col-span-2 size-10 justify-self-end rounded-button md:col-span-1" />
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-10 w-28 rounded-button" />
            <Skeleton className="h-4 w-56 rounded-pill" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Skeleton className="h-11 w-24 rounded-button" />
          <Skeleton className="h-11 w-24 rounded-button" />
        </div>
      </div>
    </LoadingRegion>
  );
}
