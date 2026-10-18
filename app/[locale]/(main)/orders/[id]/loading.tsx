import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";
import { BackLinkSkeleton } from "@/src/presentation/storefront/skeletons";

export default function MyOrderLoading() {
  return (
    <LoadingRegion className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackLinkSkeleton />

      {/* Order number banner. */}
      <div className="flex flex-col items-center rounded-card-lg bg-accent px-6 py-6">
        <Skeleton className="h-5.25 w-24 rounded-pill" />
        <Skeleton className="h-11.25 w-28 rounded-button" />
        <Skeleton className="mt-1 h-5.25 w-36 rounded-pill" />
      </div>

      {/* Progress: five numbered steps, then the status line. */}
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex flex-col items-center gap-1.5">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4.5 w-12 max-w-full rounded-pill" />
          </div>
        ))}
      </div>
      <Skeleton className="h-6 w-56 max-w-full self-center rounded-pill" />

      {/* Items card: service and payment, lines, totals. */}
      <div className="rounded-card-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-5.25 w-28 rounded-pill" />
          <Skeleton className="h-6.5 w-16 rounded-badge-md" />
        </div>
        <div className="mt-4 flex flex-col divide-y divide-border">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-start justify-between gap-3 py-2.5">
              <Skeleton className="h-5.25 w-40 max-w-full rounded-pill" />
              <Skeleton className="h-5.25 w-16 shrink-0 rounded-pill" />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-16 rounded-pill" />
            <Skeleton className="h-6 w-24 rounded-pill" />
          </div>
        </div>
      </div>

      {/* Pay online. */}
      <Skeleton className="h-11 w-full rounded-button" />
    </LoadingRegion>
  );
}
