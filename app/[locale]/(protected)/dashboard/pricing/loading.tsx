import { PRICING_CARD_GRID } from "@/src/presentation/dashboard/pricing/PricingItemCard";
import { PRICING_SUMMARY_GRID } from "@/src/presentation/dashboard/pricing/PricingScreen";
import { PricingTabsSkeleton } from "@/src/presentation/dashboard/pricing/PricingTabsSkeleton";
import { DashboardStatGridSkeleton } from "@/src/presentation/dashboard/skeletons";
import { LoadingRegion } from "@/src/presentation/design-system/components/Skeleton/LoadingRegion";
import { Skeleton } from "@/src/presentation/design-system/components/Skeleton/Skeleton";

/** Item cards drawn while the report loads. */
const ITEM_CARDS = 6;
/** Ingredients · running costs · full cost, then profit % · suggested · price now · earns now. */
const CARD_SECTIONS = [3, 4] as const;

/**
 * Mirrors `PricingScreen`: the tabs, the three figures, the formula line, then a
 * card per item — its name, what it costs, and what to charge.
 */
export default function PricingLoading() {
  return (
    <LoadingRegion className="flex min-w-0 flex-col gap-6">
      <PricingTabsSkeleton />

      {/* Monthly overhead · monthly units · overhead per unit. */}
      <DashboardStatGridSkeleton count={3} className={PRICING_SUMMARY_GRID} />

      {/* The formula line. */}
      <Skeleton className="h-4 w-full max-w-xl rounded-pill" />

      <ul className={PRICING_CARD_GRID}>
        {Array.from({ length: ITEM_CARDS }, (_, card) => (
          <li key={card} className="rounded-card-lg border border-border bg-background shadow-xs">
            <div className="flex flex-col gap-1.5 px-5 pt-4 pb-3">
              <Skeleton className="h-5 w-36 max-w-full rounded-pill" />
              <Skeleton className="h-3.5 w-28 max-w-full rounded-pill" />
            </div>
            {CARD_SECTIONS.map((lines, section) => (
              <div key={section} className="flex flex-col gap-3 border-t border-border px-5 py-3.5">
                {Array.from({ length: lines }, (_, line) => (
                  <div key={line} className="flex items-center justify-between gap-4">
                    <Skeleton className="h-4 w-24 rounded-pill" />
                    <Skeleton className="h-4 w-20 rounded-pill" />
                  </div>
                ))}
              </div>
            ))}
          </li>
        ))}
      </ul>
    </LoadingRegion>
  );
}
