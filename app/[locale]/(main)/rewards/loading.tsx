import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";
import { PageTitleSkeleton } from "@/src/presentation/storefront/skeletons";

export default function RewardsLoading() {
  return (
    <LoadingRegion className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageTitleSkeleton subtitle />

      {/* Balance banner: icon disc, points, what they're worth. */}
      <div className="flex items-center gap-4 rounded-card-lg bg-accent p-5">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="flex flex-col">
          <Skeleton className="h-7 w-40 rounded-button" />
          <Skeleton className="h-5.25 w-32 rounded-pill" />
        </div>
      </div>

      {/* How it works: heading and three bullets. */}
      <div className="flex flex-col gap-2 rounded-card-lg border border-border p-4">
        <Skeleton className="h-6 w-32 rounded-pill" />
        <div className="flex flex-col gap-1 ps-5">
          <Skeleton className="h-5.25 w-3/4 rounded-pill" />
          <Skeleton className="h-5.25 w-2/3 rounded-pill" />
          <Skeleton className="h-5.25 w-1/2 rounded-pill" />
        </div>
      </div>

      {/* History: heading, then the bordered list of entries. */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6.75 w-36 rounded-pill" />
        <div className="flex flex-col divide-y divide-border rounded-card-lg border border-border">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <Skeleton className="h-5.25 w-40 max-w-full rounded-pill" />
                <Skeleton className="h-4.5 w-24 rounded-pill" />
              </div>
              <Skeleton className="h-5.25 w-12 shrink-0 rounded-pill" />
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
