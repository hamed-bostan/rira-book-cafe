import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Placeholder for a list of `DashboardTimelineItem`s: dots on a line, a label and a date beside each. */
export function DashboardTimelineSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4 border-s border-border ps-4">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-3/5 rounded-pill" />
          <Skeleton className="h-3.5 w-24 rounded-pill" />
        </div>
      ))}
    </div>
  );
}
