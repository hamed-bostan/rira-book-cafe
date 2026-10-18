import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";
import { BookingFormSkeleton, PageTitleSkeleton, RecordListSkeleton } from "@/src/presentation/storefront/skeletons";

export default function SuiteLoading() {
  return (
    <LoadingRegion className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageTitleSkeleton subtitle />
      <BookingFormSkeleton />

      {/* Nights already taken: heading and a wrap of date-range pills. */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6.75 w-40 rounded-pill" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6.5 w-40 rounded-full" />
          <Skeleton className="h-6.5 w-36 rounded-full" />
          <Skeleton className="h-6.5 w-40 rounded-full" />
        </div>
      </div>

      {/* The guest's own stays. */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6.75 w-32 rounded-pill" />
        <RecordListSkeleton rows={2} />
      </div>
    </LoadingRegion>
  );
}
