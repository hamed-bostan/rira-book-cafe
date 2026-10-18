import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";
import { RecordListSkeleton } from "@/src/presentation/storefront/skeletons";

export default function MyReservationsLoading() {
  return (
    <LoadingRegion className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {/* Heading with the "New booking" button beside it. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-11.25 w-44 rounded-button" />
        <Skeleton className="h-10 w-32 rounded-button" />
      </div>
      <RecordListSkeleton rows={4} />
    </LoadingRegion>
  );
}
