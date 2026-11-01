import { useTranslations } from "next-intl";

import { itemServiceState, type OrderItem, type OrderItemServiceState } from "@/src/domain/entities/Order";
import { Badge, type BadgeProps } from "@/src/presentation/design-system/components/Badge/Badge";

const VARIANT: Record<OrderItemServiceState, NonNullable<BadgeProps["variant"]>> = {
  preparing: "warning",
  served: "success",
};

type OrderItemStateBadgeProps = {
  item: Pick<OrderItem, "servedAt">;
  /** The dashboard's 20px tag; the guest's order page keeps the default. */
  dense?: boolean;
};

/** One line's place on the floor — still being made, or already with the guest. */
export function OrderItemStateBadge({ item, dense = false }: OrderItemStateBadgeProps) {
  const t = useTranslations("dashOrders");
  const state = itemServiceState(item);
  return (
    <Badge
      variant={VARIANT[state]}
      appearance="outline"
      size={dense ? "compact" : undefined}
      className={dense ? "h-5 px-1.5" : undefined}
    >
      {t(`itemState.${state}`)}
    </Badge>
  );
}
