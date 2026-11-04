import { cn } from "@/src/lib/utils";
import { PAGE_CARD } from "@/src/presentation/dashboard/pageStyles";
import { DashboardPageHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Mirrors `ReturnsScreen`: the header, then a few return cards. */
export default function SupplierReturnsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={1} />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className={cn(PAGE_CARD, "flex flex-col gap-3 p-5")}>
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
