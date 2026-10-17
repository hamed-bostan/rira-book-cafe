import { LoadingRegion } from "@/src/presentation/design-system";
import { EventCardSkeleton, PageTitleSkeleton } from "@/src/presentation/storefront/skeletons";

export default function EventsLoading() {
  return (
    <LoadingRegion className="flex flex-col gap-6">
      <PageTitleSkeleton subtitle />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <EventCardSkeleton key={index} />
        ))}
      </div>
    </LoadingRegion>
  );
}
