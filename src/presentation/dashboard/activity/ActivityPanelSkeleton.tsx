import { DashboardSectionSkeleton, DashboardTimelineSkeleton } from "@/src/presentation/dashboard/skeletons";

/** Placeholder for `ActivityPanel` in a form's narrow column: the titled card over a short timeline. */
export function ActivityPanelSkeleton() {
  return (
    <DashboardSectionSkeleton description>
      <DashboardTimelineSkeleton />
    </DashboardSectionSkeleton>
  );
}
