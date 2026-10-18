import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Item lines drawn in the items panel. */
const ITEM_LINES = 3;
/** Status changes drawn in the timeline. */
const TIMELINE_EVENTS = 3;

/** A `DashboardPanel` frame with its title row, for the four detail panels. */
const PANEL = "rounded-card-lg border border-border bg-background p-4 sm:p-5";

/**
 * Placeholder for `OrderDetailScreen`'s body: items + notes in the wide column,
 * service / payment + timeline in the narrow one (side by side from `lg`). The
 * back link, title and status actions above it are drawn by the route's loading
 * file.
 */
export function OrderDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <div className={PANEL}>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-24 rounded-pill" />
            <Skeleton className="h-4 w-20 rounded-pill" />
          </div>
          <div className="mt-4 flex flex-col divide-y divide-border">
            {Array.from({ length: ITEM_LINES }, (_, line) => (
              <div key={line} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <Skeleton className="size-11 shrink-0 rounded-card-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-3/5 rounded-pill" />
                  <Skeleton className="h-5 w-20 rounded-pill" />
                </div>
                <Skeleton className="h-4 w-20 rounded-pill" />
              </div>
            ))}
          </div>
          {/* Subtotal / tax / total. */}
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
            <div className="flex justify-between gap-3">
              <Skeleton className="h-4 w-20 rounded-pill" />
              <Skeleton className="h-4 w-24 rounded-pill" />
            </div>
            <div className="flex justify-between gap-3">
              <Skeleton className="h-5 w-16 rounded-pill" />
              <Skeleton className="h-5 w-28 rounded-pill" />
            </div>
          </div>
        </div>

        <div className={PANEL}>
          <Skeleton className="h-6 w-20 rounded-pill" />
          <div className="mt-4 flex flex-col gap-2">
            <Skeleton className="h-24 w-full rounded-input" />
            <Skeleton className="h-10 w-32 rounded-button" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className={PANEL}>
          <Skeleton className="h-6 w-24 rounded-pill" />
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-16 rounded-pill" />
              <Skeleton className="h-4 w-28 rounded-pill" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-16 rounded-pill" />
              <Skeleton className="h-4 w-32 rounded-pill" />
              <Skeleton className="h-4 w-28 rounded-pill" />
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <Skeleton className="h-10 w-full rounded-button" />
          </div>
        </div>

        <div className={PANEL}>
          <Skeleton className="h-6 w-24 rounded-pill" />
          <div className="mt-4 flex flex-col gap-4 border-s border-border ps-4">
            {Array.from({ length: TIMELINE_EVENTS }, (_, event) => (
              <div key={event} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-28 rounded-pill" />
                <Skeleton className="h-3.5 w-20 rounded-pill" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
