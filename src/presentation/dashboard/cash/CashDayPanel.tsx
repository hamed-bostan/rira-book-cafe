import { getLocale, getTranslations } from "next-intl/server";

import { CASH_GROUPS, type CashDayFigures } from "@/src/domain/entities/CashClose";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";

/**
 * The manager's side of the Z-report: what the till started with, how cash moved
 * during the day (by kind, then line by line) and what the count should find.
 */
export async function CashDayPanel({ figures }: { figures: CashDayFigures }) {
  const t = await getTranslations("dashCash");
  const tAccounting = await getTranslations("dashAccounting");
  const locale = await getLocale();
  const signed = (amount: number): string => (amount > 0 ? `+${formatMoney(amount, locale)}` : formatMoney(amount, locale));

  return (
    <section className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 md:p-6">
      <h2 className="text-body-lead text-foreground">{t("day.heading")}</h2>
      <dl className="flex flex-col divide-y divide-border text-body-small">
        <div className="flex items-center justify-between gap-3 py-2">
          <dt className="text-muted-foreground">{t("day.openingFloat")}</dt>
          <dd className="text-foreground">{formatMoney(figures.openingFloat, locale)}</dd>
        </div>
        {CASH_GROUPS.map((group) =>
          figures.breakdown[group] !== 0 ? (
            <div key={group} className="flex items-center justify-between gap-3 py-2">
              <dt className="text-muted-foreground">{t(`group.${group}`)}</dt>
              <dd className={cn(figures.breakdown[group] < 0 ? "text-error-foreground" : "text-success-foreground")}>{signed(figures.breakdown[group])}</dd>
            </div>
          ) : null,
        )}
        <div className="flex items-center justify-between gap-3 py-2">
          <dt className="text-body-small-emphasis text-foreground">{t("day.expected")}</dt>
          <dd className="text-body-strong text-foreground">{formatMoney(figures.expected, locale)}</dd>
        </div>
      </dl>

      {figures.lines.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-body-small-emphasis text-primary">{t("day.lines", { count: figures.lines.length })}</summary>
          <ul className="mt-2 divide-y divide-border text-body-small">
            {figures.lines.map((line, index) => (
              <li key={`${line.entryId}-${index}`} className="flex items-center gap-3 py-2">
                <Link href={`/dashboard/accounting/journal/${line.entryId}`} className="shrink-0 text-primary underline-offset-4 hover:underline">
                  JE-{line.number}
                </Link>
                <span className="min-w-0 flex-1 truncate text-foreground" dir="auto">
                  {line.description}
                </span>
                <span className="hidden text-body-caption text-muted-foreground sm:inline">{tAccounting(`source.${line.source}`)}</span>
                <span className={cn("shrink-0", line.credit > 0 ? "text-error-foreground" : "text-success-foreground")}>{signed(line.debit - line.credit)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="text-body-small text-muted-foreground">{t("day.noLines")}</p>
      )}
    </section>
  );
}
