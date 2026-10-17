import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";
import { PageTitleSkeleton } from "@/src/presentation/storefront/skeletons";

export default function NotificationsLoading() {
  return (
    <LoadingRegion className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageTitleSkeleton subtitle />
      {/* Inbox rows: icon disc, title, body, relative time. */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-start gap-3 rounded-card-md border border-border p-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col">
              <Skeleton className="h-5.25 w-40 max-w-full rounded-pill" />
              <Skeleton className="h-5.25 w-full rounded-pill" />
              <Skeleton className="mt-1 h-4.5 w-20 rounded-pill" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
