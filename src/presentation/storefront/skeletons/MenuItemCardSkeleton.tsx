import { Skeleton } from "@/src/presentation/design-system";

/**
 * Placeholder for `MenuItemCard`: the same bordered card, the 4:3 photo, the
 * name, and the price row with the small add button.
 */
export function MenuItemCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-card-lg border border-border bg-background">
      <Skeleton className="aspect-[4/3]" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Skeleton className="h-5.25 w-3/4 rounded-pill" />
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <Skeleton className="h-5.25 w-16 rounded-pill" />
          <Skeleton className="h-10 w-20 rounded-button" />
        </div>
      </div>
    </div>
  );
}
