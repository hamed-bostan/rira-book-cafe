import { StatementHeaderSkeleton } from "@/src/presentation/dashboard/accounting/StatementHeaderSkeleton";
import { StatementSectionSkeleton } from "@/src/presentation/dashboard/accounting/StatementSectionSkeleton";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";

/**
 * Mirrors the statement pages' shared shape: `StatementHeader` (breadcrumb, title,
 * period picker) over account sections with totals. A loading file can't see which
 * statement the URL names, so this draws the common case rather than any one report.
 */
export default function StatementLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <StatementHeaderSkeleton />
      <StatementSectionSkeleton rows={4} />
      <StatementSectionSkeleton rows={3} />
    </LoadingRegion>
  );
}
