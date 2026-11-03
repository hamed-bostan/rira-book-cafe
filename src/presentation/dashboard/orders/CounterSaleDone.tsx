"use client";

import { ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

type CounterSaleDoneProps = {
  orderId: string;
  orderNumber: number;
};

/**
 * What New sale leaves behind once a sale is in: its number, and the way to the
 * order and to its receipt — to print one for the guest before the next sale.
 */
export function CounterSaleDone({ orderId, orderNumber }: CounterSaleDoneProps) {
  const t = useTranslations("dashOrders");

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-button bg-success px-4 py-3 text-body-default text-success-foreground sm:text-body-small"
    >
      <p className="font-medium">{t("counter.done", { number: orderNumber })}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="control-md" className="px-3">
          <Link href={`/dashboard/orders/${orderId}/receipt`}>
            <Icon icon={ReceiptText} size="icon-md" className="me-2" />
            {t("receipt.print")}
          </Link>
        </Button>
        <Button asChild variant="secondary" size="control-md" className="px-3">
          <Link href={`/dashboard/orders/${orderId}`}>{t("counter.openOrder")}</Link>
        </Button>
      </div>
    </div>
  );
}
