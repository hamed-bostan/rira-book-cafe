import { AccountingHeaderSkeleton } from "@/src/presentation/dashboard/accounting/AccountingHeaderSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Cash, bank, gateway, guests owe, owed to suppliers, VAT. */
const BALANCES = 6;
/** Revenue, gross profit, operating expenses, net profit. */
const RESULTS = 4;
/** Paid out on, reference, deposited, fee. */
const PAYOUT_FIELDS = 4;

/**
 * Mirrors `AccountingOverviewScreen`: the Accounting header, the balance check,
 * the six balance cards, the period's results with its switch, the payout form.
 */
export default function AccountingLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <AccountingHeaderSkeleton />

      <div className="flex items-center gap-2 rounded-card-lg border border-border bg-background px-4 py-3 shadow-xs">
        <Skeleton className="size-4 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-72 max-w-full rounded-pill" />
        <Skeleton className="ms-auto h-4 w-32 rounded-pill" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-32 rounded-pill" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: BALANCES }, (_, index) => (
            <div
              key={index}
              className="flex flex-col justify-between gap-4 rounded-card-lg border border-border bg-background px-5 py-4 shadow-xs"
            >
              <Skeleton className="h-4 w-28 rounded-pill" />
              <Skeleton className="h-7 w-40 rounded-button" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-card-lg border border-border bg-background p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-44 rounded-pill" />
            <Skeleton className="h-3.5 w-32 rounded-pill" />
          </div>
          <Skeleton className="h-11 w-64 rounded-button sm:h-9" />
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          {Array.from({ length: RESULTS }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24 rounded-pill" />
              <Skeleton className="h-7 w-32 rounded-button" />
            </div>
          ))}
        </div>
        <Skeleton className="h-4 w-36 rounded-pill" />
      </div>

      <div className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-5 shadow-xs">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-48 rounded-pill" />
          <Skeleton className="h-4 w-96 max-w-full rounded-pill" />
        </div>
        <div className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: PAYOUT_FIELDS }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-28 rounded-pill" />
              <Skeleton className="h-11 w-full rounded-input sm:h-10" />
            </div>
          ))}
        </div>
        <Skeleton className="h-11 w-32 rounded-button sm:h-10" />
      </div>
    </LoadingRegion>
  );
}
