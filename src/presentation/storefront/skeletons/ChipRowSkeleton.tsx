import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system";

/** Varied chip widths, so the row reads as labels of different lengths. */
const CHIP_WIDTHS = ["w-14", "w-20", "w-16", "w-24", "w-18", "w-22"] as const;

type ChipRowSkeletonProps = {
  /** Chips to draw. */
  count?: number;
  className?: string;
};

/**
 * Placeholder for a row of filter chips (the menu's type and category links):
 * full-radius pills at the chips' height (border + `py-2` + a 21px line), in a
 * row that clips rather than scrolls.
 */
export function ChipRowSkeleton({ count = 4, className }: ChipRowSkeletonProps) {
  return (
    <div className={cn("flex gap-2 overflow-hidden", className)}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={cn("h-9.75 shrink-0 rounded-full", CHIP_WIDTHS[index % CHIP_WIDTHS.length])} />
      ))}
    </div>
  );
}
