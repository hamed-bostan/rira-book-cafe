import { cn } from "@/src/lib/utils";
import { ListPagerSkeleton } from "@/src/presentation/dashboard/skeletons";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

import { PAGE_CARD, ROW_TEXT, TABLE_HEAD, TABLE_TH } from "../pageStyles";

import type { StackedTableStyles } from "../stackedTableStyles";
import type { ReactNode } from "react";

type StackedTableSkeletonProps = {
  /** The screen's table layout, so the placeholder stacks at the same width it does. */
  layout: StackedTableStyles;
  /** One entry per column, by alignment: text columns sit at the start, amounts at the end. The first leads a stacked row. */
  columns: readonly ("start" | "end")[];
  rows?: number;
  /** Reserve the totals row under the table. */
  totals?: boolean;
  /** What sits over the table inside the card, such as its filters. */
  toolbar?: ReactNode;
  /** Reserve the `ListPager` row under the table (stock movements). */
  pager?: boolean;
  className?: string;
};

/**
 * Placeholder for a table that stacks on a narrow card (`STACKED_TABLE`): built on
 * the same layout, so it is rows of a lead line over labelled figures where the
 * screen stacks, and columns under the muted band where it's a table.
 */
export function StackedTableSkeleton({
  layout,
  columns,
  rows = 8,
  totals = false,
  toolbar,
  pager = false,
  className,
}: StackedTableSkeletonProps) {
  const [, ...rest] = columns;

  return (
    <section className={cn(PAGE_CARD, layout.frame, "overflow-hidden", className)}>
      {toolbar}
      <table aria-hidden className={cn(ROW_TEXT, layout.table)}>
        <thead className={cn(TABLE_HEAD, layout.head)}>
          <tr>
            {columns.map((align, index) => (
              <th key={index} className={cn(TABLE_TH, align === "end" ? "text-end" : "text-start")}>
                <Skeleton className="inline-block h-3 w-14 rounded-pill" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cn(layout.body, "divide-y divide-border")}>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row} className={layout.row}>
              <td className={layout.lead}>
                <Skeleton className={cn("inline-block h-4 max-w-full rounded-pill", row % 2 === 0 ? "w-48" : "w-36")} />
              </td>
              {rest.map((align, index) => (
                <td key={index} className={cn(layout.cell, align === "end" && layout.amount)}>
                  <Skeleton className={cn("h-3 w-12 rounded-pill", layout.label)} />
                  <Skeleton className="inline-block h-4 w-20 rounded-pill" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totals ? (
          <tfoot className={cn(layout.foot, "border-t border-border bg-muted")}>
            <tr className={layout.pairRow}>
              <td colSpan={columns.length - 1} className={layout.cell}>
                <Skeleton className="h-4 w-20 rounded-pill" />
              </td>
              <td className={cn(layout.cell, layout.amount)}>
                <Skeleton className="inline-block h-4 w-24 rounded-pill" />
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
      {pager ? (
        <div className="border-t border-border px-5 py-3">
          <ListPagerSkeleton />
        </div>
      ) : null}
    </section>
  );
}
