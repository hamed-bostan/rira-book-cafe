import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Rows (and phone cards) drawn — the list's first screen. */
const ROW_COUNT = 10;
/** Category · price · stock · visibility · actions, after the product cell. */
const TRAILING_COLUMNS = 5;

/**
 * Placeholder for `ProductsTable` inside its `DataTable` frame: the search box
 * and four filters, then product cards (with the select-all + sort bar) until the
 * `@container/products` reaches 4xl and the table from there, then the pager.
 * Sits inside the `@container/products` root, like `ProductsScreen`.
 */
export function ProductsTableSkeleton() {
  return (
    <div className="min-w-0 overflow-hidden rounded-card-lg border border-border bg-background">
      <div className="space-y-3 border-b border-border bg-background px-4 py-3">
        <Skeleton className="h-11 w-full rounded-card-md sm:h-10" />
        <div className="grid min-w-0 grid-cols-1 gap-2 border-t border-border pt-3 @sm/products:grid-cols-2 @3xl/products:grid-cols-4">
          {Array.from({ length: 4 }, (_, filter) => (
            <Skeleton key={filter} className="h-11 w-full rounded-card-md" />
          ))}
        </div>
      </div>

      {/* Cards, below the table breakpoint. */}
      <div className="@4xl/products:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-sunken/50 p-4">
          <Skeleton className="h-11 w-28 rounded-pill" />
          <Skeleton className="h-11 w-full rounded-card-md @sm/products:w-44" />
        </div>
        <ul className="divide-y divide-border">
          {Array.from({ length: ROW_COUNT }, (_, card) => (
            <li key={card} className="space-y-4 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="size-14 shrink-0 rounded-card-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-3/5 rounded-pill" />
                  <Skeleton className="h-3.5 w-2/5 rounded-pill" />
                  <Skeleton className="h-4 w-1/3 rounded-pill" />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Skeleton className="size-11 rounded-button" />
                  <Skeleton className="size-11 rounded-button" />
                </div>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border/60 pt-3">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-10 rounded-pill" />
                  <Skeleton className="h-4 w-20 rounded-pill" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Skeleton className="h-6 w-16 rounded-pill" />
                  <Skeleton className="h-6 w-20 rounded-pill" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Table, from the breakpoint. */}
      <div className="hidden @4xl/products:block">
        <div className="flex items-center gap-4 bg-surface-sunken px-4 py-3">
          <div className="size-8 shrink-0" />
          <Skeleton className="h-4 flex-[2] rounded-pill bg-muted" />
          {Array.from({ length: TRAILING_COLUMNS }, (_, column) => (
            <Skeleton key={column} className="h-4 flex-1 rounded-pill bg-muted" />
          ))}
        </div>
        <ul className="divide-y divide-border">
          {Array.from({ length: ROW_COUNT }, (_, row) => (
            <li key={row} className="flex items-center gap-4 px-4 py-3">
              <div className="flex size-8 shrink-0 items-center justify-center">
                <Skeleton className="size-5 rounded-input" />
              </div>
              <div className="flex flex-[2] items-center gap-3">
                <Skeleton className="size-11 shrink-0 rounded-card-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-4/5 rounded-pill" />
                  <Skeleton className="h-3.5 w-1/2 rounded-pill" />
                </div>
              </div>
              {Array.from({ length: TRAILING_COLUMNS }, (_, column) => (
                <div key={column} className="flex-1">
                  <Skeleton className="h-4 w-3/4 rounded-pill" />
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
