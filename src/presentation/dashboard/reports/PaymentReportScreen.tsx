import { CircleAlert, CircleCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { AnalyticsRangePreset } from "@/src/domain/entities/Analytics";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDateShort, formatOrderTime } from "@/src/lib/formatOrderDate";
import { OrderStatusBadge } from "@/src/presentation/dashboard/orders/OrderStatusBadge";

import { StatCard } from "../StatCard";

import { ReportHeader } from "./ReportHeader";
import { ShareBars } from "./ShareBars";

import type { PaymentReportWire } from "./report-response-schema";

type PaymentReportScreenProps = {
  report: PaymentReportWire;
  selected: AnalyticsRangePreset | "custom";
};

/**
 * Counter payments: how much of the range's orders were marked paid, and the
 * served-but-unpaid orders someone should chase — each links to the order, where
 * the "Paid" switch lives.
 */
export async function PaymentReportScreen({ report, selected }: PaymentReportScreenProps) {
  const t = await getTranslations("dashReports");
  const tOrders = await getTranslations("dashOrders");
  const locale = await getLocale();
  const { summary } = report;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ReportHeader title={t("payments.title")} subtitle={t("payments.subtitle")} range={report.range} selected={selected} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label={t("payments.paid")}
          value={formatMoney(summary.paidValue, locale)}
          hint={t("orderCount", { count: summary.paidOrders, formatted: formatNumber(summary.paidOrders, locale) })}
          icon={CircleCheck}
          tone="brand"
        />
        <StatCard
          label={t("payments.unpaid")}
          value={formatMoney(summary.unpaidValue, locale)}
          hint={t("orderCount", { count: summary.unpaidOrders, formatted: formatNumber(summary.unpaidOrders, locale) })}
          icon={CircleAlert}
          tone={summary.unpaidOrders > 0 ? "warning" : "brand"}
        />
      </div>

      <ShareBars
        heading={t("payments.splitHeading")}
        empty={t("noSales")}
        rows={[
          { key: "paid", label: tOrders("payment.paid"), value: summary.paidValue, valueLabel: formatMoney(summary.paidValue, locale) },
          { key: "unpaid", label: tOrders("payment.unpaid"), value: summary.unpaidValue, valueLabel: formatMoney(summary.unpaidValue, locale) },
        ]}
      />

      <section className="min-w-0 rounded-card-lg border border-border bg-background p-4 md:p-6">
        <h2 className="text-body-lead text-foreground">{t("payments.unpaidHeading")}</h2>
        <p className="text-body-small text-muted-foreground">{t("payments.unpaidDescription")}</p>
        {report.unpaid.length === 0 ? (
          <p className="py-8 text-center text-body-small-emphasis text-muted-foreground">{t("payments.allPaid")}</p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-border">
            {report.unpaid.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-3 py-3">
                <Link href={`/dashboard/orders/${order.id}`} className="text-body-small-emphasis text-primary underline-offset-4 hover:underline">
                  #{order.orderNumber}
                </Link>
                <span className="min-w-0 flex-1 truncate text-body-small text-foreground">{order.customerName}</span>
                <OrderStatusBadge status={order.status} />
                <span className="text-body-caption text-muted-foreground">
                  {formatOrderDateShort(order.placedAt, locale)} · {formatOrderTime(order.placedAt, locale)}
                </span>
                <span className="text-body-small-emphasis text-foreground">{formatMoney(order.total, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
