import { getLocale, getTranslations } from "next-intl/server";

import { canMarkAttemptRefunded, type OrderPaymentAttempt } from "@/src/domain/entities/PaymentAttempt";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatOrderDate } from "@/src/lib/formatOrderDate";
import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";
import { FIELD_HINT } from "@/src/presentation/dashboard/fieldStyles";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { GiveBackPaymentButton } from "./GiveBackPaymentButton";

type OrderOnlinePaymentsProps = {
  /** The order's online payments it didn't take, oldest first. */
  payments: OrderPaymentAttempt[];
  /** Whether the viewer may mark one given back (`accounting.write`); everyone else reads. */
  canGiveBack: boolean;
};

/**
 * Online payments the gateway captured after this order was paid another way or
 * cancelled: how much, the gateway's reference and the card (what staff look the
 * payment up by in Zarinpal's panel), when, and whether it's been given back.
 * Renders nothing for an order with none.
 */
export async function OrderOnlinePayments({ payments, canGiveBack }: OrderOnlinePaymentsProps) {
  const t = await getTranslations("dashOrders");
  const locale = await getLocale();
  if (payments.length === 0) return null;

  return (
    <DashboardSection
      title={payments.some(canMarkAttemptRefunded) ? t("onlinePayments.heading") : t("onlinePayments.headingDone")}
      description={t("onlinePayments.hint")}
      flush
    >
      <ul>
        {payments.map((payment) => {
          const owed = canMarkAttemptRefunded(payment);
          return (
            <li key={payment.id} className="flex flex-col gap-2 border-t border-border px-5 py-4 first:border-t-0">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <span className="font-semibold whitespace-nowrap text-foreground tabular-nums">
                  {formatMoney(payment.amount, locale)}
                </span>
                <Badge variant={owed ? "warning" : "success"} appearance="outline" dot size="compact">
                  {t(owed ? "onlinePayments.status.unapplied" : "onlinePayments.status.refunded")}
                </Badge>
              </div>
              <dl className={`${FIELD_HINT} flex flex-wrap gap-x-4 gap-y-1`}>
                {payment.refId ? (
                  <div className="flex gap-1.5">
                    <dt>{t("onlinePayments.refLabel")}</dt>
                    <dd dir="ltr" className="text-foreground tabular-nums">
                      {payment.refId}
                    </dd>
                  </div>
                ) : null}
                {payment.cardPan ? (
                  <div className="flex gap-1.5">
                    <dt>{t("onlinePayments.cardLabel")}</dt>
                    <dd dir="ltr" className="text-foreground tabular-nums">
                      {payment.cardPan}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className={FIELD_HINT}>
                <time dateTime={payment.createdAt} className="tabular-nums">
                  {t("onlinePayments.paidAt", { time: formatOrderDate(payment.createdAt, locale) })}
                </time>
                {owed ? null : (
                  <>
                    {" · "}
                    {/* Given back is the attempt's last change, so its last update says when. */}
                    <time dateTime={payment.updatedAt} className="tabular-nums">
                      {t("onlinePayments.givenBackAt", { time: formatOrderDate(payment.updatedAt, locale) })}
                    </time>
                  </>
                )}
              </p>
              {canGiveBack && owed ? (
                <div>
                  <GiveBackPaymentButton
                    paymentId={payment.id}
                    orderNumber={payment.orderNumber}
                    amount={payment.amount}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </DashboardSection>
  );
}
