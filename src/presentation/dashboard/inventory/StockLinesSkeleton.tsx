import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/**
 * Placeholder for `StockLinesFields` — the item / quantity / cost line the
 * delivery and opening-stock forms both start with: a bordered card on phones,
 * one grid row from `md`, then the "add line" button and the running total.
 */
export function StockLinesSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="mb-2 h-4 w-24 rounded-pill" />
      <div className="grid grid-cols-2 gap-2 rounded-card-md border border-border p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start md:border-0 md:p-0">
        <Skeleton className="col-span-2 h-10 rounded-input md:col-span-1" />
        <Skeleton className="h-10 rounded-input" />
        <Skeleton className="h-10 rounded-input" />
        <Skeleton className="size-10 justify-self-end rounded-button" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-10 w-32 rounded-button" />
        <Skeleton className="h-4 w-28 rounded-pill" />
      </div>
    </div>
  );
}
