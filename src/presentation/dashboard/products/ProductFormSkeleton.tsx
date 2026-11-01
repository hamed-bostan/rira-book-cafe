import { ActivityPanelSkeleton } from "@/src/presentation/dashboard/activity/ActivityPanelSkeleton";
import { DashboardColumns } from "@/src/presentation/dashboard/DashboardColumns";
import { LANGUAGE_GRID, FIELD_GRID } from "@/src/presentation/dashboard/fieldStyles";
import {
  DashboardFieldSkeleton,
  DashboardPageHeaderSkeleton,
  DashboardSectionSkeleton,
  DashboardSwitchFieldSkeleton,
} from "@/src/presentation/dashboard/skeletons";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** The two languages' columns of copy. */
const LANGUAGES = 2;
/** Description, nutrition and origin. */
const TEXTAREAS = 3;
/** Price, original price and cost price. */
const PRICES = 3;
/** Dietary tags drawn. */
const TAGS = 4;
/** Featured · published · VAT-exempt. */
const SWITCHES = 3;

/**
 * Placeholder for `ProductForm` (create and edit): the header and its buttons, then
 * type and category, the copy in both languages, prices and stock in the wide
 * column, and the image, the menu settings and (when editing) the activity panel in
 * the narrow one.
 */
export function ProductFormSkeleton({ activity = false }: { activity?: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <DashboardPageHeaderSkeleton />
      <DashboardColumns
        main={
          <>
            <DashboardSectionSkeleton>
              <DashboardFieldSkeleton />
              <DashboardFieldSkeleton />
            </DashboardSectionSkeleton>

            <DashboardSectionSkeleton description>
              <div className={LANGUAGE_GRID}>
                {Array.from({ length: LANGUAGES }, (_, language) => (
                  <div key={language} className="flex min-w-0 flex-col gap-4">
                    <Skeleton className="h-4 w-20 rounded-pill" />
                    <DashboardFieldSkeleton />
                    <DashboardFieldSkeleton hint />
                    {Array.from({ length: TEXTAREAS }, (_, field) => (
                      <DashboardFieldSkeleton key={field} hint tall />
                    ))}
                  </div>
                ))}
              </div>
            </DashboardSectionSkeleton>

            <DashboardSectionSkeleton>
              <div className={FIELD_GRID}>
                {Array.from({ length: PRICES }, (_, field) => (
                  <DashboardFieldSkeleton key={field} hint />
                ))}
              </div>
            </DashboardSectionSkeleton>

            <DashboardSectionSkeleton>
              <DashboardSwitchFieldSkeleton />
              <div className={FIELD_GRID}>
                <DashboardFieldSkeleton hint />
              </div>
            </DashboardSectionSkeleton>
          </>
        }
        side={
          <>
            <DashboardSectionSkeleton>
              <Skeleton className="aspect-[4/3] w-full rounded-button" />
              <Skeleton className="h-11 w-36 rounded-button sm:h-9" />
              <Skeleton className="h-4 w-48 max-w-full rounded-pill" />
            </DashboardSectionSkeleton>

            <DashboardSectionSkeleton>
              <DashboardFieldSkeleton hint />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: TAGS }, (_, tag) => (
                  <Skeleton key={tag} className="h-11 w-24 rounded-full sm:h-8" />
                ))}
              </div>
              {Array.from({ length: SWITCHES }, (_, row) => (
                <DashboardSwitchFieldSkeleton key={row} />
              ))}
            </DashboardSectionSkeleton>

            {activity ? <ActivityPanelSkeleton /> : null}
          </>
        }
      />
    </div>
  );
}
