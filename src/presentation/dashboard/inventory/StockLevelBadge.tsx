import { useTranslations } from "next-intl";

import type { StockLevel } from "@/src/domain/entities/Inventory";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

const VARIANT = { out: "error", low: "warning" } as const;

/**
 * Out (red) or running low (amber), beside an item's name — the at-a-glance
 * signal of what to order. An item that's fine carries no badge.
 */
export function StockLevelBadge({ level }: { level: Exclude<StockLevel, "ok"> }) {
  const t = useTranslations("dashInventory");
  return (
    <Badge variant={VARIANT[level]} appearance="outline" size="compact" dot>
      {t(`level.${level}`)}
    </Badge>
  );
}
