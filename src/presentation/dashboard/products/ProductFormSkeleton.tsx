import { Skeleton } from "@/src/presentation/design-system";

/** Name and unit inputs, then the description / nutrition / origin textareas, in the base locale tab. */
const TEXTAREAS = 3;
/** Featured · published · VAT-exempt switch rows. */
const SWITCH_ROWS = 3;

/**
 * Placeholder for `ProductForm` (create and edit): the kind picker, the
 * base / Persian locale tabs with the guest-facing copy, category, prices, stock,
 * image, badge, dietary tags, the switch rows and the submit row — at the form's
 * `flex-col gap-5` rhythm.
 */
export function ProductFormSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {/* Kind. */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-16 rounded-pill" />
        <Skeleton className="h-12 w-full rounded-input" />
      </div>

      {/* Locale tabs and the base copy. */}
      <div>
        <div className="inline-flex gap-1 rounded-card-lg bg-surface-sunken p-1">
          <Skeleton className="h-9 w-24 rounded-card-md" />
          <Skeleton className="h-9 w-24 rounded-card-md" />
        </div>
        <div className="flex flex-col gap-5 pt-4">
          <Skeleton className="h-3.5 w-64 max-w-full rounded-pill" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-20 rounded-pill" />
            <Skeleton className="h-10 w-full rounded-input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-16 rounded-pill" />
            <Skeleton className="h-10 w-full rounded-input" />
            <Skeleton className="h-3.5 w-48 rounded-pill" />
          </div>
          {Array.from({ length: TEXTAREAS }, (_, field) => (
            <div key={field} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-24 rounded-pill" />
              <Skeleton className="h-32 w-full rounded-input" />
              <Skeleton className="h-3.5 w-56 max-w-full rounded-pill" />
            </div>
          ))}
        </div>
      </div>

      {/* Category. */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-20 rounded-pill" />
        <Skeleton className="h-12 w-full rounded-input" />
      </div>

      {/* Price beside original price. */}
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }, (_, field) => (
          <div key={field} className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-16 rounded-pill" />
            <Skeleton className="h-10 w-full rounded-input" />
            <Skeleton className="h-3.5 w-3/4 rounded-pill" />
          </div>
        ))}
      </div>

      {/* Cost price, stock. */}
      {Array.from({ length: 2 }, (_, field) => (
        <div key={field} className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-20 rounded-pill" />
          <Skeleton className="h-10 w-full rounded-input" />
          <Skeleton className="h-3.5 w-56 max-w-full rounded-pill" />
        </div>
      ))}

      {/* Image. */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-16 rounded-pill" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-20 shrink-0 rounded-card-lg" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-10 w-32 rounded-button" />
            <Skeleton className="h-3.5 w-40 rounded-pill" />
          </div>
        </div>
      </div>

      {/* Badge. */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-16 rounded-pill" />
        <Skeleton className="h-10 w-full rounded-input" />
        <Skeleton className="h-3.5 w-48 rounded-pill" />
      </div>

      {/* Dietary tags. */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-20 rounded-pill" />
        <Skeleton className="h-3.5 w-56 max-w-full rounded-pill" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, tag) => (
            <Skeleton key={tag} className="h-9 w-24 rounded-full" />
          ))}
        </div>
      </div>

      {Array.from({ length: SWITCH_ROWS }, (_, row) => (
        <div key={row} className="flex items-center justify-between gap-3 rounded-card-md border border-border px-4 py-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-24 rounded-pill" />
            <Skeleton className="h-3.5 w-48 rounded-pill" />
          </div>
          <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
        </div>
      ))}

      <div className="flex gap-3 pt-2">
        <Skeleton className="h-11 w-28 rounded-button" />
        <Skeleton className="h-11 w-24 rounded-button" />
      </div>
    </div>
  );
}
