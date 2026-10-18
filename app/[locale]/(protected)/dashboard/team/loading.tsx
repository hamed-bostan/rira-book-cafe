import { DashboardHeaderSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Member rows drawn — a small team. */
const MEMBER_ROWS = 4;
/** Role changes drawn in the history. */
const ACTIVITY_ROWS = 4;

export default function TeamLoading() {
  return (
    <LoadingRegion className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 sm:gap-6">
      <DashboardHeaderSkeleton />

      {/* Grant access: phone, name, role, submit — two columns from `sm`, one row from `xl`. */}
      <div className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 sm:p-6">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-32 rounded-pill" />
          <Skeleton className="h-4 w-full max-w-md rounded-pill" />
        </div>
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_auto]">
          {Array.from({ length: 3 }, (_, field) => (
            <div key={field} className="flex min-w-0 flex-col gap-1.5">
              <Skeleton className="h-4 w-20 rounded-pill" />
              <Skeleton className="h-10 w-full rounded-input" />
            </div>
          ))}
          <Skeleton className="h-11 w-full rounded-button sm:mt-7 sm:h-10 xl:w-28" />
        </div>
      </div>

      {/* Members: heading + count, column strip from `md`, one row per member. */}
      <div className="overflow-hidden rounded-card-lg border border-border bg-background">
        <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
          <Skeleton className="h-5 w-24 rounded-pill" />
          <Skeleton className="h-6 w-8 rounded-pill" />
        </div>
        <div className="hidden grid-cols-[minmax(0,1fr)_10rem_6rem] gap-4 bg-surface-sunken/60 px-5 py-3 md:grid">
          <Skeleton className="h-4 w-20 rounded-pill bg-muted" />
          <Skeleton className="h-4 w-16 rounded-pill bg-muted" />
          <Skeleton className="h-4 w-14 justify-self-end rounded-pill bg-muted" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: MEMBER_ROWS }, (_, row) => (
            <div
              key={row}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_10rem_6rem] md:gap-4"
            >
              <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                <Skeleton className="size-11 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Skeleton className="h-4 w-32 rounded-pill" />
                  <Skeleton className="h-4 w-28 rounded-pill" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-pill" />
              <Skeleton className="size-11 justify-self-end rounded-button sm:size-10" />
            </div>
          ))}
        </div>
      </div>

      {/* Role-change history. */}
      <div className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 sm:p-6">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-32 rounded-pill" />
          <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
        </div>
        <div className="overflow-hidden rounded-card-lg border border-border">
          <div className="divide-y divide-border">
            {Array.from({ length: ACTIVITY_ROWS }, (_, row) => (
              <div
                key={row}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 bg-background px-4 py-3"
              >
                <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
                <Skeleton className="h-3.5 w-24 rounded-pill" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
