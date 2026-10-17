import { cn } from "@/src/lib/utils";
import { Skeleton } from "@/src/presentation/design-system";

type FieldSkeletonProps = {
  /** A multi-line `Textarea` (`min-h-32`) instead of a single-line control. */
  multiline?: boolean;
  className?: string;
};

/**
 * Placeholder for a labelled form control: the 21px label line, `gap-1.5`, then
 * the control (an `Input`/`Select`, 42px with its border, or a `Textarea`).
 */
export function FieldSkeleton({ multiline = false, className }: FieldSkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Skeleton className="h-5.25 w-24 rounded-pill" />
      <Skeleton className={cn("w-full rounded-input", multiline ? "h-32" : "h-10.5")} />
    </div>
  );
}
