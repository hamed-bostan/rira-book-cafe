import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Unpaid, paid in cash, paid from the bank. */
const PAYMENT_CHOICES = 3;

/**
 * Mirrors the new-expense page: heading, then `ExpenseForm` — date + supplier,
 * account, description, amount + VAT, the payment choices, submit — in the
 * `max-w-2xl` column.
 */
export default function NewExpenseLoading() {
  return (
    <LoadingRegion className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-8 w-44 rounded-button sm:h-9 sm:w-52" />
        <Skeleton className="h-4 w-64 max-w-full rounded-pill" />
      </div>

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-12 rounded-pill" />
            <Skeleton className="h-10 w-full rounded-input" />
            <Skeleton className="h-3.5 w-28 rounded-pill" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-16 rounded-pill" />
            <Skeleton className="h-10 w-full rounded-input" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-20 rounded-pill" />
          <Skeleton className="h-10 w-full rounded-input" />
          <Skeleton className="h-3.5 w-64 max-w-full rounded-pill" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-24 rounded-pill" />
          <Skeleton className="h-10 w-full rounded-input" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-16 rounded-pill" />
            <Skeleton className="h-10 w-full rounded-input" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-12 rounded-pill" />
            <Skeleton className="h-10 w-full rounded-input" />
            <Skeleton className="h-3.5 w-40 max-w-full rounded-pill" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="mb-1 h-4 w-20 rounded-pill" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: PAYMENT_CHOICES }, (_, index) => (
              <Skeleton key={index} className="h-9 w-28 rounded-card-md" />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Skeleton className="h-11 w-24 rounded-button" />
          <Skeleton className="h-11 w-24 rounded-button" />
        </div>
      </div>
    </LoadingRegion>
  );
}
