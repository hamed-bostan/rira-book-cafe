import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system";

/** One width per tab, in `AccountingTabs` order, so the pills read as labels of different lengths. */
const TAB_WIDTHS = ["w-20", "w-20", "w-24", "w-24", "w-16", "w-20"] as const;

/** Placeholder for `AccountingTabs`: the page title and subtitle over the section's six pill tabs. */
export function AccountingTabsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-44 rounded-button sm:h-9 sm:w-52" />
        <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
      </div>
      <div className="-mx-1 flex gap-1 overflow-hidden px-1 pb-1">
        {TAB_WIDTHS.map((width, index) => (
          <Skeleton key={index} className={cn("h-9 shrink-0 rounded-full", width)} />
        ))}
      </div>
    </div>
  );
}
