import { ActivityPanelSkeleton } from "@/src/presentation/dashboard/activity/ActivityPanelSkeleton";
import { DashboardColumns } from "@/src/presentation/dashboard/DashboardColumns";
import { FIELD_GRID, LANGUAGE_GRID } from "@/src/presentation/dashboard/fieldStyles";
import {
  DashboardFieldSkeleton,
  DashboardPageHeaderSkeleton,
  DashboardSectionSkeleton,
  DashboardSwitchFieldSkeleton,
} from "@/src/presentation/dashboard/skeletons";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** The two languages' columns. */
const LANGUAGES = 2;
/** Starts and ends, then seats and ticket price. */
const PAIR = 2;
/** Guests drawn in the guest list. */
const GUESTS = 4;

/**
 * Placeholder for `EventForm`: the header and its buttons, the kind and the copy in
 * both languages, the times and seats, then the cover and the published switch in
 * the narrow column. An edit adds the Delete button, the guest list and the
 * activity panel.
 */
export function EventFormSkeleton({ edit = false }: { edit?: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={edit ? 3 : 2} />
      <DashboardColumns
        main={
          <>
            <DashboardSectionSkeleton>
              <DashboardFieldSkeleton />
              <div className={LANGUAGE_GRID}>
                {Array.from({ length: LANGUAGES }, (_, language) => (
                  <div key={language} className="flex min-w-0 flex-col gap-4">
                    <Skeleton className="h-4 w-20 rounded-pill" />
                    <DashboardFieldSkeleton />
                    <DashboardFieldSkeleton tall />
                  </div>
                ))}
              </div>
            </DashboardSectionSkeleton>

            <DashboardSectionSkeleton>
              <div className="flex flex-col gap-1.5">
                <div className={FIELD_GRID}>
                  {Array.from({ length: PAIR }, (_, field) => (
                    <DashboardFieldSkeleton key={field} />
                  ))}
                </div>
                <Skeleton className="h-4 w-48 max-w-full rounded-pill" />
              </div>
              <div className={FIELD_GRID}>
                {Array.from({ length: PAIR }, (_, field) => (
                  <DashboardFieldSkeleton key={field} hint />
                ))}
              </div>
            </DashboardSectionSkeleton>

            {edit ? (
              <DashboardSectionSkeleton description>
                <ul className="-my-3 flex flex-col divide-y divide-border">
                  {Array.from({ length: GUESTS }, (_, guest) => (
                    <li key={guest} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Skeleton className="h-4 w-32 rounded-pill" />
                        <Skeleton className="h-3.5 w-48 max-w-full rounded-pill" />
                      </div>
                      <Skeleton className="h-11 w-24 shrink-0 rounded-button sm:h-8" />
                    </li>
                  ))}
                </ul>
              </DashboardSectionSkeleton>
            ) : null}
          </>
        }
        side={
          <>
            <DashboardSectionSkeleton>
              <Skeleton className="aspect-video w-full rounded-button" />
              <Skeleton className="h-11 w-36 rounded-button sm:h-9" />
              <Skeleton className="h-4 w-48 max-w-full rounded-pill" />
            </DashboardSectionSkeleton>

            <DashboardSectionSkeleton>
              <DashboardSwitchFieldSkeleton />
            </DashboardSectionSkeleton>

            {edit ? <ActivityPanelSkeleton /> : null}
          </>
        }
      />
    </div>
  );
}
