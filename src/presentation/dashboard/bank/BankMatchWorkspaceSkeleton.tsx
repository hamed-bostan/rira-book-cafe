import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

import { PAGE_CARD } from "../pageStyles";

/** Open lines drawn per side — enough to fill the column without guessing a long statement. */
const ROWS_PER_SIDE = 5;

/**
 * Placeholder for `BankMatchWorkspace`: the auto-match / selection / match toolbar,
 * then the statement and book columns (side by side from `lg`) with their pickable rows.
 */
export function BankMatchWorkspaceSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-11 w-36 rounded-button sm:h-9" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Skeleton className="h-4 w-44 rounded-pill" />
          <Skeleton className="h-11 w-32 rounded-button sm:h-9" />
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, side) => (
          <div key={side} className={`${PAGE_CARD} flex flex-col overflow-hidden`}>
            <div className="flex h-11 items-center border-b border-border bg-muted px-4">
              <Skeleton className="h-4 w-40 rounded-pill" />
            </div>
            <ul className="divide-y divide-border">
              {Array.from({ length: ROWS_PER_SIDE }, (_, row) => (
                <li key={row} className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <Skeleton className="size-4 shrink-0 rounded-input" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-3/4 rounded-pill" />
                    <Skeleton className="h-3 w-1/3 rounded-pill" />
                  </div>
                  <Skeleton className="h-4 w-16 shrink-0 rounded-pill" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
