import { DashboardColumns } from "@/src/presentation/dashboard/DashboardColumns";
import {
  DashboardPageHeaderSkeleton,
  DashboardSectionSkeleton,
  DashboardTimelineSkeleton,
} from "@/src/presentation/dashboard/skeletons";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Item lines drawn in the items section. */
const ITEM_LINES = 3;

/**
 * Placeholder for `OrderDetailScreen`: the header and its buttons, items + notes in
 * the wide column, service / payment + history in the narrow one (side by side
 * from `lg`).
 */
export function OrderDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <DashboardPageHeaderSkeleton />
      <DashboardColumns
        main={
          <>
            <DashboardSectionSkeleton>
              {Array.from({ length: ITEM_LINES }, (_, line) => (
                <div key={line} className="flex items-start gap-3">
                  <Skeleton className="size-12 shrink-0 rounded-card-md" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-3/5 rounded-pill" />
                    <Skeleton className="h-5 w-20 rounded-pill" />
                  </div>
                  <Skeleton className="h-4 w-20 rounded-pill" />
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-border pt-4">
                <Skeleton className="h-5 w-16 rounded-pill" />
                <Skeleton className="h-5 w-28 rounded-pill" />
              </div>
            </DashboardSectionSkeleton>

            <DashboardSectionSkeleton>
              <Skeleton className="h-4 w-32 rounded-pill" />
              <Skeleton className="h-24 w-full rounded-input" />
              <Skeleton className="h-11 w-24 self-end rounded-button sm:h-9" />
            </DashboardSectionSkeleton>
          </>
        }
        side={
          <>
            <DashboardSectionSkeleton>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-16 rounded-pill" />
                <Skeleton className="h-4 w-28 rounded-pill" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-16 rounded-pill" />
                <Skeleton className="h-4 w-32 rounded-pill" />
                <Skeleton className="h-4 w-28 rounded-pill" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-16 rounded-pill" />
                <Skeleton className="h-6 w-24 rounded-pill" />
              </div>
            </DashboardSectionSkeleton>

            <DashboardSectionSkeleton>
              <DashboardTimelineSkeleton />
            </DashboardSectionSkeleton>
          </>
        }
      />
    </div>
  );
}
