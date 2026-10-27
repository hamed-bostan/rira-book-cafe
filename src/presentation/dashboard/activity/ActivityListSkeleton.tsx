import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

type ActivityEntrySkeletonsProps = {
  rows: number;
  /** Draw the area chip each entry leads with (the full log; per-entity panels omit it). */
  showEntity?: boolean;
};

/**
 * Placeholders for `ActivityEntryRow`s: the initials, the chip + time line, the
 * sentence, and on every other entry a small field diff.
 */
export function ActivityEntrySkeletons({ rows, showEntity = true }: ActivityEntrySkeletonsProps) {
  return (
    <ul>
      {Array.from({ length: rows }, (_, row) => (
        <li key={row} className={cn("flex gap-4 px-5 py-4", row > 0 && "border-t border-border")}>
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-3">
              {showEntity ? <Skeleton className="h-6 w-20 rounded-button" /> : null}
              <Skeleton className="h-4 w-24 rounded-pill" />
            </div>
            <Skeleton className={cn("h-4 rounded-pill", row % 2 === 0 ? "w-3/4" : "w-1/2")} />
            {row % 2 === 0 ? (
              <div className="rounded-button border border-border bg-surface px-3 py-2.5">
                <Skeleton className="h-4 w-2/3 rounded-pill" />
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Placeholder for `ActivityList` — a per-entity panel's entries in their card frame. */
export function ActivityListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-card-lg border border-border bg-background">
      <ActivityEntrySkeletons rows={rows} showEntity={false} />
    </div>
  );
}
