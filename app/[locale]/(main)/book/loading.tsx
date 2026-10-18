import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";
import { BookingFormSkeleton, PageTitleSkeleton } from "@/src/presentation/storefront/skeletons";

export default function BookTableLoading() {
  return (
    <LoadingRegion className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageTitleSkeleton subtitle />
      <BookingFormSkeleton />
      {/* Suite promo link: icon, two lines, chevron. */}
      <div className="flex items-center gap-3 rounded-card-lg border border-border px-4 py-4">
        <Skeleton className="size-5 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Skeleton className="h-5.25 w-36 rounded-pill" />
          <Skeleton className="h-4.5 w-56 max-w-full rounded-pill" />
        </div>
        <Skeleton className="size-4 shrink-0 rounded-full" />
      </div>
    </LoadingRegion>
  );
}
