import { useTranslations } from "next-intl";

import type { ExpenseStatus } from "@/src/domain/entities/Expense";
import { Badge } from "@/src/presentation/design-system";

const VARIANT = { unpaid: "warning", paid: "success", void: "neutral" } as const;

/** Owed / paid / void. */
export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const t = useTranslations("dashExpenses");
  return (
    <Badge size="sm" variant={VARIANT[status]}>
      {t(`status.${status}`)}
    </Badge>
  );
}
