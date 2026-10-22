import { getLocale, getTranslations } from "next-intl/server";

import type { TopItemSort } from "@/src/domain/entities/Analytics";
import type { ProductKind } from "@/src/domain/entities/Product";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

/** How many best sellers the card lists. */
const SHOWN = 5;

/** The overview's query param for the ranking; absent means by revenue. */
export const TOP_ITEMS_PARAM = "top";

type TopItem = { productId: string; name: string; kind: ProductKind; quantity: number; revenue: number };

type TopItemsPanelProps = {
  /** The week's best sellers, already ranked by `sort` on the server. */
  items: TopItem[];
  sort: TopItemSort;
};

/**
 * The week's best sellers, by takings or by units sold. The switch is a pair of
 * links rather than client state: the report ranks a capped list, so re-sorting
 * the revenue ranking here could leave out a cheap item that sells the most.
 */
export async function TopItemsPanel({ items, sort }: TopItemsPanelProps) {
  const t = await getTranslations("dashOverview");
  const tKind = await getTranslations("dashProducts.kind");
  const locale = await getLocale();
  const byRevenue = sort === "revenue";

  const options: { value: TopItemSort; label: string; href: string }[] = [
    { value: "revenue", label: t("metricRevenue"), href: "/dashboard" },
    { value: "quantity", label: t("metricUnits"), href: `/dashboard?${TOP_ITEMS_PARAM}=quantity` },
  ];

  return (
    <section
      aria-labelledby="overview-top"
      className="flex min-w-0 flex-col gap-2 rounded-card-lg border border-border bg-background p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="overview-top" className="text-body-strong text-foreground">
          {t("topHeading")}
        </h2>
        <nav aria-label={t("rankBy")} className="flex shrink-0 rounded-button bg-muted p-0.5">
          {options.map((option) => {
            const selected = option.value === sort;
            return (
              <Link
                key={option.value}
                href={option.href}
                scroll={false}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "flex h-11 items-center rounded-button px-3 text-body-small whitespace-nowrap transition-colors sm:h-8",
                  focusRing,
                  selected
                    ? "bg-background font-semibold text-foreground shadow-xs"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {items.length === 0 ? (
        <p className="mt-2 border-t border-border pt-4 text-body-default text-muted-foreground sm:text-body-small">
          {t("topEmpty")}
        </p>
      ) : (
        <ol className="mt-2 flex flex-col">
          {items.slice(0, SHOWN).map((item, index) => {
            const money = formatMoney(item.revenue, locale);
            const sold = t("sold", { count: item.quantity });
            return (
              <li key={item.productId} className="flex items-center gap-3 border-t border-border py-3">
                <span className="w-5 shrink-0 text-body-default text-muted-foreground tabular-nums sm:text-body-small">
                  {formatNumber(index + 1, locale)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span dir="auto" className="truncate text-body-emphasis text-foreground sm:text-body-small-emphasis">
                    {item.name}
                  </span>
                  <span className="text-body-small text-muted-foreground sm:text-body-caption">{tKind(item.kind)}</span>
                </span>
                <span className="flex flex-col items-end whitespace-nowrap tabular-nums">
                  <span className="text-body-strong text-foreground sm:text-body-small-strong">
                    {byRevenue ? money : sold}
                  </span>
                  <span className="text-body-small text-muted-foreground sm:text-body-caption">
                    {byRevenue ? sold : money}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
