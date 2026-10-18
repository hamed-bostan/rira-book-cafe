import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Mirrors the new-statement page: heading, then `NewBankStatementForm` — period and balances two-up, the paste-lines box, add-line row, submit. */
export default function NewBankStatementLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-52 rounded-button sm:h-9 sm:w-64" />
        <Skeleton className="h-4 w-72 max-w-full rounded-pill" />
      </div>

      <div className="flex flex-col gap-5 rounded-card-lg border border-border bg-background p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-24 rounded-pill" />
              <Skeleton className="h-10 w-full rounded-input" />
              <Skeleton className="h-3.5 w-40 max-w-full rounded-pill" />
            </div>
          ))}
        </div>

        {/* StatementLinesFields: legend, the dashed paste box, the add-line row. */}
        <div className="flex flex-col gap-3">
          <Skeleton className="mb-2 h-4 w-24 rounded-pill" />
          <div className="flex flex-col gap-2 rounded-card-md border border-dashed border-border p-3">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-40 rounded-pill" />
              <Skeleton className="h-32 w-full rounded-input" />
            </div>
            <Skeleton className="h-3.5 w-64 max-w-full rounded-pill" />
            <Skeleton className="h-10 w-24 rounded-button" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-10 w-28 rounded-button" />
            <Skeleton className="h-4 w-40 rounded-pill" />
          </div>
        </div>

        <div className="flex gap-3">
          <Skeleton className="h-10 w-28 rounded-button" />
          <Skeleton className="h-10 w-20 rounded-button" />
        </div>
      </div>
    </LoadingRegion>
  );
}
