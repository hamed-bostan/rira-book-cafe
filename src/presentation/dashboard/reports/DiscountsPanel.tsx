import { getLocale, getTranslations } from "next-intl/server";

import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

import { changeOf, formatChange } from "./reportFormat";
import { ReportPanel } from "./ReportPanel";

import type { SalesReportWire } from "./report-response-schema";

type DiscountsPanelProps = { discounts: SalesReportWire["discounts"] };

/**
 * What the range gave away: promo codes and loyalty points, each against the
 * period before, the points that moved, and each code's uses, what it took off
 * and what its orders brought in.
 */
export async function DiscountsPanel({ discounts }: DiscountsPanelProps) {
  const t = await getTranslations("dashReports");
  const locale = await getLocale();
  const { summary, previousSummary, byCode } = discounts;

  const change = (current: number, previous: number): { text: string; tone: string } => {
    const moved = changeOf(current, previous);
    if (!moved) return { text: t("noBaseline"), tone: "text-muted-foreground" };
    return {
      text: t(moved.up ? "changeUp" : "changeDown", { value: formatChange(moved.share, locale) }),
      // More given away is the cost side: neither good nor bad on its own, so no colour.
      tone: "text-muted-foreground",
    };
  };

  const figures = [
    {
      key: "promo",
      label: t("discounts.promo"),
      value: summary.promoDiscount,
      orders: summary.promoOrders,
      change: change(summary.promoDiscount, previousSummary.promoDiscount),
    },
    {
      key: "points",
      label: t("discounts.points"),
      value: summary.pointsDiscount,
      orders: summary.pointsOrders,
      change: change(summary.pointsDiscount, previousSummary.pointsDiscount),
    },
  ];

  return (
    <ReportPanel title={t("discounts.heading")} description={t("discounts.description")}>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2">
        {figures.map((figure) => (
          <div key={figure.key} className="flex flex-col gap-0.5">
            <dt className="text-body-default font-medium text-foreground/80 sm:text-body-small">{figure.label}</dt>
            <dd className="text-heading-subsection font-bold text-foreground tabular-nums">
              {formatMoney(figure.value, locale)}
            </dd>
            <dd className="text-body-small text-muted-foreground sm:text-body-caption">
              {t("orderCount", { count: figure.orders, formatted: formatNumber(figure.orders, locale) })}
            </dd>
            <dd className={cn("text-body-small sm:text-body-caption", figure.change.tone)}>{figure.change.text}</dd>
          </div>
        ))}
      </dl>
      <p className="text-body-default text-muted-foreground sm:text-body-small">
        {t("discounts.pointsMoved", {
          redeemed: formatNumber(summary.pointsRedeemed, locale),
          earned: formatNumber(summary.pointsEarned, locale),
        })}
      </p>

      <div className="flex flex-col gap-1 border-t border-border pt-4">
        <h3 className="text-body-small-strong text-foreground">{t("discounts.byCodeHeading")}</h3>
        {byCode.length === 0 ? (
          <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">
            {t("discounts.noCodes")}
          </p>
        ) : (
          <ul>
            {byCode.map((code, index) => (
              <li
                key={code.code}
                className={cn(
                  "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5",
                  index > 0 && "border-t border-border",
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span
                    dir="ltr"
                    className="text-body-strong [overflow-wrap:anywhere] text-foreground sm:text-body-small-strong"
                  >
                    {code.code}
                  </span>
                  <span className="text-body-small text-muted-foreground tabular-nums sm:text-body-caption">
                    {t("discounts.codeLine", {
                      uses: t("discounts.uses", { count: code.uses, formatted: formatNumber(code.uses, locale) }),
                      revenue: formatMoney(code.revenue, locale),
                    })}
                  </span>
                </span>
                <span className="text-body-default whitespace-nowrap text-foreground tabular-nums sm:text-body-small">
                  {t("discounts.codeDiscount", { value: formatMoney(code.discount, locale) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ReportPanel>
  );
}
