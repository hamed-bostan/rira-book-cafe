import { Skeleton } from "@/src/presentation/design-system";

/** Open lines drawn per side — enough to fill the column without guessing a long statement. */
const ROWS_PER_SIDE = 5;

/**
 * Placeholder for `BankMatchWorkspace`: the auto-match / selection / match toolbar,
 * then the bank and book columns (side by side from `xl`) with their pickable rows.
 */
export function BankMatchWorkspaceSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-32 rounded-button" />
        <Skeleton className="h-4 w-44 rounded-pill" />
        <Skeleton className="ms-auto h-10 w-24 rounded-button" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, side) => (
          <div key={side} className="flex min-w-0 flex-col rounded-card-lg border border-border bg-background">
            <div className="flex h-12 items-center border-b border-border px-4">
              <Skeleton className="h-5 w-32 rounded-pill" />
            </div>
            <ul className="divide-y divide-border">
              {Array.from({ length: ROWS_PER_SIDE }, (_, row) => (
                <li key={row} className="flex items-center gap-3 px-4 py-2.5">
                  <Skeleton className="size-4 shrink-0 rounded-input" />
                  <Skeleton className="h-4 w-20 shrink-0 rounded-pill" />
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
