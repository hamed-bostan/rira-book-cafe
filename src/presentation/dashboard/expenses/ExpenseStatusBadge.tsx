import { useTranslations } from "next-intl";

import type { ExpenseStatus } from "@/src/domain/entities/Expense";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

/** Owed asks for paying, paid is settled, void steps back. */
const VARIANT = { unpaid: "warning", paid: "success", void: "neutral" } as const;

/** Owed / Paid / Void. */
export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const t = useTranslations("dashExpenses");
  return (
    <Badge variant={VARIANT[status]} appearance="outline" dot>
      {t(`status.${status}`)}
    </Badge>
  );
}
