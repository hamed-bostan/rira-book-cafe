import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Menu rows drawn while the page loads. */
const MENU_ROWS = 10;

/** Mirrors `CounterSaleScreen`: heading, then the menu beside the sale. */
export default function CounterSaleLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-40 rounded-button lg:h-9" />
        <Skeleton className="h-4 w-80 max-w-full rounded-pill" />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: MENU_ROWS }, (_, index) => (
            <Skeleton key={index} className="rounded-card h-16" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-card-lg" />
      </div>
    </LoadingRegion>
  );
}
