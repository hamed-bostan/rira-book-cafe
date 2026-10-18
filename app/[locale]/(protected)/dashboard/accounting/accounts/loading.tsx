import { AccountingTabsSkeleton } from "@/src/presentation/dashboard/accounting/AccountingTabsSkeleton";
import { StatementSectionSkeleton } from "@/src/presentation/dashboard/accounting/StatementSectionSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Rows per account type (asset, liability, equity, revenue, expense) — roughly the seeded chart's shape. */
const SECTION_ROWS = [6, 4, 2, 3, 6] as const;

/** Mirrors `AccountsScreen`: tabs, the new-account button, then one section per account type. */
export default function AccountsLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <AccountingTabsSkeleton />
      <div>
        <Skeleton className="h-11 w-36 rounded-button" />
      </div>
      {SECTION_ROWS.map((rows, index) => (
        <StatementSectionSkeleton key={index} rows={rows} total={false} dense={false} />
      ))}
    </LoadingRegion>
  );
}
