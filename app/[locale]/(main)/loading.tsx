import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";
import { EventCardSkeleton, MenuItemGridSkeleton } from "@/src/presentation/storefront/skeletons";

export default function HomeLoading() {
  return (
    <LoadingRegion className="flex flex-col gap-10">
      {/* Hero: title, tagline, the menu and booking buttons. */}
      <div className="flex flex-col items-start gap-4 rounded-card-lg bg-accent px-6 py-10 md:px-10 md:py-14">
        <Skeleton className="h-11.25 w-full max-w-lg rounded-button" />
        <Skeleton className="h-6 w-full max-w-xl rounded-pill" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-11 w-32 rounded-button" />
          <Skeleton className="h-11 w-36 rounded-button" />
        </div>
      </div>

      {/* Featured: section heading with its link, then the product grid. */}
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <Skeleton className="h-7 w-32 rounded-button" />
          <Skeleton className="h-5.25 w-20 rounded-pill" />
        </div>
        <MenuItemGridSkeleton count={8} />
      </div>

      {/* What's on: section heading with its link, then three event cards. */}
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <Skeleton className="h-7 w-28 rounded-button" />
          <Skeleton className="h-5.25 w-20 rounded-pill" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <EventCardSkeleton />
          <EventCardSkeleton />
          <EventCardSkeleton />
        </div>
      </div>

      {/* Books banner: icon disc, two lines, and the browse button. */}
      <div className="flex flex-col items-start gap-3 rounded-card-lg border border-border px-6 py-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="flex flex-col">
            <Skeleton className="h-6 w-40 rounded-pill" />
            <Skeleton className="h-5.25 w-56 rounded-pill" />
          </div>
        </div>
        <Skeleton className="h-11 w-36 rounded-button" />
      </div>
    </LoadingRegion>
  );
}
