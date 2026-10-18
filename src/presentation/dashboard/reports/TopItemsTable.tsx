import { Trophy } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { TopItemSort } from "@/src/domain/entities/Analytics";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";

import type { TopItemWire } from "./report-response-schema";

type TopItemsTableProps = {
  items: TopItemWire[];
  sort: TopItemSort;
  /** Query params to keep when switching sort (the range). */
  keep: Record<string, string>;
  /** Where the sort links point. */
  basePath: string;
};

/** Best sellers, ranked by revenue or units — switchable by link, so the choice lives in the URL. */
export async function TopItemsTable({ items, sort, keep, basePath }: TopItemsTableProps) {
  const t = await getTranslations("dashReports");
  const tProducts = await getTranslations("dashProducts");
  const locale = await getLocale();

  function sortHref(next: TopItemSort): string {
    const params = new URLSearchParams(keep);
    if (next === "revenue") params.delete("sort");
    else params.set("sort", next);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <section className="min-w-0 rounded-card-lg border border-border bg-background p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-body-lead text-foreground">{t("topItemsHeading")}</h2>
        <div className="flex gap-3 text-body-small">
          {(["revenue", "quantity"] as const).map((option) => (
            <Link
              key={option}
              href={sortHref(option)}
              aria-current={sort === option ? "true" : undefined}
              className={cn(
                "underline-offset-4 hover:underline",
                sort === option ? "text-primary" : "text-muted-foreground",
              )}
            >
              {t(`topItemsSort.${option}`)}
            </Link>
          ))}
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Trophy} title={t("noSales")} className="py-8" />
      ) : (
        <ol className="mt-4 flex flex-col divide-y divide-border">
          {items.map((item, index) => (
            <li key={item.productId} className="flex items-center gap-3 py-2.5">
              <span className="w-6 shrink-0 text-body-small text-muted-foreground tabular-nums">
                {formatNumber(index + 1, locale)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-small-strong text-foreground">{item.name}</span>
                <span className="text-body-caption text-muted-foreground">{tProducts(`kind.${item.kind}`)}</span>
              </span>
              <span className="text-end">
                <span className="block text-body-small-emphasis text-foreground">
                  {formatMoney(item.revenue, locale)}
                </span>
                <span className="text-body-caption text-muted-foreground">
                  {t("unitsSold", { count: item.quantity, formatted: formatNumber(item.quantity, locale) })}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
