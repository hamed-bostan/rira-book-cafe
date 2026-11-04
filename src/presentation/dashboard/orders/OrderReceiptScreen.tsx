import { getTranslations } from "next-intl/server";

import type { CafeSettings } from "@/src/domain/entities/CafeSettings";
import type { OrderReceipt } from "@/src/domain/entities/OrderReceipt";
import { PrintButton } from "@/src/presentation/dashboard/accounting/PrintButton";
import { DashboardPageHeader } from "@/src/presentation/dashboard/DashboardPageHeader";
import { DashboardPageCrumb } from "@/src/presentation/dashboard/shell/DashboardPageCrumb";
import { OrderReceiptSlip } from "@/src/presentation/orders/OrderReceiptSlip";

/**
 * An order's receipt, ready to print: the way back to the order and the print
 * button, then the receipt itself. On paper only the receipt is left — the shell,
 * the heading and the button drop away. Presentational: the page reads the receipt
 * over the REST API.
 */
export async function OrderReceiptScreen({ receipt, cafe }: { receipt: OrderReceipt; cafe: CafeSettings }) {
  const t = await getTranslations("dashOrders");
  const { order } = receipt;

  return (
    <div className="flex min-w-0 flex-col gap-6 print:gap-0">
      <DashboardPageCrumb label={`#${order.orderNumber}`} />
      <div className="print:hidden">
        <DashboardPageHeader
          backHref={`/dashboard/orders/${order.id}`}
          backLabel={t("receipt.backToOrder", { number: order.orderNumber })}
          title={t("receipt.title", { number: order.orderNumber })}
          subtitle={t("receipt.subtitle")}
          actions={<PrintButton />}
        />
      </div>
      <OrderReceiptSlip receipt={receipt} cafe={cafe} />
    </div>
  );
}
