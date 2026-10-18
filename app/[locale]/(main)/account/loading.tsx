import { LoadingRegion, Skeleton } from "@/src/presentation/design-system";
import { FieldSkeleton, PageTitleSkeleton } from "@/src/presentation/storefront/skeletons";

export default function AccountLoading() {
  return (
    <LoadingRegion className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageTitleSkeleton />

      {/* Profile form: name, email, phone line, save button. */}
      <div className="flex flex-col gap-4 rounded-card-lg border border-border p-4">
        <FieldSkeleton />
        <FieldSkeleton />
        <Skeleton className="h-4.5 w-40 rounded-pill" />
        <Skeleton className="h-11 w-24 self-start rounded-button" />
      </div>

      {/* Shortcut links: icon, label, chevron. */}
      <div className="flex flex-col divide-y divide-border rounded-card-lg border border-border">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-4">
            <Skeleton className="size-5 shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5.25 w-36 max-w-full rounded-pill" />
            </div>
            <Skeleton className="size-4 shrink-0 rounded-full" />
          </div>
        ))}
      </div>

      {/* Event sign-ups: heading and one line. */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6.75 w-36 rounded-pill" />
        <Skeleton className="h-5.25 w-56 max-w-full rounded-pill" />
      </div>

      {/* Language toggle and sign-out. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-11 w-24 rounded-input" />
        <Skeleton className="h-11 w-32 rounded-button" />
      </div>
    </LoadingRegion>
  );
}
