import { Plus, Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { payRunOwed, payRunTotals, type PayRun } from "@/src/domain/entities/Payroll";
import { Link } from "@/src/i18n/navigation";
import { formatMoney, moneyUnit } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { ExpenseStatusBadge } from "../expenses/ExpenseStatusBadge";
import { MetricCard } from "../MetricCard";
import { AMOUNT, PAGE_CARD, ROW_CAPTION, ROW_TEXT } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { formatPayPeriod } from "./payrollFormat";

/** Each month's pay, newest first, and what's still owed to the staff. Presentational: the page reads it over the BFF. */
export async function PayrollScreen({ runs }: { runs: PayRun[] }) {
  const t = await getTranslations("dashPayroll");
  const locale = await getLocale();
  const owing = runs.filter((run) => payRunOwed(run) > 0);
  const owed = owing.reduce((sum, run) => sum + payRunOwed(run), 0);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("heading")} />
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="control-md" asChild variant="secondary" className="px-3">
            <Link href="/dashboard/payroll/employees">{t("employees")}</Link>
          </Button>
          <Button size="control-md" asChild className="gap-2 px-4">
            <Link href="/dashboard/payroll/new">
              <Icon icon={Plus} size="sm" strokeWidth={2} />
              {t("new")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetricCard
          label={t("owed")}
          icon={Wallet}
          value={formatNumber(owed, locale)}
          unit={moneyUnit(locale)}
          hint={
            owing.length > 0
              ? t("owedHint", { count: owing.length, formatted: formatNumber(owing.length, locale) })
              : t("owedNone")
          }
          hintTone={owing.length > 0 ? "warning" : undefined}
          hintDot={owing.length > 0}
        />
      </div>

      <section aria-label={t("listLabel")} className={cn(PAGE_CARD, ROW_TEXT, "overflow-hidden")}>
        {runs.length === 0 ? (
          <DashboardEmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        ) : (
          <ul className="divide-y divide-border">
            {runs.map((run) => {
              const totals = payRunTotals(run.lines);
              const month = formatPayPeriod(run.period, locale);
              return (
                <li key={run.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                  <span className="flex min-w-48 flex-1 flex-col gap-0.5">
                    <Link
                      href={`/dashboard/payroll/${run.id}`}
                      aria-label={t("openRun", { month })}
                      className="-my-3 w-fit py-3 font-semibold text-foreground transition-colors hover:text-primary sm:my-0 sm:py-0"
                    >
                      {month}
                    </Link>
                    <span className={ROW_CAPTION}>
                      {t("peopleCount", {
                        count: run.lines.length,
                        formatted: formatNumber(run.lines.length, locale),
                      })}
                    </span>
                  </span>
                  <ExpenseStatusBadge status={run.status} />
                  <span className="flex min-w-36 flex-col items-end gap-0.5">
                    <span className={cn(AMOUNT, "font-semibold text-foreground")}>
                      {formatMoney(totals.net, locale)}
                    </span>
                    <span className={ROW_CAPTION}>{t("col.net")}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
