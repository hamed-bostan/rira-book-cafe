import { useTranslations } from "next-intl";

import type { ExpenseStatus } from "@/src/domain/entities/Expense";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

/** Owed asks for paying, paid is settled, void steps back. */
const VARIANT = { unpaid: "warning", paid: "success", void: "neutral" } as const;

type ExpenseStatusBadgeProps = {
  status: ExpenseStatus;
  /** Beside a page's title: the 24px pill, with no dot to line up down a column. */
  standalone?: boolean;
};

/** Owed / Paid / Void. */
export function ExpenseStatusBadge({ status, standalone = false }: ExpenseStatusBadgeProps) {
  const t = useTranslations("dashExpenses");
  return (
    <Badge variant={VARIANT[status]} appearance="outline" size={standalone ? "compact" : "sm"} dot={!standalone}>
      {t(`status.${status}`)}
    </Badge>
  );
}
