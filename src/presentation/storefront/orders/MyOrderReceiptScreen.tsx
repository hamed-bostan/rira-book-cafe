import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { OrderReceipt } from "@/src/domain/entities/OrderReceipt";
import { Link } from "@/src/i18n/navigation";
import { PrintButton } from "@/src/presentation/dashboard/accounting/PrintButton";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { OrderReceiptSlip } from "@/src/presentation/orders/OrderReceiptSlip";

/**
 * The guest's receipt for one of their orders — the same slip the counter prints —
 * with the way back to the order and a print button, which drop away on paper.
 */
export async function MyOrderReceiptScreen({ receipt }: { receipt: OrderReceipt }) {
  const t = await getTranslations("site");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 print:gap-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/orders/${receipt.order.id}`}
          className="inline-flex min-h-11 w-fit items-center gap-1 text-body-small-strong text-muted-foreground hover:text-foreground"
        >
          <Icon icon={ChevronLeft} size="xs" className="rtl:-scale-x-100" />
          {t("orders.backToOrder")}
        </Link>
        <PrintButton />
      </div>
      <OrderReceiptSlip receipt={receipt} />
    </div>
  );
}
