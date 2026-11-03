import { DashboardPageHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Lines drawn on the slip while the receipt loads. */
const SLIP_ROWS = 10;

/** Mirrors `OrderReceiptScreen`: the way back and heading with the print button, then the slip. */
export default function OrderReceiptLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <DashboardPageHeaderSkeleton actions={1} />
      <div className="mx-auto flex w-full max-w-[24rem] flex-col gap-3 rounded-card-lg border border-border bg-background p-5 shadow-xs">
        <Skeleton className="h-5 w-32 self-center rounded-pill" />
        {Array.from({ length: SLIP_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-4 w-full rounded-pill" />
        ))}
      </div>
    </LoadingRegion>
  );
}
