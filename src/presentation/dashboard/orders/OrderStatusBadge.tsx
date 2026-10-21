import { useTranslations } from "next-intl";

import type { OrderStatus } from "@/src/domain/entities/Order";
import { Badge, type BadgeProps } from "@/src/presentation/design-system/components/Badge/Badge";

/**
 * Colour by urgency, not by step: what needs someone's attention now (pending) is
 * loud, work in hand is calm, finished is quiet.
 */
const VARIANT: Record<OrderStatus, NonNullable<BadgeProps["variant"]>> = {
  pending: "warning",
  preparing: "info",
  completed: "neutral",
  cancelled: "error",
};

/** An order's status as an outlined pill with a leading dot. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations("dashOrders");
  return (
    <Badge variant={VARIANT[status]} appearance="outline" dot className="whitespace-nowrap">
      {t(`status.${status}`)}
    </Badge>
  );
}
