import { EventFormSkeleton } from "@/src/presentation/dashboard/events/EventFormSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";

export default function EditEventLoading() {
  return (
    <LoadingRegion>
      <EventFormSkeleton edit />
    </LoadingRegion>
  );
}
