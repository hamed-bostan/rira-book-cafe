import { AlertTriangle } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { OrderPaymentAttempt } from "@/src/domain/entities/PaymentAttempt";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

/**
 * The Orders list's warning about money to give back: online payments the gateway
 * captured after their order was paid another way or cancelled. One amber band
 * above the list, a chip per payment linking to its order — where it's marked given
 * back. Renders nothing when there's none.
 */
export async function UnappliedPaymentsAlert({ payments }: { payments: OrderPaymentAttempt[] }) {
  const t = await getTranslations("dashOrders");
  const locale = await getLocale();
  if (payments.length === 0) return null;

  return (
    <section
      aria-labelledby="unapplied-payments-alert"
      className="flex flex-col gap-3 rounded-card-lg border border-warning-border bg-warning px-5 py-4"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Icon icon={AlertTriangle} size="icon-lg" className="shrink-0 text-warning-foreground" />
          <h2 id="unapplied-payments-alert" className="text-body-strong text-foreground sm:text-body-small-strong">
            {t("onlinePayments.alertTitle", { count: payments.length })}
          </h2>
        </div>
        <p className="text-body-default text-pretty text-foreground/80 sm:text-body-small">
          {t("onlinePayments.alertBody")}
        </p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {payments.map((payment) => (
          <li key={payment.id}>
            <Link
              href={`/dashboard/orders/${payment.orderId}`}
              // 44px to the touch on a phone, 32px from `sm`.
              className={cn(
                "flex h-11 items-center gap-2 rounded-badge-md border border-warning-border bg-background px-3 text-body-caption-emphasis whitespace-nowrap text-foreground transition-colors hover:bg-muted sm:h-8",
                focusRing,
              )}
            >
              <span className="tabular-nums">#{payment.orderNumber}</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{formatMoney(payment.amount, locale)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
