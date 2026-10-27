import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** One width per tab, in `AccountingHeader` order, so the tabs read as labels of different lengths. */
const TAB_WIDTHS = ["w-16", "w-14", "w-16", "w-20", "w-10", "w-14"] as const;

type AccountingHeaderSkeletonProps = {
  /** Holds the line the tab shows under the tabs. */
  intro?: boolean;
};

/** Placeholder for `AccountingHeader`: heading and subtitle, the two actions, the underlined tabs. */
export function AccountingHeaderSkeleton({ intro = false }: AccountingHeaderSkeletonProps) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-40 rounded-button sm:h-9 sm:w-48" />
          <Skeleton className="h-4 w-96 max-w-full rounded-pill" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-40 rounded-button sm:h-9" />
          <Skeleton className="h-11 w-32 rounded-button sm:h-9" />
        </div>
      </div>
      <div className="flex h-12 items-center gap-6 overflow-hidden border-b border-border">
        {TAB_WIDTHS.map((width, index) => (
          <Skeleton key={index} className={cn("h-4 shrink-0 rounded-pill", width)} />
        ))}
      </div>
      {intro ? <Skeleton className="h-4 w-[28rem] max-w-full rounded-pill" /> : null}
    </>
  );
}
