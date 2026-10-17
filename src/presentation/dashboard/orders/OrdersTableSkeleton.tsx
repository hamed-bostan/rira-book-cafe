import { Skeleton } from "@/src/presentation/design-system";

/** Cards drawn below the table breakpoint; rows from it — the list's first screen. */
const CARD_COUNT = 6;
const ROW_COUNT = 10;
/** Order · guest · service · items · status · placed · total. */
const COLUMN_COUNT = 7;

/**
 * Placeholder for `OrdersTable` inside its `DataTable` frame: the search + sort
 * row and the service / payment filters, then order cards (one, then two
 * columns) until the `@container` reaches 56rem and the table from there, then
 * the pager. Sits inside a container root, like `OrdersScreen`.
 */
export function OrdersTableSkeleton() {
  return (
    <div className="min-w-0 overflow-hidden rounded-card-lg border border-border">
      <div className="space-y-3 border-b border-border bg-background px-4 py-3">
        <div className="flex min-w-0 flex-col gap-3 @min-[36rem]:flex-row @min-[36rem]:items-center">
          <Skeleton className="h-11 min-w-0 flex-1 rounded-card-md sm:h-10" />
          <Skeleton className="h-11 w-full shrink-0 rounded-card-md @min-[36rem]:w-44" />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-2 border-t border-border pt-3 @sm:grid-cols-2">
          <Skeleton className="h-11 w-full rounded-card-md" />
          <Skeleton className="h-11 w-full rounded-card-md" />
        </div>
      </div>

      {/* Cards, below the table breakpoint. */}
      <div className="grid min-w-0 grid-cols-1 gap-3 p-3 @min-[38rem]:grid-cols-2 @min-[56rem]:hidden">
        {Array.from({ length: CARD_COUNT }, (_, card) => (
          <div key={card} className="flex flex-col gap-3 rounded-card-md border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-5 w-16 rounded-pill" />
                <Skeleton className="h-4 w-28 rounded-pill" />
              </div>
              <Skeleton className="h-6 w-20 rounded-pill" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-20 rounded-pill" />
              <Skeleton className="h-4 w-32 rounded-pill" />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <Skeleton className="h-4 w-24 rounded-pill" />
              <Skeleton className="h-6 w-16 rounded-pill" />
            </div>
          </div>
        ))}
      </div>

      {/* Table, from the breakpoint. */}
      <div className="hidden @min-[56rem]:block">
        <div className="flex items-center gap-4 bg-surface-sunken px-4 py-3">
          {Array.from({ length: COLUMN_COUNT }, (_, column) => (
            <Skeleton key={column} className="h-4 flex-1 rounded-pill bg-muted" />
          ))}
        </div>
        <ul className="divide-y divide-border">
          {Array.from({ length: ROW_COUNT }, (_, row) => (
            <li key={row} className="flex items-center gap-4 bg-background px-4 py-4">
              {Array.from({ length: COLUMN_COUNT }, (_, column) => (
                <div key={column} className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-4/5 rounded-pill" />
                  {column === 1 || column === 3 || column === 5 ? <Skeleton className="h-3.5 w-3/5 rounded-pill" /> : null}
                </div>
              ))}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-background px-4 py-3">
        <Skeleton className="h-9 w-40 rounded-button" />
        <Skeleton className="h-4 w-28 rounded-pill" />
      </div>
    </div>
  );
}
