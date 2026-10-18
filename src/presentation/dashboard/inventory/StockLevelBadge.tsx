import { useTranslations } from "next-intl";

import type { StockLevel } from "@/src/domain/entities/Inventory";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

const VARIANT = { out: "error", low: "warning", ok: "success" } as const;

/** Out (red), running low (warning) or fine — the at-a-glance stock signal. */
export function StockLevelBadge({ level }: { level: StockLevel }) {
  const t = useTranslations("dashInventory");
  return (
    <Badge size="sm" variant={VARIANT[level]} appearance="outline">
      {t(`level.${level}`)}
    </Badge>
  );
}
