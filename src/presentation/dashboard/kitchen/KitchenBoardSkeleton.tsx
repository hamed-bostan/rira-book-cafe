import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Ticket count per lane (new · being made) — enough to fill the board's first screen. */
const LANE_TICKETS = [2, 2] as const;

/**
 * Placeholder for the bar board, laid out like `KitchenLaneTabs`: below `lg` the
 * full-width lane switch over one lane, from `lg` both lanes side by side with no
 * switch. Each lane is a muted column (dot, name, count) of tickets — number,
 * service, wait pill, lines and the big button — two a row from 1536px.
 */
export function KitchenBoardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* The phone lane switch. */}
      <div className="flex gap-0.5 rounded-button bg-muted p-0.5 lg:hidden">
        <Skeleton className="h-11 flex-1 rounded-button bg-background sm:h-9" />
        <div className="h-11 flex-1 sm:h-9" />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        {LANE_TICKETS.map((tickets, lane) => (
          <div
            key={lane}
            className={
              lane === 0
                ? "flex min-w-0 flex-col gap-3 rounded-card-lg bg-muted p-3"
                : "hidden min-w-0 flex-col gap-3 rounded-card-lg bg-muted p-3 lg:flex"
            }
          >
            <div className="flex items-center gap-2 px-2 pt-1">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-pill" />
              <Skeleton className="h-5 w-6 rounded-badge-md bg-background" />
            </div>
            <div className="grid grid-cols-1 items-start gap-3 2xl:grid-cols-2">
              {Array.from({ length: tickets }, (_, ticket) => (
                <div
                  key={ticket}
                  className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <Skeleton className="h-8 w-16 rounded-button lg:h-9" />
                      <Skeleton className="h-5 w-32 rounded-pill" />
                    </div>
                    <Skeleton className="h-8 w-20 rounded-button" />
                  </div>
                  <div className="flex flex-col border-t border-border">
                    <div className="border-b border-border py-2">
                      <Skeleton className="h-7 w-3/5 rounded-pill" />
                    </div>
                    <div className="border-b border-border py-2">
                      <Skeleton className="h-7 w-2/5 rounded-pill" />
                    </div>
                  </div>
                  <Skeleton className="h-12 w-full rounded-button" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
