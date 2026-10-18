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

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const t = useTranslations("dashReservations");
  return <Badge variant={VARIANT[status]}>{t(`status.${status}`)}</Badge>;
}
