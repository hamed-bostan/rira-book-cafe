import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/**
 * Placeholder for `CategoryForm`: the base / Persian locale tabs with the name
 * field, the slug with its hint, the icon upload, the active switch row, and the
 * submit row.
 */
export function CategoryFormSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col">
        <div className="inline-flex w-fit gap-1 rounded-card-lg bg-surface-sunken p-1">
          <Skeleton className="h-8 w-20 rounded-card-md" />
          <Skeleton className="h-8 w-20 rounded-card-md" />
        </div>
        <div className="flex flex-col gap-5 pt-4">
          <Skeleton className="h-3.5 w-64 max-w-full rounded-pill" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-16 rounded-pill" />
            <Skeleton className="h-10 w-full rounded-input" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-12 rounded-pill" />
        <Skeleton className="h-10 w-full rounded-input" />
        <Skeleton className="h-3.5 w-56 max-w-full rounded-pill" />
      </div>

      <div className="flex flex-col gap-1">
        <Skeleton className="h-4 w-12 rounded-pill" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-20 shrink-0 rounded-card-lg" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-10 w-28 rounded-button" />
            <Skeleton className="h-3.5 w-36 rounded-pill" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-card-md border border-border px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-16 rounded-pill" />
          <Skeleton className="h-3.5 w-48 rounded-pill" />
        </div>
        <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
      </div>

      <div className="flex gap-3 pt-2">
        <Skeleton className="h-11 w-32 rounded-button" />
        <Skeleton className="h-11 w-24 rounded-button" />
      </div>
    </div>
  );
}
