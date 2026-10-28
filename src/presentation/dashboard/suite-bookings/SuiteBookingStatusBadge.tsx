import { useTranslations } from "next-intl";

import type { SuiteBookingStatus } from "@/src/domain/entities/SuiteBooking";
import { Badge, type BadgeProps } from "@/src/presentation/design-system/components/Badge/Badge";

/** Loud for what needs an answer (requested), calm for what's settled, quiet when done. */
const VARIANT: Record<SuiteBookingStatus, NonNullable<BadgeProps["variant"]>> = {
  requested: "warning",
  confirmed: "info",
  checkedIn: "success",
  checkedOut: "neutral",
  cancelled: "destructive",
  noShow: "error",
};

type SuiteBookingStatusBadgeProps = {
  status: SuiteBookingStatus;
  /**
   * The dashboard's look: a 24px tinted pill with a border and a leading dot, a
   * cancellation as quiet as a finished stay. The guest's own page keeps the
   * plain pill.
   */
  outlined?: boolean;
};

export function SuiteBookingStatusBadge({ status, outlined = false }: SuiteBookingStatusBadgeProps) {
  const t = useTranslations("dashSuite");
  return outlined ? (
    <Badge variant={status === "cancelled" ? "neutral" : VARIANT[status]} appearance="outline" size="compact" dot>
      {t(`status.${status}`)}
    </Badge>
  ) : (
    <Badge variant={VARIANT[status]}>{t(`status.${status}`)}</Badge>
  );
}
