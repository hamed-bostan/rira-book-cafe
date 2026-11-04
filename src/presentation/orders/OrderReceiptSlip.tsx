import { getLocale, getTranslations } from "next-intl/server";

import type { OrderReceipt } from "@/src/domain/entities/OrderReceipt";
import { CAFE_LOCATION } from "@/src/lib/cafeLocation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatNumber, formatNumberTrimmed } from "@/src/lib/formatNumber";
import { formatOrderDate, formatOrderTime } from "@/src/lib/formatOrderDate";
import { getSiteUrl } from "@/src/lib/siteUrl";
import { cn } from "@/src/lib/utils";

import { OrderItemOptions } from "./OrderItemOptions";

import type { ReactNode } from "react";

/** The printer's margins when a receipt prints: a till roll's width goes to the receipt, not to white space. */
const RECEIPT_PAGE_CSS = "@media print { @page { margin: 4mm; } }";

/** A rule across the receipt between its parts, dashed like a till roll's. */
const RULE = "border-t border-dashed border-border-strong print:border-foreground";

/** A muted line: the cafe's details, a line's note. On paper everything is printed in full ink. */
const MUTED = "text-muted-foreground";

/** A label and its figure, the figure at the line's end and never split. */
function receiptRow(label: ReactNode, value: ReactNode, className?: string, key?: string): ReactNode {
  return (
    <div key={key} className={cn("flex items-baseline justify-between gap-3", className)}>
      <dt className="min-w-0">{label}</dt>
      <dd className="shrink-0 text-end whitespace-nowrap tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * An order's receipt: the cafe, the order's number, when and where it was served,
 * every line with what it cost, the discounts, the total with the VAT inside it (as
 * the books split it), how it was paid and what came back. One narrow column — on
 * screen a slip of paper, on paper the width of an 80mm till roll, and centred at
 * the top of an A4 sheet. The dashboard's print page and the guest's own receipt
 * both draw this.
 *
 * Amounts are bare figures under a "Toman" heading, the way a till prints them, so
 * a nine-digit line still fits the roll.
 */
export async function OrderReceiptSlip({ receipt }: { receipt: OrderReceipt }) {
  const t = await getTranslations("dashOrders");
  const tMeta = await getTranslations("meta");
  const locale = await getLocale();
  const { order, payments, refunds, vatRateBps, vatIncluded } = receipt;
  const money = (amount: number): string => formatNumber(amount, locale);
  const website = (await getSiteUrl()).host;
  const address = [
    CAFE_LOCATION.streetAddress,
    CAFE_LOCATION.addressLocality,
    CAFE_LOCATION.addressRegion,
    CAFE_LOCATION.postalCode,
  ]
    .filter(Boolean)
    .join(t("receipt.addressSeparator"));
  const discounted = order.promoDiscount > 0 || order.pointsDiscount > 0;
  const number = formatNumber(order.orderNumber, locale);

  return (
    <article
      aria-label={t("receipt.aria", { number })}
      className="mx-auto flex w-full max-w-[24rem] flex-col gap-4 rounded-card-lg border border-border bg-background p-5 text-body-default text-foreground shadow-xs sm:text-body-small print:max-w-[80mm] print:gap-3 print:rounded-none print:border-0 print:p-0 print:text-[9.5pt] print:shadow-none print:**:text-foreground"
    >
      <style>{RECEIPT_PAGE_CSS}</style>

      <header className="flex flex-col items-center gap-0.5 text-center">
        <p className="text-body-strong text-foreground">{tMeta("siteName")}</p>
        {address ? <p className={MUTED}>{address}</p> : null}
        {CAFE_LOCATION.telephone ? (
          <p dir="ltr" className={cn(MUTED, "tabular-nums")}>
            {CAFE_LOCATION.telephone}
          </p>
        ) : null}
        <p dir="ltr" className={MUTED}>
          {website}
        </p>
      </header>

      <div className={cn(RULE, "flex flex-col gap-2 pt-3")}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-body-strong text-foreground">{t("receipt.heading")}</h2>
          <span className="font-semibold whitespace-nowrap tabular-nums">#{number}</span>
        </div>
        <dl className="flex flex-col gap-1">
          {receiptRow(t("receipt.date"), formatOrderDate(order.placedAt, locale))}
          {receiptRow(t("receipt.time"), formatOrderTime(order.placedAt, locale))}
          {receiptRow(
            t("colService"),
            order.serviceType === "dineIn" ? t("table", { table: order.tableLabel ?? "?" }) : t("service.takeaway"),
          )}
          {receiptRow(
            t("colGuest"),
            <span dir="auto" className="block max-w-[12rem] truncate">
              {order.customerName}
            </span>,
          )}
        </dl>
        {order.status === "cancelled" ? (
          <p className="rounded-button border border-border-strong px-3 py-1 text-center font-semibold print:border-foreground">
            {t("receipt.cancelled")}
          </p>
        ) : null}
      </div>

      <table className={cn(RULE, "w-full border-collapse")}>
        <thead>
          <tr className={cn(MUTED, "border-b border-border print:border-foreground")}>
            <th scope="col" className="py-2 text-start font-medium">
              {t("receipt.colItem")}
            </th>
            <th scope="col" className="py-2 text-end font-medium">
              {t("receipt.colAmount")}
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="py-1.5 pe-3">
                <span className="block font-medium [overflow-wrap:anywhere]" dir="auto">
                  <span className="tabular-nums">{formatNumber(item.quantity, locale)}×</span> {item.name}
                </span>
                <OrderItemOptions options={item.options} className={cn(MUTED, "[overflow-wrap:anywhere]")} />
                {item.quantity > 1 ? (
                  <span className={cn(MUTED, "block tabular-nums")}>
                    {t("receipt.each", { price: money(item.unitPrice) })}
                  </span>
                ) : null}
                {item.note ? (
                  <span className={cn(MUTED, "block [overflow-wrap:anywhere]")} dir="auto">
                    {item.note}
                  </span>
                ) : null}
                {item.refundedQuantity ? (
                  <span className={cn(MUTED, "block")}>
                    {t("refund.lineRefunded", { quantity: formatNumber(item.refundedQuantity, locale) })}
                  </span>
                ) : null}
              </td>
              <td className="py-1.5 text-end whitespace-nowrap tabular-nums">
                {money(item.unitPrice * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className={cn(RULE, "flex flex-col gap-1 pt-3")}>
        {discounted ? receiptRow(t("subtotal"), money(order.subtotal)) : null}
        {order.promoDiscount > 0
          ? receiptRow(t("promoDiscount", { code: order.promoCode ?? "" }), `−${money(order.promoDiscount)}`)
          : null}
        {order.pointsDiscount > 0
          ? receiptRow(
              t("pointsDiscount", { points: formatNumber(order.pointsRedeemed, locale) }),
              `−${money(order.pointsDiscount)}`,
            )
          : null}
        {receiptRow(
          <span className="font-bold">{t("receipt.total")}</span>,
          <span className="font-bold">{money(order.total)}</span>,
          "text-body-strong",
        )}
        {receiptRow(
          t("receipt.vatIncluded", { rate: formatNumberTrimmed(vatRateBps / 100, locale, 2) }),
          money(vatIncluded),
          MUTED,
        )}
      </dl>

      <dl className={cn(RULE, "flex flex-col gap-1 pt-3")}>
        {payments.map((part) =>
          receiptRow(
            t("receipt.paidBy", { method: t(`paymentMethod.${part.method}`) }),
            money(part.amount),
            undefined,
            part.method,
          ),
        )}
        {refunds.map((refund) =>
          receiptRow(
            t("receipt.refundLine", {
              number: refund.number,
              method: t(`paymentMethod.${refund.method}`),
              date: formatCafeDayMedium(refund.date, locale),
            }),
            `−${money(refund.amount)}`,
            undefined,
            `refund-${refund.number}`,
          ),
        )}
        {receiptRow(
          t("receipt.paymentStatus"),
          <span className="font-semibold">{t(`payment.${order.paymentStatus}`)}</span>,
        )}
        {order.paymentStatus === "unpaid" && order.status !== "cancelled"
          ? receiptRow(t("receipt.due"), <span className="font-semibold">{money(order.total)}</span>)
          : null}
      </dl>

      <p className={cn(RULE, MUTED, "pt-3 text-center")}>{t("receipt.thanks")}</p>
    </article>
  );
}
