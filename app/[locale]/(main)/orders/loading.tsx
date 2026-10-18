import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { PageTitleSkeleton, RecordListSkeleton } from "@/src/presentation/storefront/skeletons";

export default function MyOrdersLoading() {
  return (
    <LoadingRegion className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageTitleSkeleton />
      <RecordListSkeleton rows={6} amount />
    </LoadingRegion>
  );
}
