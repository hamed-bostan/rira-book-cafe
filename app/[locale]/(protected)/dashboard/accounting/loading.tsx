import { AccountingTabsSkeleton } from "@/src/presentation/dashboard/accounting/AccountingTabsSkeleton";
import { PeriodPickerSkeleton } from "@/src/presentation/dashboard/accounting/PeriodPickerSkeleton";
import { DashboardStatGridSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Mirrors `AccountingOverviewScreen`: tabs, balance check, money tiles, the period's results, actions, settlement form. */
export default function AccountingLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <AccountingTabsSkeleton />

      {/* The "ledger balances · books closed through" strip. */}
      <div className="flex items-center gap-2 rounded-card-md border border-border bg-surface px-4 py-3">
        <Skeleton className="size-4 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-40 rounded-pill" />
        <Skeleton className="ms-auto h-5 w-32 rounded-pill" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40 rounded-pill" />
        <DashboardStatGridSkeleton count={6} className="grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3" />
      </div>

      <div className="flex flex-col gap-3 rounded-card-lg border border-border bg-background p-4 md:p-6">
        <Skeleton className="h-6 w-44 rounded-pill" />
        <PeriodPickerSkeleton />
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-2 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1">
              <Skeleton className="h-3.5 w-16 rounded-pill" />
              <Skeleton className="h-6 w-24 rounded-pill" />
            </div>
          ))}
        </div>
        <Skeleton className="h-4 w-32 rounded-pill" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-32 rounded-button" />
        <Skeleton className="h-10 w-32 rounded-button" />
        <Skeleton className="h-10 w-36 rounded-button" />
      </div>

      {/* GatewaySettlementForm: heading + hint, four fields two-up, submit. */}
      <div className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 md:p-6">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-6 w-48 rounded-pill" />
          <Skeleton className="h-4 w-72 max-w-full rounded-pill" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-24 rounded-pill" />
              <Skeleton className="h-10 w-full rounded-input" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-28 rounded-button" />
      </div>
    </LoadingRegion>
  );
}
