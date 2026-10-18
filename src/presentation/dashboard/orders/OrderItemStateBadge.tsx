import { useTranslations } from "next-intl";

import { itemServiceState, type OrderItem, type OrderItemServiceState } from "@/src/domain/entities/Order";
import { Badge, type BadgeProps } from "@/src/presentation/design-system/components/Badge/Badge";

const VARIANT: Record<OrderItemServiceState, NonNullable<BadgeProps["variant"]>> = {
  preparing: "warning",
  served: "success",
};

/** One line's place on the floor — still being made, or already with the guest. */
export function OrderItemStateBadge({ item }: { item: Pick<OrderItem, "servedAt"> }) {
  const t = useTranslations("dashOrders");
  const state = itemServiceState(item);
  return (
    <Badge variant={VARIANT[state]} appearance="outline">
      {t(`itemState.${state}`)}
    </Badge>
  );
}
