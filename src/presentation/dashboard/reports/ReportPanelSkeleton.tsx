import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

type ReportPanelSkeletonProps = {
  /**
   * What the panel holds: the sales chart, ranked rows with bars (best sellers),
   * share bars (drinks / food / books, how it was paid), or a list of rows.
   */
  body: "chart" | "ranked" | "shares" | "rows";
  /** Rows or bars to draw; the chart ignores it. */
  count?: number;
  /** Reserve the switch at the header's end. */
  action?: boolean;
};

/** A `ReportPanel` placeholder: the title (and the line under it), then its body. */
export function ReportPanelSkeleton({ body, count = 3, action = false }: ReportPanelSkeletonProps) {
  return (
    <div className="flex min-w-0 flex-col gap-5 rounded-card-lg border border-border bg-background p-5 shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-32 rounded-pill" />
          <Skeleton className="h-3.5 w-48 max-w-full rounded-pill" />
        </div>
        {action ? <Skeleton className="h-11 w-40 shrink-0 rounded-button sm:h-9" /> : null}
      </div>

      {body === "chart" ? (
        <Skeleton className="h-55 w-full rounded-card-md" />
      ) : body === "ranked" ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: count }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-5 shrink-0 rounded-pill" />
                <Skeleton className="h-4 flex-1 rounded-pill" />
                <Skeleton className="h-4 w-16 shrink-0 rounded-pill" />
              </div>
              <Skeleton className="ms-8 h-1.5 rounded-full" />
            </div>
          ))}
        </div>
      ) : body === "shares" ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: count }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-3">
                <Skeleton className="h-4 w-20 rounded-pill" />
                <Skeleton className="h-4 w-36 rounded-pill" />
              </div>
              <Skeleton className="h-2 rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col">
          {Array.from({ length: count }, (_, index) => (
            <div key={index} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-40 max-w-full rounded-pill" />
                <Skeleton className="h-3.5 w-24 rounded-pill" />
              </div>
              <Skeleton className="h-4 w-24 shrink-0 rounded-pill" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
