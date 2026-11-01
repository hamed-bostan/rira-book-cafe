import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Placeholder for `PeriodPicker`: the fiscal-year and period selects, then the caption naming the span. */
export function PeriodPickerSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-16 rounded-pill" />
          <Skeleton className="h-11 w-32 rounded-input sm:h-9" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-14 rounded-pill" />
          <Skeleton className="h-11 w-40 rounded-input sm:h-9" />
        </div>
      </div>
      <Skeleton className="h-4 w-56 max-w-full rounded-pill" />
    </div>
  );
}
