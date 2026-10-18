import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { PageTitleSkeleton, RecordListSkeleton } from "@/src/presentation/storefront/skeletons";

export default function MyBookLoansLoading() {
  return (
    <LoadingRegion className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageTitleSkeleton subtitle />
      <RecordListSkeleton rows={3} />
    </LoadingRegion>
  );
}
