import { cn } from "@/src/lib/utils";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Member rows drawn — a small team. */
const MEMBER_ROWS = 4;
/** Access changes drawn in the history. */
const HISTORY_ROWS = 4;

export default function TeamLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      {/* Title and how many people have access. */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-28 rounded-pill" />
        <Skeleton className="h-4 w-56 max-w-full rounded-pill" />
      </div>

      {/* Add a team member: phone, email, role — two columns from `md`, one row from `xl` — then Grant access. */}
      <div className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-5 shadow-xs">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-36 rounded-pill" />
          <Skeleton className="h-4 w-full max-w-xl rounded-pill" />
        </div>
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_15rem]">
          {Array.from({ length: 3 }, (_, field) => (
            <div key={field} className="flex min-w-0 flex-col gap-1.5">
              <Skeleton className="h-4 w-24 rounded-pill" />
              <Skeleton className="h-11 w-full rounded-input sm:h-9" />
            </div>
          ))}
        </div>
        <Skeleton className="h-11 w-32 rounded-button sm:h-9" />
      </div>

      {/* Team members: heading and count, the column strip from `md`, one row per member. */}
      <div className="rounded-card-lg border border-border bg-background shadow-xs">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <Skeleton className="h-5 w-28 rounded-pill" />
          <Skeleton className="h-6 w-7 rounded-badge-md" />
        </div>
        <div className="hidden h-10 border-b border-border bg-muted md:block" />
        {Array.from({ length: MEMBER_ROWS }, (_, row) => (
          <div
            key={row}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-3 md:grid-cols-[minmax(0,1fr)_10rem_2.5rem]",
              row > 0 && "border-t border-border",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-col gap-1.5">
                <Skeleton className="h-4 w-32 rounded-pill" />
                <Skeleton className="h-3.5 w-24 rounded-pill" />
              </div>
            </div>
            <div className="order-1 col-span-full ps-13 md:order-none md:col-span-1 md:ps-0">
              <Skeleton className="h-6 w-16 rounded-badge-md" />
            </div>
            <Skeleton className="size-11 justify-self-end rounded-button sm:size-9" />
          </div>
        ))}
      </div>

      {/* Access history: heading, then one sentence and its date per change. */}
      <div className="flex flex-col gap-2 rounded-card-lg border border-border bg-background p-5 shadow-xs">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32 rounded-pill" />
          <Skeleton className="h-4 w-72 max-w-full rounded-pill" />
        </div>
        {Array.from({ length: HISTORY_ROWS }, (_, row) => (
          <div
            key={row}
            className={cn("flex items-center justify-between gap-4 py-3", row > 0 && "border-t border-border")}
          >
            <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
            <Skeleton className="h-3.5 w-12 rounded-pill" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
