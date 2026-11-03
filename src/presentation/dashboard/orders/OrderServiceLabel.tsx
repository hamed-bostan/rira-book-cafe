import { ShoppingBag, UtensilsCrossed } from "lucide-react";
import { useTranslations } from "next-intl";

import type { Order } from "@/src/domain/entities/Order";

/**
 * "Table 4" with a dine-in icon, or "Takeaway" with a bag. On one line; a table's
 * label too long for the space it's given ends in an ellipsis.
 */
export function OrderServiceLabel({ order }: { order: Pick<Order, "serviceType" | "tableLabel"> }) {
  const t = useTranslations("dashOrders");
  const dineIn = order.serviceType === "dineIn";
  const ServiceIcon = dineIn ? UtensilsCrossed : ShoppingBag;

  return (
    <span className="flex max-w-full min-w-0 items-center gap-2 text-body-default whitespace-nowrap text-foreground sm:text-body-small">
      <ServiceIcon aria-hidden className="size-5 shrink-0 text-icon-accent sm:size-4" />
      <span className="truncate">
        {dineIn ? t("table", { table: order.tableLabel ?? "?" }) : t("service.takeaway")}
      </span>
    </span>
  );
}
