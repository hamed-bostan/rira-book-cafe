import { AccountingTabsSkeleton } from "@/src/presentation/dashboard/accounting/AccountingTabsSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Mirrors the accounting settings page: tabs, the VAT / books-closed form card, the fiscal-year close panel. */
export default function AccountingSettingsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <AccountingTabsSkeleton />

      {/* AccountingSettingsForm: two short fields with their hints, then save. */}
      <div className="flex max-w-xl flex-col gap-5 rounded-card-lg border border-border bg-background p-4 md:p-6">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28 rounded-pill" />
          <Skeleton className="h-10 w-full max-w-32 rounded-input" />
          <Skeleton className="h-3.5 w-64 max-w-full rounded-pill" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-36 rounded-pill" />
          <Skeleton className="h-10 w-full max-w-48 rounded-input" />
          <Skeleton className="h-3.5 w-72 max-w-full rounded-pill" />
        </div>
        <Skeleton className="h-11 w-24 rounded-button" />
      </div>

      {/* YearClosePanel: heading + description, one row per fiscal year. */}
      <div className="flex max-w-xl flex-col gap-3 rounded-card-lg border border-border bg-background p-4 md:p-6">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-6 w-40 rounded-pill" />
          <Skeleton className="h-4 w-full max-w-sm rounded-pill" />
        </div>
        <ul className="divide-y divide-border">
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index} className="flex flex-wrap items-center gap-3 py-3">
              <Skeleton className="h-4 w-20 rounded-pill" />
              <Skeleton className="h-3.5 w-40 rounded-pill" />
              <Skeleton className="ms-auto h-6 w-16 rounded-pill" />
            </li>
          ))}
        </ul>
      </div>
    </LoadingRegion>
  );
}
