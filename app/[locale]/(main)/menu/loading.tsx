import { LoadingRegion } from "@/src/presentation/design-system";
import { ChipRowSkeleton, MenuItemGridSkeleton, PageTitleSkeleton } from "@/src/presentation/storefront/skeletons";

export default function MenuLoading() {
  return (
    <LoadingRegion className="flex flex-col gap-6">
      <PageTitleSkeleton subtitle />
      {/* "All" plus one chip per product kind. */}
      <ChipRowSkeleton count={4} />
      <ChipRowSkeleton count={6} className="-mt-2" />
      <MenuItemGridSkeleton count={12} />
    </LoadingRegion>
  );
}
