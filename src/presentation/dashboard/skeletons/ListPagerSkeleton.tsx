import { Skeleton } from "@/src/presentation/design-system";

/** Placeholder for `ListPager`: the page-size select at the start, the range and the two arrows at the end. */
export function ListPagerSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16 rounded-pill" />
        <Skeleton className="h-11 w-20 rounded-input sm:h-10" />
      </div>
      <div className="ms-auto flex items-center gap-2">
        <Skeleton className="h-4 w-24 rounded-pill" />
        <Skeleton className="size-11 rounded-button" />
        <Skeleton className="size-11 rounded-button" />
      </div>
    </div>
  );
}
