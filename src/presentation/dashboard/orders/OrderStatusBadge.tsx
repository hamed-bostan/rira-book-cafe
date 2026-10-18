import { useTranslations } from "next-intl";

import type { OrderStatus } from "@/src/domain/entities/Order";
import { Badge, type BadgeProps } from "@/src/presentation/design-system/components/Badge/Badge";

/**
 * Colour by urgency, not by step: what needs someone's attention now (pending) is
 * loud, work in hand is calm, finished is quiet.
 */
const VARIANT: Record<OrderStatus, NonNullable<BadgeProps["variant"]>> = {
  pending: "warning",
  accepted: "info",
  preparing: "info",
  ready: "success",
  completed: "neutral",
  cancelled: "destructive",
};

/** An order's status as a coloured pill. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations("dashOrders");
  return <Badge variant={VARIANT[status]}>{t(`status.${status}`)}</Badge>;
}
