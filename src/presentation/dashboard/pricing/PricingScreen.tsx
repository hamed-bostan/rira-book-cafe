import { CircleAlert, Package, Receipt, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { PricingReport } from "@/src/domain/entities/Pricing";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { moneyUnit } from "@/src/lib/formatMoney";
import { formatNumber, formatNumberTrimmed } from "@/src/lib/formatNumber";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { FIELD_HINT } from "../fieldStyles";
import { MetricCard } from "../MetricCard";
import { METRIC_GRID_OF_THREE } from "../pageStyles";

import { PRICING_CARD_GRID, PricingItemCard } from "./PricingItemCard";
import { PricingTabs } from "./PricingTabs";

type PricingScreenProps = {
  report: PricingReport;
  canWrite: boolean;
  /** Applying a price changes the menu, so it also needs `catalog.write`. */
  canApply: boolean;
};

/**
 * Every menu item's real cost — ingredients plus its share of the running costs —
 * the owner's profit target, the price that earns it, and what the item earns at
 * today's price: a card per item, as many abreast as the page has room for.
 */
export async function PricingScreen({ report, canWrite, canApply }: PricingScreenProps) {
  const t = await getTranslations("dashPricing");
  const tProducts = await getTranslations("dashProducts");
  const locale = await getLocale();
  const { basis } = report;
  const defaultPercent = report.settings.defaultMarkupBps / 100;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PricingTabs active="items" title={t("heading")} subtitle={t("subtitle")} />

      <div className={METRIC_GRID_OF_THREE}>
        <MetricCard
          label={t("summary.monthlyOverhead")}
          icon={Receipt}
          value={basis.monthlyOverhead === null ? "—" : formatNumber(basis.monthlyOverhead, locale)}
          unit={basis.monthlyOverhead === null ? undefined : moneyUnit(locale)}
          hint={
            basis.source === "manual"
              ? t("summary.manual")
              : t("summary.fromBooks", { months: formatNumber(basis.months, locale) })
          }
        />
        <MetricCard
          label={t("summary.monthlyUnits")}
          icon={Users}
          value={basis.monthlyUnits === null ? "—" : formatNumber(basis.monthlyUnits, locale)}
          hint={
            report.settings.expectedMonthlyUnits
              ? t("summary.expected")
              : t("summary.fromSales", { months: formatNumber(basis.months, locale) })
          }
        />
        <MetricCard
          label={t("summary.overheadPerUnit")}
          icon={Package}
          value={report.overheadPerUnit === null ? "—" : formatNumber(report.overheadPerUnit, locale)}
          unit={report.overheadPerUnit === null ? undefined : moneyUnit(locale)}
          hint={t("summary.defaultProfit", { percent: formatNumberTrimmed(defaultPercent, locale, 1) })}
        />
      </div>

      {basis.fromDay && basis.toDay && basis.source === "ledger" ? (
        <p className={FIELD_HINT}>
          {t("summary.span", {
            from: formatCafeDayMedium(basis.fromDay, locale),
            to: formatCafeDayMedium(basis.toDay, locale),
          })}
        </p>
      ) : null}

      {report.overheadPerUnit === null ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-card-lg border border-warning-border bg-warning px-4 py-3 text-warning-foreground"
        >
          <Icon icon={CircleAlert} size="icon-lg" />
          <p className="text-body-default font-medium text-pretty sm:text-body-small">
            {t("noOverhead")}{" "}
            <Link href="/dashboard/pricing/settings" className="font-semibold underline">
              {t("tab.settings")}
            </Link>
          </p>
        </div>
      ) : null}

      <p className={FIELD_HINT}>{t("formula")}</p>

      {report.rows.length === 0 ? (
        <section className="min-w-0 rounded-card-lg border border-border bg-background shadow-xs">
          <DashboardEmptyState title={tProducts("emptyTitle")} body={tProducts("emptyBody")} />
        </section>
      ) : (
        <ul className={PRICING_CARD_GRID}>
          {report.rows.map((row) => (
            <li key={row.productId} className="min-w-0">
              <PricingItemCard
                row={row}
                defaultMarkupBps={report.settings.defaultMarkupBps}
                canWrite={canWrite}
                canApply={canApply}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
