import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system";

type DashboardFormSkeletonProps = {
  /** Labelled single-line fields to draw. */
  fields?: number;
  /** Add a taller textarea-sized field after the inputs. */
  textarea?: boolean;
  /** Reserve the locale tabs (base / Persian) some catalog forms lead with. */
  tabs?: boolean;
  className?: string;
};

/**
 * Placeholder for a dashboard create/edit form: label + input pairs at the
 * `flex-col gap-5` rhythm the forms use, then the submit row.
 */
export function DashboardFormSkeleton({ fields = 4, textarea = false, tabs = false, className }: DashboardFormSkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {tabs ? (
        <div className="flex gap-2 border-b border-border pb-2">
          <Skeleton className="h-9 w-24 rounded-button" />
          <Skeleton className="h-9 w-24 rounded-button" />
        </div>
      ) : null}
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28 rounded-pill" />
          <Skeleton className="h-10 w-full rounded-input" />
        </div>
      ))}
      {textarea ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28 rounded-pill" />
          <Skeleton className="h-28 w-full rounded-input" />
        </div>
      ) : null}
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-11 w-28 rounded-button" />
        <Skeleton className="h-11 w-24 rounded-button" />
      </div>
    </div>
  );
}
