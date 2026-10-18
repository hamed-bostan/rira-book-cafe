import { Skeleton } from "@/src/presentation/design-system";

import { ActivityListSkeleton } from "./ActivityListSkeleton";

/** Placeholder for `ActivityPanel` under an edit form: heading + description over a short, chip-less activity list. */
export function ActivityPanelSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-32 rounded-pill" />
        <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
      </div>
      <ActivityListSkeleton rows={3} showEntity={false} />
    </div>
  );
}
