import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/**
 * Placeholder for `EventCard`: the bordered card, the 16:9 cover, the kind badge,
 * the title, the date line, and the price line pinned to the bottom.
 */
export function EventCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-card-lg border border-border bg-background">
      <Skeleton className="aspect-[16/9]" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Skeleton className="h-6.5 w-16 rounded-badge-md" />
        <Skeleton className="h-6 w-3/4 rounded-pill" />
        <Skeleton className="h-5.25 w-1/2 rounded-pill" />
        <Skeleton className="mt-auto h-5.25 w-1/3 rounded-pill" />
      </div>
    </div>
  );
}
