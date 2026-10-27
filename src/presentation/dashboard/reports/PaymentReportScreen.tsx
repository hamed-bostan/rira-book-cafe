import { CircleCheck, Clock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { AnalyticsRangePreset } from "@/src/domain/entities/Analytics";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { PaymentMethod } from "@/src/domain/entities/Order";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayShort, formatPercent } from "@/src/lib/formatCafeDay";
import { formatMoney, moneyUnit } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderTime } from "@/src/lib/formatOrderDate";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { MetricCard } from "../MetricCard";

import { MarkPaidButton } from "./MarkPaidButton";
import { ReportPanel } from "./ReportPanel";
import { ReportsFrame } from "./ReportsFrame";
import { ShareBars } from "./ShareBars";

import type { PaymentReportWire } from "./report-response-schema";

/**
 * How the paid orders are grouped: card and card-to-card both land in the bank,
 * so they read as one — the same split as the till, the bank and the gateway.
 */
const METHOD_GROUPS = [
  { key: "bank", methods: ["card", "transfer"], colorClassName: "bg-primary" },
  { key: "cash", methods: ["cash"], colorClassName: "bg-info-foreground" },
  { key: "online", methods: ["online"], colorClassName: "bg-warning-foreground" },
] as const satisfies readonly { key: string; methods: readonly PaymentMethod[]; colorClassName: string }[];

type PaymentReportScreenProps = {
  report: PaymentReportWire;
  selected: AnalyticsRangePreset | "custom";
  /** The page's range params, carried across the tabs. */
  rangeQuery: Record<string, string>;
  /** The cafe day it is, to say "Today" and "Yesterday" beside an order's time. */
  today: string;
  /** May the viewer mark an order paid (`orders.fulfill`)? */
  canMarkPaid: boolean;
};

/**
 * The Payments tab: how much of the range's revenue came in and how much is
 * still owed, how the paid part was settled, and the served-but-unpaid orders to
 * chase — each with "Mark paid". Presentational — the page fetches over the BFF.
 */
export async function PaymentReportScreen({
  report,
  selected,
  rangeQuery,
  today,
  canMarkPaid,
}: PaymentReportScreenProps) {
  const t = await getTranslations("dashReports");
  const tOrders = await getTranslations("dashOrders");
  const locale = await getLocale();
  const { summary } = report;
  const unit = moneyUnit(locale);
  const revenue = summary.paidValue + summary.unpaidValue;

  const methodValue = (methods: readonly PaymentMethod[]): number =>
    report.byMethod.filter((row) => methods.includes(row.method)).reduce((sum, row) => sum + row.value, 0);
  const paidTotal = methodValue(METHOD_GROUPS.flatMap((group) => group.methods));

  const when = (placedAt: string): string => {
    const day = cafeDayOf(new Date(placedAt));
    const time = formatOrderTime(placedAt, locale);
    if (day === today) return t("payments.todayAt", { time });
    if (day === shiftCafeDay(today, -1)) return t("payments.yesterdayAt", { time });
    return t("payments.dayAt", { day: formatCafeDayShort(day, locale), time });
  };

  return (
    <ReportsFrame tab="payments" selected={selected} rangeQuery={rangeQuery} range={report.range}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricCard
          label={t("payments.paid")}
          icon={CircleCheck}
          value={formatNumber(summary.paidValue, locale)}
          unit={unit}
          hint={
            revenue > 0
              ? t("payments.paidShare", { percent: formatPercent(summary.paidValue / revenue, locale) })
              : undefined
          }
        />
        <MetricCard
          label={t("payments.unpaid")}
          icon={Clock}
          value={formatNumber(summary.unpaidValue, locale)}
          unit={unit}
          hint={
            summary.unpaidOrders > 0
              ? t("payments.waiting", {
                  count: summary.unpaidOrders,
                  formatted: formatNumber(summary.unpaidOrders, locale),
                })
              : t("payments.nothingWaiting")
          }
          hintTone={summary.unpaidOrders > 0 ? "warning" : undefined}
          hintDot={summary.unpaidOrders > 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ReportPanel title={t("payments.paidByHeading")} description={t("payments.paidByDescription")}>
          {paidTotal === 0 ? (
            <p className="text-body-default text-muted-foreground sm:text-body-small">{t("payments.nothingPaid")}</p>
          ) : (
            <ShareBars
              rows={METHOD_GROUPS.map((group) => {
                const value = methodValue(group.methods);
                return {
                  key: group.key,
                  label: t(`payments.method.${group.key}`),
                  valueLabel: `${formatMoney(value, locale)} · ${formatPercent(value / paidTotal, locale)}`,
                  share: value / paidTotal,
                  colorClassName: group.colorClassName,
                };
              })}
            />
          )}
        </ReportPanel>

        <ReportPanel
          title={t("payments.unpaidHeading")}
          description={t("payments.unpaidDescription")}
          className="gap-2"
        >
          {report.unpaid.length === 0 ? (
            <p className="text-body-default text-muted-foreground sm:text-body-small">{t("payments.allPaid")}</p>
          ) : (
            <ul>
              {report.unpaid.map((order, index) => {
                const titleId = `unpaid-${order.id}`;
                const where =
                  order.serviceType === "dineIn" && order.tableLabel
                    ? tOrders("table", { table: order.tableLabel })
                    : tOrders(`service.${order.serviceType}`);
                return (
                  <li
                    key={order.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3",
                      index > 0 && "border-t border-border",
                    )}
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Link
                        id={titleId}
                        href={`/dashboard/orders/${order.id}`}
                        className={cn(
                          "text-body-strong text-foreground transition-colors hover:text-primary sm:text-body-small-strong",
                          focusRing,
                        )}
                      >
                        {t("payments.orderTitle", { number: String(order.orderNumber), where })}
                      </Link>
                      <span className="text-body-small text-muted-foreground sm:text-body-caption">
                        {when(order.placedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-body-strong whitespace-nowrap text-foreground tabular-nums sm:text-body-small-strong">
                        {formatMoney(order.total, locale)}
                      </span>
                      {canMarkPaid ? (
                        <MarkPaidButton orderId={order.id} orderNumber={order.orderNumber} describedBy={titleId} />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ReportPanel>
      </div>
    </ReportsFrame>
  );
}
