import { getLocale, getTranslations } from "next-intl/server";

import { TOP_ITEM_SORTS, type TopItemSort } from "@/src/domain/entities/Analytics";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";

import { ReportPanel } from "./ReportPanel";
import { ReportSegmentedLinks } from "./ReportSegmentedLinks";

import type { TopItemWire } from "./report-response-schema";

type BestSellersProps = {
  /** Already ranked by `sort` on the server. */
  items: TopItemWire[];
  sort: TopItemSort;
  /** Where each ranking lives — the same report with `?sort=`. */
  sortHref: (sort: TopItemSort) => string;
};

/**
 * What sold best in the range, by takings or by units, each with a bar against the
 * top seller. The ranking is a link rather than client state: the report ranks a
 * capped list, so re-sorting the revenue ranking here could leave out a cheap item
 * that sells the most.
 */
export async function BestSellers({ items, sort, sortHref }: BestSellersProps) {
  const t = await getTranslations("dashReports");
  const locale = await getLocale();
  const byRevenue = sort === "revenue";
  const top = Math.max(1, ...items.map((item) => (byRevenue ? item.revenue : item.quantity)));
  const sold = (item: TopItemWire): string =>
    t("unitsSold", { count: item.quantity, formatted: formatNumber(item.quantity, locale) });

  return (
    <ReportPanel
      title={t("sales.bestSellers")}
      action={
        <ReportSegmentedLinks
          label={t("sales.bestSellersSort")}
          current={sort}
          options={TOP_ITEM_SORTS.map((option) => ({
            key: option,
            label: t(`sales.sort.${option}`),
            href: sortHref(option),
          }))}
        />
      }
    >
      {items.length === 0 ? (
        <p className="text-body-default text-muted-foreground sm:text-body-small">{t("noSales")}</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {items.map((item, index) => (
            <li key={item.productId} className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-3 text-body-default sm:text-body-small">
                <span className="w-5 shrink-0 font-semibold whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatNumber(index + 1, locale)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span dir="auto" className="font-medium [overflow-wrap:anywhere] text-foreground">
                    {item.name}
                  </span>
                  <span className="text-body-small whitespace-nowrap text-muted-foreground tabular-nums sm:text-body-caption">
                    {byRevenue ? sold(item) : formatMoney(item.revenue, locale)}
                  </span>
                </span>
                <span className="font-semibold whitespace-nowrap text-foreground tabular-nums">
                  {byRevenue ? formatNumber(item.revenue, locale) : sold(item)}
                </span>
              </div>
              <div aria-hidden className="ms-8 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${((byRevenue ? item.revenue : item.quantity) / top) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </ReportPanel>
  );
}
