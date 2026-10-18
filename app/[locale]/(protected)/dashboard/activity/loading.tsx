import { ActivityListSkeleton } from "@/src/presentation/dashboard/activity/ActivityListSkeleton";
import { DashboardHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";

/** Mirrors `ActivityScreen`: heading + summary, then the log card with its three filters, entries and pager. */
export default function ActivityLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-4 sm:gap-6">
      <DashboardHeaderSkeleton />
      <ActivityListSkeleton rows={8} filters pager />
    </LoadingRegion>
  );
}
