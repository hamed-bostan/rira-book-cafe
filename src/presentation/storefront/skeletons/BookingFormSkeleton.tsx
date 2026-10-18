import { Skeleton } from "@/src/presentation/design-system";

import { FieldSkeleton } from "./FieldSkeleton";

/**
 * Placeholder for the booking forms (table and suite): the bordered card, three
 * fields stacked on phones and side by side from `sm`, the note, the hint line,
 * and the submit button.
 */
export function BookingFormSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-card-lg border border-border p-4 md:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
      </div>
      <FieldSkeleton multiline />
      <Skeleton className="h-4.5 w-3/4 rounded-pill" />
      <Skeleton className="h-11 w-32 self-start rounded-button" />
    </div>
  );
}
