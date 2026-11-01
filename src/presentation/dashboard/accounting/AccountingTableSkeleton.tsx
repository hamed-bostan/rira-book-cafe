import { cn } from "@/src/lib/utils";
import { ListPagerSkeleton } from "@/src/presentation/dashboard/skeletons";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

import { PAGE_CARD } from "../pageStyles";

type AccountingTableSkeletonProps = {
  /** One entry per column, by alignment: text columns sit at the start, amounts at the end. */
  columns: readonly ("start" | "end")[];
  rows?: number;
  /** Reserve the `tfoot` totals strip (journal entry, ledger, trial balance). */
  totals?: boolean;
  /** Reserve the `ListPager` row under the table (journal, expenses). */
  pager?: boolean;
  className?: string;
};

/**
 * Placeholder for the tables the accounting screens share: the muted band of small
 * capitals, `px-5 py-3` rows, and optionally the totals strip and the pager below.
 */
export function AccountingTableSkeleton({
  columns,
  rows = 8,
  totals = false,
  pager = false,
  className,
}: AccountingTableSkeletonProps) {
  return (
    <section className={cn(PAGE_CARD, "overflow-hidden", className)}>
      <div className="flex gap-4 border-b border-border bg-muted px-5 py-2">
        {columns.map((align, index) => (
          <div
            key={index}
            className={cn("flex h-4 flex-1 items-center", align === "end" ? "justify-end" : "justify-start")}
          >
            <Skeleton className="h-3 w-14 rounded-pill" />
          </div>
        ))}
      </div>
      <ul className="divide-y divide-border">
        {Array.from({ length: rows }, (_, row) => (
          <li key={row} className="flex gap-4 px-5 py-3">
            {columns.map((align, index) => (
              <div
                key={index}
                className={cn("flex h-5 flex-1 items-center", align === "end" ? "justify-end" : "justify-start")}
              >
                <Skeleton className={cn("h-4 rounded-pill", index === 0 ? "w-4/5" : "w-3/5")} />
              </div>
            ))}
          </li>
        ))}
      </ul>
      {totals ? (
        <div className="flex items-center justify-between gap-4 border-t border-border bg-muted px-5 py-3">
          <Skeleton className="h-4 w-20 rounded-pill" />
          <Skeleton className="h-4 w-24 rounded-pill" />
        </div>
      ) : null}
      {pager ? (
        <div className="border-t border-border px-5 py-3">
          <ListPagerSkeleton />
        </div>
      ) : null}
    </section>
  );
}
