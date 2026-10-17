import { DashboardHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";

/** Promo code rows drawn in the codes panel. */
const PROMO_ROWS = 4;

export default function PromotionsLoading() {
  return (
    <LoadingRegion className="@container flex min-w-0 flex-col gap-4 sm:gap-6">
      <DashboardHeaderSkeleton />

      {/* Promo codes: title + "New code", then one row per code. */}
      <div className="rounded-card-lg border border-border bg-background p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-32 rounded-pill" />
          <Skeleton className="h-10 w-28 rounded-button" />
        </div>
        <div className="mt-4 flex flex-col divide-y divide-border">
          {Array.from({ length: PROMO_ROWS }, (_, row) => (
            <div key={row} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-4 w-24 rounded-pill" />
                  <Skeleton className="h-6 w-16 rounded-pill" />
                  <Skeleton className="h-4 w-16 rounded-pill" />
                </div>
                <Skeleton className="h-3.5 w-48 max-w-full rounded-pill" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-11 rounded-full" />
                <Skeleton className="size-10 rounded-button" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 @min-[60rem]:grid-cols-2">
        {/* Loyalty club: enable switch, three rule fields, save. */}
        <div className="rounded-card-lg border border-border bg-background p-4 sm:p-5">
          <Skeleton className="h-6 w-32 rounded-pill" />
          <Skeleton className="mt-1 h-4 w-64 max-w-full rounded-pill" />
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-28 rounded-pill" />
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, field) => (
                <div key={field} className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-20 rounded-pill" />
                  <Skeleton className="h-10 w-full rounded-input" />
                  <Skeleton className="h-3.5 w-3/4 rounded-pill" />
                </div>
              ))}
            </div>
            <Skeleton className="h-10 w-20 self-end rounded-button" />
          </div>
        </div>

        {/* Guest points: phone lookup. */}
        <div className="rounded-card-lg border border-border bg-background p-4 sm:p-5">
          <Skeleton className="h-6 w-32 rounded-pill" />
          <Skeleton className="mt-1 h-4 w-64 max-w-full rounded-pill" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-10 flex-1 rounded-input" />
            <Skeleton className="h-10 w-24 rounded-button" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
