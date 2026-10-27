import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** All · in queue · placed · preparing · served · cancelled. */
const STATUS_TABS = 6;
/** Search, then the service, payment and sort dropdowns. */
const TOOLBAR_DROPDOWNS = 3;
/** Cards drawn below the table breakpoint; rows from it — the list's first screen. */
const CARD_COUNT = 6;
const ROW_COUNT = 10;
/** Order · guest · service · items · status · placed · total. */
const COLUMN_COUNT = 7;

/**
 * Placeholder for `OrdersTable` inside its `DataTable` frame: the status tabs and
 * the toolbar along the top edge, then order cards (one, then two columns) until
 * the `@container` reaches 56rem and the table from there, then the pager. Sits
 * inside a container root, like `OrdersScreen`.
 */
export function OrdersTableSkeleton() {
  return (
    <div className="min-w-0 overflow-hidden rounded-card-lg border border-border">
      <div className="flex h-12 items-center gap-6 overflow-hidden border-b border-border bg-background px-4">
        {Array.from({ length: STATUS_TABS }, (_, tab) => (
          <Skeleton key={tab} className="h-5 w-20 shrink-0 rounded-pill" />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-3">
        <Skeleton className="h-11 min-w-0 flex-[1_1_20rem] rounded-card-md sm:h-9" />
        {Array.from({ length: TOOLBAR_DROPDOWNS }, (_, dropdown) => (
          <Skeleton key={dropdown} className="h-11 w-32 rounded-card-md sm:h-9" />
        ))}
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
            <Skeleton key={column} className="h-3 flex-1 rounded-pill bg-muted" />
          ))}
        </div>
        <ul className="divide-y divide-border">
          {Array.from({ length: ROW_COUNT }, (_, row) => (
            <li key={row} className="flex items-center gap-4 bg-background px-4 py-3">
              {Array.from({ length: COLUMN_COUNT }, (_, column) => (
                <div key={column} className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-4/5 rounded-pill" />
                  {column === 1 || column === 3 || column === 5 ? (
                    <Skeleton className="h-3 w-3/5 rounded-pill" />
                  ) : null}
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
