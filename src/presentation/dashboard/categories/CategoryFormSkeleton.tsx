import { ActivityPanelSkeleton } from "@/src/presentation/dashboard/activity/ActivityPanelSkeleton";
import { DashboardColumns } from "@/src/presentation/dashboard/DashboardColumns";
import { LANGUAGE_GRID } from "@/src/presentation/dashboard/fieldStyles";
import {
  DashboardFieldSkeleton,
  DashboardPageHeaderSkeleton,
  DashboardSectionSkeleton,
  DashboardSwitchFieldSkeleton,
} from "@/src/presentation/dashboard/skeletons";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** The two languages' columns. */
const LANGUAGES = 2;

/**
 * Placeholder for `CategoryForm` (create and edit): the header and its buttons, the
 * name in both languages with the slug, then the icon, the active switch and (when
 * editing) the activity panel in the narrow column.
 */
export function CategoryFormSkeleton({ activity = false }: { activity?: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <DashboardPageHeaderSkeleton />
      <DashboardColumns
        main={
          <DashboardSectionSkeleton description>
            <div className={LANGUAGE_GRID}>
              {Array.from({ length: LANGUAGES }, (_, language) => (
                <div key={language} className="flex min-w-0 flex-col gap-4">
                  <Skeleton className="h-4 w-20 rounded-pill" />
                  <DashboardFieldSkeleton />
                </div>
              ))}
            </div>
            <DashboardFieldSkeleton hint />
          </DashboardSectionSkeleton>
        }
        side={
          <>
            <DashboardSectionSkeleton>
              <div className="flex flex-wrap items-center gap-4">
                <Skeleton className="size-12 shrink-0 rounded-card-md" />
                <Skeleton className="h-11 w-36 rounded-button sm:h-9" />
              </div>
              <Skeleton className="h-4 w-48 max-w-full rounded-pill" />
            </DashboardSectionSkeleton>

            <DashboardSectionSkeleton>
              <DashboardSwitchFieldSkeleton />
            </DashboardSectionSkeleton>

            {activity ? <ActivityPanelSkeleton /> : null}
          </>
        }
      />
    </div>
  );
}
