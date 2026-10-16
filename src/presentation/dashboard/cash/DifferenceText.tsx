import { useLocale, useTranslations } from "next-intl";

import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";

/** A till difference in words and colour: exact, over (counted more) or short (counted less). */
export function DifferenceText({ difference, className }: { difference: number; className?: string }) {
  const t = useTranslations("dashCash");
  const locale = useLocale();
  if (difference === 0) return <span className={cn("text-success-foreground", className)}>{t("difference.exact")}</span>;
  return (
    <span className={cn(difference < 0 ? "text-error-foreground" : "text-warning-foreground", className)}>
      {difference < 0 ? t("difference.short", { amount: formatMoney(-difference, locale) }) : t("difference.over", { amount: formatMoney(difference, locale) })}
    </span>
  );
}
