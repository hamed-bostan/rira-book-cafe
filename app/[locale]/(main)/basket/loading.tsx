import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";
import { FieldSkeleton } from "@/src/presentation/storefront/skeletons";

export default function BasketLoading() {
  return (
    <LoadingRegion className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {/* Lines: heading, then the bordered list of photo, name, price, stepper, line total. */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-11.25 w-36 rounded-button" />
        <div className="flex flex-col divide-y divide-border rounded-card-lg border border-border">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex gap-3 p-3">
              <Skeleton className="size-16 shrink-0 rounded-card-md" />
              <div className="flex min-w-0 flex-1 flex-col">
                <Skeleton className="h-5.25 w-32 max-w-full rounded-pill" />
                <Skeleton className="h-5.25 w-16 rounded-pill" />
                <div className="mt-2 flex items-center gap-2">
                  <Skeleton className="size-10 rounded-button" />
                  <Skeleton className="h-5.25 w-6 rounded-pill" />
                  <Skeleton className="size-10 rounded-button" />
                </div>
              </div>
              <Skeleton className="h-5.25 w-16 shrink-0 rounded-pill" />
            </div>
          ))}
        </div>
      </div>

      {/* Checkout panel: service choice, table, note, total, place-order button. */}
      <div className="flex flex-col gap-4 self-start rounded-card-lg border border-border p-4 lg:sticky lg:top-20">
        <div className="flex flex-col gap-2">
          <Skeleton className="mb-2 h-6 w-28 rounded-pill" />
          <div className="flex gap-2">
            <Skeleton className="h-11.75 flex-1 rounded-card-md" />
            <Skeleton className="h-11.75 flex-1 rounded-card-md" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldSkeleton />
          <Skeleton className="h-4.5 w-40 rounded-pill" />
        </div>
        <FieldSkeleton multiline />
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Skeleton className="h-6 w-16 rounded-pill" />
          <Skeleton className="h-6 w-24 rounded-pill" />
        </div>
        <Skeleton className="h-4.5 w-3/4 rounded-pill" />
        <Skeleton className="h-11 w-full rounded-button" />
      </div>
    </LoadingRegion>
  );
}
