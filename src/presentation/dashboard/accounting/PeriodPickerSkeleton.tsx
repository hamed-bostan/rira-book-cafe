import { Skeleton } from "@/src/presentation/design-system";

/** Placeholder for `PeriodPicker`: the fiscal-year and period selects, then the caption naming the span. */
export function PeriodPickerSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3.5 w-16 rounded-pill" />
          <Skeleton className="h-9 w-32 rounded-input" />
        </div>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3.5 w-14 rounded-pill" />
          <Skeleton className="h-9 w-40 rounded-input" />
        </div>
      </div>
      <Skeleton className="h-3.5 w-56 max-w-full rounded-pill" />
    </div>
  );
}
