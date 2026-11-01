"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { FiscalYearStatus } from "@/src/domain/use-cases/accounting/FiscalYearClose";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { cn } from "@/src/lib/utils";
import { fiscalYearsApi } from "@/src/presentation/dashboard/inventory/inventory-api";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardSection } from "../DashboardSection";
import { ROW_CAPTION } from "../pageStyles";

import { formatYear } from "./accounting-format";

/**
 * Persian fiscal years and their close. Closing a finished year moves its profit
 * into retained earnings and locks the books through its last day — the formal
 * end of the year, after the final count and adjustments.
 */
export function YearClosePanel({ years, canWrite }: { years: FiscalYearStatus[]; canWrite: boolean }) {
  const t = useTranslations("dashAccounting");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [closing, setClosing] = React.useState<number | null>(null);
  /** The year whose close is running — its button shows the spinner. */
  const [running, setRunning] = React.useState<number | null>(null);
  const [pending, startTransition] = React.useTransition();

  function close(year: number): void {
    setRunning(year);
    startTransition(async () => {
      try {
        await fiscalYearsApi.close(year);
        toast({ tone: "success", title: t("yearClose.closedToast", { year: formatYear(year, locale) }) });
        router.refresh();
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("yearClose.error")) });
      }
    });
  }

  return (
    <DashboardSection title={t("yearClose.heading")} description={t("yearClose.description")} flush>
      <ul>
        {years.map((year, index) => (
          <li
            key={year.year}
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4",
              index > 0 && "border-t border-border",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-semibold text-foreground">
                {t("yearClose.year", { year: formatYear(year.year, locale) })}
              </span>
              <span className={ROW_CAPTION}>
                {formatCafeDayMedium(year.fromDay, locale)} – {formatCafeDayMedium(year.toDay, locale)}
              </span>
            </span>
            {year.closed ? (
              <Badge size="compact" variant="success" appearance="outline">
                {t("yearClose.closed")}
              </Badge>
            ) : !year.ended ? (
              <Badge size="compact" variant="neutral" appearance="outline">
                {t("yearClose.open")}
              </Badge>
            ) : (
              <>
                <Badge size="compact" variant="warning" appearance="outline">
                  {t("yearClose.toClose")}
                </Badge>
                {canWrite ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="control-md"
                    className="px-3"
                    loading={pending && running === year.year}
                    disabled={pending}
                    onClick={() => setClosing(year.year)}
                  >
                    {t("yearClose.close")}
                  </Button>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>
      <DashboardDialog
        open={closing !== null}
        onOpenChange={(open) => !open && setClosing(null)}
        title={closing === null ? "" : t("yearClose.confirmTitle", { year: formatYear(closing, locale) })}
        subtitle={t("yearClose.confirmMessage")}
        submitLabel={t("yearClose.close")}
        pending={false}
        onSubmit={() => {
          if (closing !== null) close(closing);
          setClosing(null);
        }}
      />
    </DashboardSection>
  );
}
