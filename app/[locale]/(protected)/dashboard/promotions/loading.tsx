import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Promo code rows drawn in the codes card. */
const PROMO_ROWS = 4;

export default function PromotionsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      {/* Title and subtitle, "New code" on the end. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40 rounded-pill" />
          <Skeleton className="h-4 w-72 max-w-full rounded-pill" />
        </div>
        <Skeleton className="h-11 w-32 rounded-button" />
      </div>

      {/* Promo codes: heading and live count, then one row per code. */}
      <div className="rounded-card-lg border border-border bg-background shadow-xs">
        <div className="flex flex-col gap-2 border-b border-border px-5 py-4">
          <Skeleton className="h-5 w-28 rounded-pill" />
          <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
        </div>
        {Array.from({ length: PROMO_ROWS }, (_, row) => (
          <div
            key={row}
            className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border px-5 py-4 first-of-type:border-t-0"
          >
            <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <Skeleton className="h-4 w-24 rounded-pill" />
                <Skeleton className="h-4 w-32 rounded-pill" />
              </div>
              <Skeleton className="h-3.5 w-56 max-w-full rounded-pill" />
            </div>
            <div className="ms-auto flex items-center gap-4">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="size-11 rounded-button sm:size-9" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        {/* Rewards club: switch, three rule fields, the worked example, save. */}
        <div className="flex flex-col gap-5 rounded-card-lg border border-border bg-background p-5 shadow-xs">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-32 rounded-pill" />
            <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-9 rounded-full" />
            <Skeleton className="h-4 w-40 rounded-pill" />
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-4">
            {Array.from({ length: 3 }, (_, field) => (
              <div key={field} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-24 rounded-pill" />
                <Skeleton className="h-11 w-full rounded-input sm:h-10" />
                <Skeleton className="h-3.5 w-3/4 rounded-pill" />
              </div>
            ))}
          </div>
          <Skeleton className="h-12 w-full rounded-button" />
          <Skeleton className="h-10 w-32 self-end rounded-button" />
        </div>

        {/* A guest's points: phone lookup. */}
        <div className="flex flex-col gap-5 rounded-card-lg border border-border bg-background p-5 shadow-xs">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-32 rounded-pill" />
            <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-11 flex-1 rounded-input sm:h-10" />
            <Skeleton className="h-10 w-28 rounded-button" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
