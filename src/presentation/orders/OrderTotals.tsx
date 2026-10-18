import { getLocale, getTranslations } from "next-intl/server";

import type { Order } from "@/src/domain/entities/Order";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";

type OrderTotalsProps = {
  order: Pick<
    Order,
    "subtotal" | "promoCode" | "promoDiscount" | "pointsRedeemed" | "pointsDiscount" | "pointsEarned" | "total"
  >;
};

/**
 * The bottom of an order: what the lines came to, what the promo code and points
 * took off, and what's paid — plus the points it earned. Without discounts it's
 * just the total. Shared by the guest's order page and the dashboard's.
 */
export async function OrderTotals({ order }: OrderTotalsProps) {
  const t = await getTranslations("dashOrders");
  const locale = await getLocale();
  const discounted = order.promoDiscount > 0 || order.pointsDiscount > 0;

  return (
    <dl className="flex flex-col gap-1.5 border-t border-border pt-3">
      {discounted ? (
        <div className="flex items-center justify-between text-body-small text-muted-foreground">
          <dt>{t("subtotal")}</dt>
          <dd>{formatMoney(order.subtotal, locale)}</dd>
        </div>
      ) : null}
      {order.promoDiscount > 0 ? (
        <div className="flex items-center justify-between text-body-small text-success-foreground">
          <dt>{t("promoDiscount", { code: order.promoCode ?? "" })}</dt>
          <dd>−{formatMoney(order.promoDiscount, locale)}</dd>
        </div>
      ) : null}
      {order.pointsDiscount > 0 ? (
        <div className="flex items-center justify-between text-body-small text-success-foreground">
          <dt>{t("pointsDiscount", { points: formatNumber(order.pointsRedeemed, locale) })}</dt>
          <dd>−{formatMoney(order.pointsDiscount, locale)}</dd>
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <dt className="text-body-strong text-foreground">{t("total")}</dt>
        <dd className="text-body-strong text-foreground">{formatMoney(order.total, locale)}</dd>
      </div>
      {order.pointsEarned > 0 ? (
        <p className="text-body-caption text-primary">
          {t("pointsEarned", { points: formatNumber(order.pointsEarned, locale) })}
        </p>
      ) : null}
    </dl>
  );
}
