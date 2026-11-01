import { AccountingHeaderSkeleton } from "@/src/presentation/dashboard/accounting/AccountingHeaderSkeleton";
import { PAGE_CARD } from "@/src/presentation/dashboard/pageStyles";
import { DashboardFieldSkeleton, DashboardSectionSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** The fiscal years the close panel lists. */
const YEARS = 3;

/** Mirrors the accounting settings page: the Accounting header, the settings card beside the fiscal-year close from `xl`. */
export default function AccountingSettingsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <AccountingHeaderSkeleton />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <div className={`${PAGE_CARD} flex flex-col gap-5 p-5`}>
          <DashboardFieldSkeleton hint />
          <DashboardFieldSkeleton hint />
          <Skeleton className="h-11 w-28 rounded-button sm:h-9" />
        </div>
        <DashboardSectionSkeleton description>
          {Array.from({ length: YEARS }, (_, index) => (
            <div key={index} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <Skeleton className="h-4 w-20 rounded-pill" />
                <Skeleton className="h-3.5 w-40 max-w-full rounded-pill" />
              </div>
              <Skeleton className="h-6 w-20 rounded-pill" />
            </div>
          ))}
        </DashboardSectionSkeleton>
      </div>
    </LoadingRegion>
  );
}
