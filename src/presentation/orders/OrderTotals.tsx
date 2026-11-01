import { getLocale, getTranslations } from "next-intl/server";

import type { Order } from "@/src/domain/entities/Order";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

type OrderTotalsProps = {
  order: Pick<
    Order,
    | "subtotal"
    | "promoCode"
    | "promoDiscount"
    | "pointsRedeemed"
    | "pointsDiscount"
    | "pointsEarned"
    | "total"
    | "refundedTotal"
  >;
  /** The dashboard's section draws it edge to edge: it brings its own inset, and rules the total off. */
  inset?: boolean;
};

/**
 * The bottom of an order: what the lines came to, what the promo code and points
 * took off, and what's paid — plus the points it earned. Without discounts it's
 * just the total. Shared by the guest's order page and the dashboard's.
 */
export async function OrderTotals({ order, inset = false }: OrderTotalsProps) {
  const t = await getTranslations("dashOrders");
  const locale = await getLocale();
  const discounted = order.promoDiscount > 0 || order.pointsDiscount > 0;
  const rowText = inset ? "text-body-default sm:text-body-small" : "text-body-small";

  return (
    <dl className={cn("flex flex-col border-t border-border", inset ? "gap-2 px-5 py-4" : "gap-1.5 pt-3")}>
      {discounted ? (
        <div className={cn("flex items-center justify-between text-muted-foreground", rowText)}>
          <dt>{t("subtotal")}</dt>
          <dd>{formatMoney(order.subtotal, locale)}</dd>
        </div>
      ) : null}
      {order.promoDiscount > 0 ? (
        <div className={cn("flex items-center justify-between text-success-foreground", rowText)}>
          <dt>{t("promoDiscount", { code: order.promoCode ?? "" })}</dt>
          <dd>−{formatMoney(order.promoDiscount, locale)}</dd>
        </div>
      ) : null}
      {order.pointsDiscount > 0 ? (
        <div className={cn("flex items-center justify-between text-success-foreground", rowText)}>
          <dt>{t("pointsDiscount", { points: formatNumber(order.pointsRedeemed, locale) })}</dt>
          <dd>−{formatMoney(order.pointsDiscount, locale)}</dd>
        </div>
      ) : null}
      <div className={cn("flex items-center justify-between", inset && discounted && "border-t border-border pt-2")}>
        <dt className={cn("text-body-strong text-foreground", inset && "font-bold")}>{t("total")}</dt>
        <dd className={cn("text-body-strong text-foreground", inset && "font-bold tabular-nums")}>
          {formatMoney(order.total, locale)}
        </dd>
      </div>
      {order.refundedTotal > 0 ? (
        <div className={cn("flex items-center justify-between text-error-foreground", rowText)}>
          <dt>{t("refund.totalLabel")}</dt>
          <dd>−{formatMoney(order.refundedTotal, locale)}</dd>
        </div>
      ) : null}
      {order.pointsEarned > 0 ? (
        <p className="text-body-caption text-primary">
          {t("pointsEarned", { points: formatNumber(order.pointsEarned, locale) })}
        </p>
      ) : null}
    </dl>
  );
}
