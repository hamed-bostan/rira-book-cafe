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

export function SuiteBookingStatusBadge({ status }: { status: SuiteBookingStatus }) {
  const t = useTranslations("dashSuite");
  return <Badge variant={VARIANT[status]}>{t(`status.${status}`)}</Badge>;
}
