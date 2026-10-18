import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";
import { BackLinkSkeleton } from "@/src/presentation/storefront/skeletons";

export default function EventLoading() {
  return (
    <LoadingRegion className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLinkSkeleton />

      <Skeleton className="aspect-[16/9] rounded-card-lg" />

      {/* Kind badge, title, date and time, price and seats. */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6.5 w-16 self-start rounded-badge-md" />
        <Skeleton className="h-11.25 w-3/4 rounded-button" />
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Skeleton className="h-5.25 w-28 rounded-pill" />
          <Skeleton className="h-5.25 w-32 rounded-pill" />
        </div>
        <Skeleton className="h-6 w-48 rounded-pill" />
      </div>

      {/* Sign-up card: seats picker and join button. */}
      <div className="flex flex-col gap-3 rounded-card-lg border border-border p-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5.25 w-16 rounded-pill" />
          <Skeleton className="h-10.5 w-full max-w-40 rounded-input" />
        </div>
        <Skeleton className="h-11 w-28 self-start rounded-button" />
      </div>

      {/* Description. */}
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-full rounded-pill" />
        <Skeleton className="h-5 w-full rounded-pill" />
        <Skeleton className="h-5 w-1/2 rounded-pill" />
      </div>
    </LoadingRegion>
  );
}
