import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system";

type StatementSectionSkeletonProps = {
  rows?: number;
  /** Reserve the total strip at the foot (statement sections; the chart of accounts has none). */
  total?: boolean;
  /** Row padding: statements use `py-2.5`, the chart of accounts `py-3`. */
  dense?: boolean;
  className?: string;
};

/**
 * Placeholder for one account group — a `StatementSectionTable`, or one type
 * section of the chart of accounts: a `bg-surface` heading strip, code / name /
 * amount rows, and the total.
 */
export function StatementSectionSkeleton({ rows = 4, total = true, dense = true, className }: StatementSectionSkeletonProps) {
  return (
    <section className={cn("min-w-0 overflow-hidden rounded-card-lg border border-border bg-background", className)}>
      <div className="flex h-11 items-center border-b border-border bg-surface px-4">
        <Skeleton className="h-4 w-24 rounded-pill" />
      </div>
      <ul className="divide-y divide-border">
        {Array.from({ length: rows }, (_, row) => (
          <li key={row} className={cn("flex items-center gap-3 px-4", dense ? "py-2.5" : "py-3")}>
            <Skeleton className="h-4 w-10 shrink-0 rounded-pill" />
            <div className="flex h-5 min-w-0 flex-1 items-center">
              <Skeleton className={cn("h-4 rounded-pill", row % 2 === 0 ? "w-2/5" : "w-1/3")} />
            </div>
            <Skeleton className="h-4 w-20 shrink-0 rounded-pill" />
          </li>
        ))}
      </ul>
      {total ? (
        <div className="flex h-11 items-center justify-between gap-3 border-t border-border bg-surface px-4">
          <Skeleton className="h-4 w-24 rounded-pill" />
          <Skeleton className="h-4 w-24 rounded-pill" />
        </div>
      ) : null}
    </section>
  );
}
