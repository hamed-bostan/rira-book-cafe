import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system";

type DashboardTableSkeletonProps = {
  /** Rows to draw — match the list's default page size where it fits on screen. */
  rows?: number;
  /** Data columns from `md` (phones show a stacked two-line row instead). */
  columns?: number;
  /** Reserve the search + filter toolbar above the rows. */
  toolbar?: boolean;
  /** How many filter controls sit beside the search box. */
  filters?: number;
  /** Reserve the pager row below the rows. */
  pager?: boolean;
  /** Lead each row with a thumbnail (product and category lists). */
  thumbnail?: boolean;
  className?: string;
};

/**
 * Placeholder for the bordered card every admin list sits in: toolbar, rows,
 * pager. Phones get the stacked card rows the lists switch to below `md`; wider
 * screens get a header strip and evenly spaced cells.
 */
export function DashboardTableSkeleton({
  rows = 8,
  columns = 4,
  toolbar = true,
  filters = 1,
  pager = true,
  thumbnail = false,
  className,
}: DashboardTableSkeletonProps) {
  const rowKeys = Array.from({ length: rows }, (_, index) => index);
  const columnKeys = Array.from({ length: columns }, (_, index) => index);

  return (
    <div className={cn("overflow-hidden rounded-card-lg border border-border bg-background shadow-sm", className)}>
      {toolbar ? (
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <Skeleton className="h-11 w-full rounded-card-md sm:h-10 sm:max-w-sm" />
          {filters > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: filters }, (_, index) => (
                <Skeleton key={index} className="h-11 w-full rounded-card-md sm:h-10 sm:w-36" />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Column header strip (md+). */}
      <div className="hidden items-center gap-4 bg-surface-sunken px-4 py-3 md:flex">
        {thumbnail ? <div className="size-10 shrink-0" /> : null}
        {columnKeys.map((column) => (
          <Skeleton key={column} className="h-3.5 flex-1 rounded-pill bg-muted" />
        ))}
      </div>

      <ul className="divide-y divide-border">
        {rowKeys.map((row) => (
          <li key={row} className="flex items-center gap-4 px-4 py-3.5">
            {thumbnail ? <Skeleton className="size-10 shrink-0 rounded-card-md" /> : null}
            {/* Phones: a title line over a meta line. */}
            <div className="flex flex-1 flex-col gap-2 md:hidden">
              <Skeleton className="h-4 w-3/5 rounded-pill" />
              <Skeleton className="h-3.5 w-2/5 rounded-pill" />
            </div>
            {columnKeys.map((column) => (
              <Skeleton
                key={column}
                className={cn("hidden h-4 flex-1 rounded-pill md:block", column === 0 ? "max-w-48" : "max-w-28")}
              />
            ))}
          </li>
        ))}
      </ul>

      {pager ? (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <Skeleton className="h-10 w-36 rounded-button" />
          <Skeleton className="h-4 w-28 rounded-pill" />
        </div>
      ) : null}
    </div>
  );
}
