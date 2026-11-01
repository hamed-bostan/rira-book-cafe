import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/**
 * Placeholder for `StockLinesFields` — the item / quantity / cost line the
 * delivery and opening-stock forms both start with, stacked on phones and one
 * row from `md`, then the "add line" button and the running total.
 */
export function StockLinesSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="mb-3 h-5 w-16 rounded-pill" />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] md:grid-cols-[minmax(0,2fr)_9rem_10rem_2.25rem]">
        <Skeleton className="col-span-full h-11 rounded-input sm:h-9 md:col-span-1" />
        <Skeleton className="h-11 rounded-input sm:h-9" />
        <Skeleton className="h-11 rounded-input sm:h-9" />
        <Skeleton className="size-11 justify-self-end rounded-button sm:size-9" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-11 w-28 rounded-button sm:h-9" />
        <Skeleton className="h-4 w-28 rounded-pill" />
      </div>
    </div>
  );
}
