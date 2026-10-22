import { useTranslations } from "next-intl";

import type { ReservationStatus } from "@/src/domain/entities/Reservation";
import { Badge, type BadgeProps } from "@/src/presentation/design-system/components/Badge/Badge";

/** Loud for what needs an answer (requested), calm for what's settled, quiet when done. */
const VARIANT: Record<ReservationStatus, NonNullable<BadgeProps["variant"]>> = {
  requested: "warning",
  confirmed: "info",
  seated: "success",
  completed: "neutral",
  cancelled: "destructive",
  noShow: "error",
};

type ReservationStatusBadgeProps = {
  status: ReservationStatus;
  /**
   * The dashboard's look: a tinted pill with a border and a leading dot, a
   * cancellation as quiet as a finished booking. The guest's own list keeps the
   * plain pill.
   */
  outlined?: boolean;
};

export function ReservationStatusBadge({ status, outlined = false }: ReservationStatusBadgeProps) {
  const t = useTranslations("dashReservations");
  return outlined ? (
    <Badge variant={status === "cancelled" ? "neutral" : VARIANT[status]} appearance="outline" dot>
      {t(`status.${status}`)}
    </Badge>
  ) : (
    <Badge variant={VARIANT[status]}>{t(`status.${status}`)}</Badge>
  );
}
