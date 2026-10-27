import { cn } from "@/src/lib/utils";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Closed shifts drawn in the history panel. */
const HISTORY_ROWS = 5;
/** The till figures on the open shift: float, cash expected, card & transfer, online. */
const SHIFT_FIGURES = 4;

const PANEL = "flex flex-col rounded-card-lg border border-border bg-background p-5 shadow-xs";

/**
 * Mirrors `CashShiftsScreen` with a shift open — the usual state while the cafe
 * trades: the open-shift panel with its four figures, the close form, then the
 * history of closed shifts.
 */
export default function CashShiftsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-44 rounded-button sm:h-9 sm:w-52" />
        <Skeleton className="h-4 w-96 max-w-full rounded-pill" />
      </div>

      <div className={cn(PANEL, "gap-5")}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-44 rounded-pill" />
            <Skeleton className="h-6 w-14 rounded-badge-md" />
          </div>
          <Skeleton className="h-4 w-56 max-w-full rounded-pill" />
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: SHIFT_FIGURES }, (_, index) => (
            <div
              key={index}
              className="flex flex-col gap-4 rounded-card-lg border border-border bg-background px-5 py-4 shadow-xs"
            >
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-24 rounded-pill" />
                <Skeleton className="size-4 rounded-full" />
              </div>
              <Skeleton className="h-7 w-32 max-w-full rounded-pill sm:h-8" />
            </div>
          ))}
        </div>
        <Skeleton className="h-3.5 w-44 rounded-pill" />
      </div>

      <div className={cn(PANEL, "gap-4")}>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-36 rounded-pill" />
          <Skeleton className="h-4 w-96 max-w-full rounded-pill" />
        </div>
        <div className="flex max-w-md flex-col gap-4">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-28 rounded-pill" />
              <Skeleton className="h-11 w-full rounded-input sm:h-10" />
            </div>
          ))}
          <Skeleton className="h-11 w-28 rounded-button sm:h-8" />
        </div>
      </div>

      <div className={cn(PANEL, "gap-2")}>
        <Skeleton className="h-6 w-32 rounded-pill" />
        <ul>
          {Array.from({ length: HISTORY_ROWS }, (_, index) => (
            <li
              key={index}
              className={cn(
                "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3",
                index > 0 && "border-t border-border",
              )}
            >
              <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-1.5">
                <Skeleton className="h-4 w-40 rounded-pill" />
                <Skeleton className="h-3.5 w-56 max-w-full rounded-pill" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-3.5 w-44 rounded-pill" />
                <Skeleton className="h-6 w-20 rounded-badge-md" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </LoadingRegion>
  );
}
