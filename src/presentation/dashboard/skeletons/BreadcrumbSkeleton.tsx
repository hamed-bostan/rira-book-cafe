import { Skeleton } from "@/src/presentation/design-system";

/** Placeholder for the detail pages' breadcrumb nav: parent link, chevron, current item. */
export function BreadcrumbSkeleton() {
  return (
    <div className="flex h-4 items-center gap-2">
      <Skeleton className="h-3.5 w-20 rounded-pill" />
      <Skeleton className="size-3.5 rounded-full" />
      <Skeleton className="h-3.5 w-16 rounded-pill" />
    </div>
  );
}
