import { useTranslations } from "next-intl";

import type { BookLoanStatus } from "@/src/domain/entities/BookLoan";
import { Badge, type BadgeProps } from "@/src/presentation/design-system/components/Badge/Badge";

type BookLoanStatusBadgeProps = {
  status: BookLoanStatus;
  /** Still out and past due — shown in place of the plain "out" badge. */
  overdue?: boolean;
  /**
   * The dashboard's look: a tinted pill with a border and a leading dot, a lost
   * book red rather than solid. The guest's own list keeps the plain pill.
   */
  outlined?: boolean;
};

const VARIANT: Record<BookLoanStatus, NonNullable<BadgeProps["variant"]>> = {
  out: "info",
  returned: "neutral",
  lost: "destructive",
};

/** Loud when a book is late or gone, calm while it's out on time, quiet once it's back. */
export function BookLoanStatusBadge({ status, overdue = false, outlined = false }: BookLoanStatusBadgeProps) {
  const t = useTranslations("dashBookLoans");
  const label = overdue ? t("overdue") : t(`status.${status}`);
  if (outlined) {
    const variant = overdue ? "warning" : status === "lost" ? "error" : VARIANT[status];
    return (
      <Badge variant={variant} appearance="outline" dot>
        {label}
      </Badge>
    );
  }
  return <Badge variant={overdue ? "warning" : VARIANT[status]}>{label}</Badge>;
}
