import { getTranslations } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";
import { RESULTS_PERIODS, type ResultsPeriod } from "@/src/lib/api/accounting-period-params";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

/**
 * This month / Last month / This year over the overview's results. Each is a
 * link, so the period is in the URL and switching re-reads the books on the server.
 */
export async function ResultsPeriodSwitch({ current }: { current: ResultsPeriod }) {
  const t = await getTranslations("dashAccounting");

  return (
    <nav aria-label={t("overview.periodLabel")} className="flex shrink-0 rounded-button bg-muted p-0.5">
      {RESULTS_PERIODS.map((period) => {
        const selected = period === current;
        return (
          <Link
            key={period}
            href={period === "month" ? "/dashboard/accounting" : `/dashboard/accounting?period=${period}`}
            scroll={false}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "flex h-11 items-center rounded-button px-3 text-body-default whitespace-nowrap transition-colors sm:h-8 sm:text-body-small",
              focusRing,
              selected
                ? "bg-background font-semibold text-foreground shadow-xs"
                : "font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`overview.period.${period}`)}
          </Link>
        );
      })}
    </nav>
  );
}
