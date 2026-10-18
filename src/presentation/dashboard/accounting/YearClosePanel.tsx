"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { FiscalYearStatus } from "@/src/domain/use-cases/accounting/FiscalYearClose";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { fiscalYearsApi } from "@/src/presentation/dashboard/inventory/inventory-api";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

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
    <section className="flex max-w-xl flex-col gap-3 rounded-card-lg border border-border bg-background p-4 md:p-6">
      <div>
        <h2 className="text-body-lead text-foreground">{t("yearClose.heading")}</h2>
        <p className="text-body-small text-muted-foreground">{t("yearClose.description")}</p>
      </div>
      <ul className="divide-y divide-border">
        {years.map((year) => (
          <li key={year.year} className="flex flex-wrap items-center gap-3 py-3">
            <span className="text-body-small-emphasis text-foreground">
              {t("yearClose.year", { year: formatYear(year.year, locale) })}
            </span>
            <span className="text-body-caption text-muted-foreground">
              {formatCafeDayMedium(year.fromDay, locale)} – {formatCafeDayMedium(year.toDay, locale)}
            </span>
            <span className="ms-auto flex items-center gap-2">
              {year.closed ? (
                <Badge size="sm" variant="success">
                  {t("yearClose.closed")}
                </Badge>
              ) : !year.ended ? (
                <Badge size="sm" variant="neutral">
                  {t("yearClose.open")}
                </Badge>
              ) : canWrite ? (
                <Button
                  type="button"
                  size="sm"
                  loading={pending && running === year.year}
                  disabled={pending}
                  onClick={() => setClosing(year.year)}
                >
                  {t("yearClose.close")}
                </Button>
              ) : (
                <Badge size="sm" variant="warning">
                  {t("yearClose.toClose")}
                </Badge>
              )}
            </span>
          </li>
        ))}
      </ul>
      <ConfirmSheet
        open={closing !== null}
        onOpenChange={(open) => !open && setClosing(null)}
        title={closing === null ? "" : t("yearClose.confirmTitle", { year: formatYear(closing, locale) })}
        message={t("yearClose.confirmMessage")}
        confirmLabel={t("yearClose.close")}
        onConfirm={() => {
          if (closing !== null) close(closing);
          setClosing(null);
        }}
      />
    </section>
  );
}
