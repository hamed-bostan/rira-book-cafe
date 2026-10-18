import { DashboardHeaderSkeleton, DashboardTableSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system";

/** Mirrors `CategoriesScreen`: heading + count with the new-category button, then the search / status card with icon rows and pager. */
export default function CategoriesLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-4 sm:gap-6">
      <DashboardHeaderSkeleton action />
      {/* Columns from md: name (with icon), products, status, updated — default page size 10. */}
      <DashboardTableSkeleton thumbnail rows={10} columns={4} filters={1} />
    </LoadingRegion>
  );
}
