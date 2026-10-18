import { Skeleton } from "@/src/presentation/design-system";

/** today · 7d · 30d · 90d · custom. */
const RANGE_CHIPS = 5;

/**
 * Placeholder for `ReportHeader`: the Reports › title breadcrumb, the heading and
 * subtitle, the range chips, and the "from … to …" caption under them.
 */
export function ReportHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-14 rounded-pill" />
        <Skeleton className="size-3.5 rounded-full" />
        <Skeleton className="h-3.5 w-20 rounded-pill" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-44 rounded-button sm:h-9 sm:w-52" />
        <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: RANGE_CHIPS }, (_, chip) => (
          <Skeleton key={chip} className="h-9 w-20 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-3.5 w-48 rounded-pill" />
    </div>
  );
}
