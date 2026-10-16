import { ShoppingBag, UtensilsCrossed } from "lucide-react";
import { useTranslations } from "next-intl";

import type { Order } from "@/src/domain/entities/Order";

/** "Table 4" with a dine-in icon, or "Takeaway" with a bag. */
export function OrderServiceLabel({ order }: { order: Pick<Order, "serviceType" | "tableLabel"> }) {
  const t = useTranslations("dashOrders");
  const dineIn = order.serviceType === "dineIn";
  const ServiceIcon = dineIn ? UtensilsCrossed : ShoppingBag;

  return (
    <span className="flex items-center gap-2 whitespace-nowrap text-body-small text-foreground">
      <ServiceIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      {dineIn ? t("table", { table: order.tableLabel ?? "?" }) : t("service.takeaway")}
    </span>
  );
}
