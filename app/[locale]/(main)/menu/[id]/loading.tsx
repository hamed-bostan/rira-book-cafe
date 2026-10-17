import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";
import { BackLinkSkeleton } from "@/src/presentation/storefront/skeletons";

export default function MenuItemLoading() {
  return (
    <LoadingRegion className="flex flex-col gap-6">
      <BackLinkSkeleton />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Skeleton className="aspect-square rounded-card-lg" />

        <div className="flex flex-col gap-4">
          {/* Kind and badge pills. */}
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-6.5 w-14 rounded-badge-md" />
            <Skeleton className="h-6.5 w-16 rounded-badge-md" />
          </div>
          <Skeleton className="h-11.25 w-2/3 rounded-button" />
          {/* Price (text-heading-subsection). */}
          <Skeleton className="h-7 w-28 rounded-button" />

          {/* Add-to-basket card: note, quantity stepper, add button. */}
          <div className="flex flex-col gap-4 rounded-card-lg border border-border p-4">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5.25 w-32 rounded-pill" />
              <Skeleton className="h-32 w-full rounded-input" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="size-10 rounded-button" />
                <Skeleton className="h-6 w-8 rounded-pill" />
                <Skeleton className="size-10 rounded-button" />
              </div>
              <Skeleton className="h-11 w-40 rounded-button" />
            </div>
          </div>

          {/* "View basket" link. */}
          <Skeleton className="h-5.25 w-28 rounded-pill" />

          {/* About: heading and a few lines of copy. */}
          <div className="flex flex-col">
            <Skeleton className="h-6 w-24 rounded-pill" />
            <div className="mt-1 flex flex-col gap-1">
              <Skeleton className="h-5 w-full rounded-pill" />
              <Skeleton className="h-5 w-full rounded-pill" />
              <Skeleton className="h-5 w-2/3 rounded-pill" />
            </div>
          </div>
        </div>
      </div>

      {/* Reviews: heading, the sign-in/eligibility line, two review cards. */}
      <div className="flex flex-col gap-4 border-t border-border pt-6">
        <Skeleton className="h-7 w-32 rounded-button" />
        <Skeleton className="h-5.25 w-56 rounded-pill" />
        <div className="flex flex-col gap-3">
          {[0, 1].map((index) => (
            <div key={index} className="flex flex-col gap-1 rounded-card-md border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-4 w-20 rounded-pill" />
                <Skeleton className="h-5.25 w-24 rounded-pill" />
              </div>
              <Skeleton className="h-5.25 w-3/4 rounded-pill" />
              <Skeleton className="h-4.5 w-28 rounded-pill" />
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
