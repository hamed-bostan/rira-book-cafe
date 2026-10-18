import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Placeholder for the "Back to …" link that tops a detail page (`text-body-small-strong`, a 21px line). */
export function BackLinkSkeleton() {
  return <Skeleton className="h-5.25 w-28 rounded-pill" />;
}
