import { cn } from "@/src/lib/utils";
import { PRODUCT_ROW_GRID } from "@/src/presentation/dashboard/products/ProductRow";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Item rows drawn while the menu loads. */
const ITEM_ROWS = 8;
/** "All" and a handful of categories. */
const TABS = 6;

/**
 * Mirrors `ProductsScreen`: heading with "New item", then the list card —
 * category tabs, search and "Show", the column heads from `md` up, rows.
 */
export default function ProductsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-8 w-44 rounded-button lg:h-9" />
          <Skeleton className="h-4 w-80 max-w-full rounded-pill" />
        </div>
        <Skeleton className="h-11 w-32 rounded-button" />
      </div>

      <div className="rounded-card-lg border border-border bg-background shadow-xs">
        <div className="flex h-12 items-center gap-6 overflow-hidden border-b border-border px-4">
          {Array.from({ length: TABS }, (_, index) => (
            <Skeleton key={index} className="h-5 w-20 shrink-0 rounded-pill" />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3">
          <Skeleton className="h-11 max-w-md min-w-0 flex-[1_1_15rem] rounded-input sm:h-10" />
          <Skeleton className="h-11 w-36 rounded-button sm:h-10" />
        </div>
        <div className={cn("hidden h-10 items-center border-b border-border bg-muted px-5 md:grid", PRODUCT_ROW_GRID)}>
          <Skeleton className="h-3 w-12 rounded-pill" />
          <Skeleton className="ms-auto h-3 w-12 rounded-pill" />
          <Skeleton className="h-3 w-12 rounded-pill" />
          <Skeleton className="h-3 w-16 rounded-pill" />
        </div>
        <ul>
          {Array.from({ length: ITEM_ROWS }, (_, index) => (
            <li
              key={index}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-y-3 border-t border-border px-5 py-3 first:border-t-0",
                PRODUCT_ROW_GRID,
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="size-10 shrink-0 rounded-card-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-40 max-w-full rounded-pill" />
                  <Skeleton className="h-3 w-28 max-w-full rounded-pill" />
                </div>
              </div>
              <div className="order-1 col-span-full flex flex-wrap items-center gap-x-5 gap-y-2 ps-13 md:contents">
                <Skeleton className="h-4 w-24 rounded-pill md:ms-auto" />
                <Skeleton className="h-6 w-24 rounded-badge-md" />
                <Skeleton className="h-5 w-24 rounded-pill" />
              </div>
              <Skeleton className="size-11 rounded-button sm:size-9 md:order-1" />
            </li>
          ))}
        </ul>
      </div>
    </LoadingRegion>
  );
}
