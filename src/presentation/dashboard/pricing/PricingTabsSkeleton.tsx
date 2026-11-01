import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** The items / ingredients / settings tabs. */
const TABS = 3;

/** Placeholder for `PricingTabs`: the page title and subtitle over the underlined tabs. */
export function PricingTabsSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-48 rounded-button lg:h-8" />
        <Skeleton className="h-5 w-64 max-w-full rounded-pill" />
      </div>
      <div className="flex gap-6 border-b border-border">
        {Array.from({ length: TABS }, (_, tab) => (
          <div key={tab} className="flex h-12 items-center">
            <Skeleton className="h-4 w-20 rounded-pill" />
          </div>
        ))}
      </div>
    </>
  );
}
