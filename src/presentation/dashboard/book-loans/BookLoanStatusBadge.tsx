import { useTranslations } from "next-intl";

import type { BookLoanStatus } from "@/src/domain/entities/BookLoan";
import { Badge, type BadgeProps } from "@/src/presentation/design-system/components/Badge/Badge";

type BookLoanStatusBadgeProps = {
  status: BookLoanStatus;
  /** Still out and past due — shown in place of the plain "out" badge. */
  overdue?: boolean;
};

const VARIANT: Record<BookLoanStatus, NonNullable<BadgeProps["variant"]>> = {
  out: "info",
  returned: "neutral",
  lost: "destructive",
};

/** Loud when a book is late or gone, calm while it's out on time, quiet once it's back. */
export function BookLoanStatusBadge({ status, overdue = false }: BookLoanStatusBadgeProps) {
  const t = useTranslations("dashBookLoans");
  if (overdue) return <Badge variant="warning">{t("overdue")}</Badge>;
  return <Badge variant={VARIANT[status]}>{t(`status.${status}`)}</Badge>;
}
