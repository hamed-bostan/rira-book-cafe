import { PAGE_CARD } from "@/src/presentation/dashboard/pageStyles";
import { DashboardPageHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Lines drawn while the journal loads. */
const LINE_ROWS = 8;

/** Mirrors `JournalPrintScreen`: the way back and heading with its two buttons, the period, then the lines. */
export default function JournalPrintLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={2} />
      <Skeleton className={`${PAGE_CARD} h-24 w-full`} />
      <div className={`${PAGE_CARD} flex flex-col gap-4 p-5`}>
        {Array.from({ length: LINE_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-4 w-full rounded-pill" />
        ))}
      </div>
    </LoadingRegion>
  );
}
