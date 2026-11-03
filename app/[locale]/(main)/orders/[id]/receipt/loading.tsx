import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";
import { BackLinkSkeleton } from "@/src/presentation/storefront/skeletons";

/** Lines drawn on the slip while the receipt loads. */
const SLIP_ROWS = 10;

/** Mirrors `MyOrderReceiptScreen`: the way back and the print button, then the slip. */
export default function MyOrderReceiptLoading() {
  return (
    <LoadingRegion className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <BackLinkSkeleton />
        <Skeleton className="h-11 w-24 rounded-button sm:h-9" />
      </div>
      <div className="mx-auto flex w-full max-w-[24rem] flex-col gap-3 rounded-card-lg border border-border bg-background p-5 shadow-xs">
        <Skeleton className="h-5 w-32 self-center rounded-pill" />
        {Array.from({ length: SLIP_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-4 w-full rounded-pill" />
        ))}
      </div>
    </LoadingRegion>
  );
}
