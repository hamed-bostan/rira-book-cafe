import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Ticket count per lane (new · in progress · ready) — enough to fill the board's first screen. */
const LANE_TICKETS = [2, 2, 1] as const;

/**
 * Placeholder for the kitchen board's three lanes: muted columns of order
 * tickets (number, service, waiting time, lines, advance button), stacked until
 * the `@container` is 56rem wide and side by side after. Sits inside a container
 * root, like `KitchenScreen`.
 */
export function KitchenBoardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 @min-[56rem]:grid-cols-3">
      {LANE_TICKETS.map((tickets, lane) => (
        <div key={lane} className="flex min-w-0 flex-col gap-3 rounded-card-lg bg-muted p-3">
          <div className="flex items-center justify-between px-1">
            <Skeleton className="h-5 w-24 rounded-pill" />
            <Skeleton className="h-6 w-8 rounded-full" />
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: tickets }, (_, ticket) => (
              <div key={ticket} className="flex flex-col gap-3 rounded-card-md border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-6 w-14 rounded-button" />
                    <Skeleton className="h-4 w-24 rounded-pill" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-3/5 rounded-pill" />
                  <Skeleton className="h-5 w-2/5 rounded-pill" />
                </div>
                <Skeleton className="h-11 w-full rounded-button" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
