import { Skeleton } from "@/src/presentation/design-system";

/**
 * Placeholder for `EventForm`: kind picker, the locale tabs with title and
 * description, start / end and capacity / price two-up, the image upload, the
 * published switch row, and the submit row.
 */
export function EventFormSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-16 rounded-pill" />
        <Skeleton className="h-12 w-full rounded-input" />
      </div>

      <div className="flex flex-col">
        <div className="inline-flex w-fit gap-1 rounded-card-lg bg-surface-sunken p-1">
          <Skeleton className="h-8 w-20 rounded-card-md" />
          <Skeleton className="h-8 w-20 rounded-card-md" />
        </div>
        <div className="flex flex-col gap-5 pt-4">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-14 rounded-pill" />
            <Skeleton className="h-10 w-full rounded-input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-24 rounded-pill" />
            <Skeleton className="h-32 w-full rounded-input" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-20 rounded-pill" />
            <Skeleton className="h-10 w-full rounded-input" />
          </div>
        ))}
      </div>
      <Skeleton className="-mt-3 h-3.5 w-48 rounded-pill" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-20 rounded-pill" />
            <Skeleton className="h-10 w-full rounded-input" />
            <Skeleton className="h-3.5 w-36 max-w-full rounded-pill" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-14 rounded-pill" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-20 shrink-0 rounded-card-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28 rounded-button" />
            <Skeleton className="h-10 w-20 rounded-button" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-card-md border border-border px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-20 rounded-pill" />
          <Skeleton className="h-3.5 w-48 rounded-pill" />
        </div>
        <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
      </div>

      <div className="flex gap-3 pt-2">
        <Skeleton className="h-11 w-32 rounded-button" />
        <Skeleton className="h-11 w-24 rounded-button" />
      </div>
    </div>
  );
}
