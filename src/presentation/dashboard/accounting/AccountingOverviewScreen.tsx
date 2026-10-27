import { Banknote, CircleAlert, CircleCheck, Globe, HandCoins, Landmark, Lock, Percent, Truck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { ProfitAndLoss, TrialBalance } from "@/src/domain/entities/AccountingReports";
import { SYSTEM_ACCOUNTS, type Account, type AccountingSettings } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";
import type { ResultsPeriod } from "@/src/lib/api/accounting-period-params";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { moneyUnit } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

import { MetricCard } from "../MetricCard";

import { AccountingHeader } from "./AccountingHeader";
import { GatewaySettlementForm } from "./GatewaySettlementForm";
import { ResultsPeriodSwitch } from "./ResultsPeriodSwitch";

type AccountingOverviewScreenProps = {
  /** Balances as of today. */
  trialBalance: TrialBalance;
  /** The chosen period's results. */
  profitAndLoss: ProfitAndLoss;
  period: ResultsPeriod;
  settings: AccountingSettings;
  /** The chart of accounts, for a viewer who can write to the books; `null` otherwise. */
  accounts: Account[] | null;
  /** The cafe day today — the latest a payout or an entry can be dated. */
  today: string;
};

/** Where the money sits, as the books see it; liabilities read positive. Each card opens its account. */
const BALANCES = [
  { key: "cash", code: SYSTEM_ACCOUNTS.cash, icon: Banknote },
  { key: "bank", code: SYSTEM_ACCOUNTS.bank, icon: Landmark },
  { key: "gateway", code: SYSTEM_ACCOUNTS.gatewayClearing, icon: Globe },
  { key: "receivables", code: SYSTEM_ACCOUNTS.guestReceivables, icon: HandCoins },
  { key: "payables", code: SYSTEM_ACCOUNTS.accountsPayable, icon: Truck },
  { key: "vat", code: SYSTEM_ACCOUNTS.vatPayable, icon: Percent },
] as const;

/**
 * The books at a glance: whether the ledger balances and how far it's closed,
 * today's balances in the money accounts and what's owed either way, the
 * results for this month, last month or this year, and recording a gateway
 * payout. Presentational — the page reads the books over the REST API (BFF).
 */
export async function AccountingOverviewScreen({
  trialBalance,
  profitAndLoss,
  period,
  settings,
  accounts,
  today,
}: AccountingOverviewScreenProps) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();
  const balanceOf = (code: string): number => trialBalance.rows.find((row) => row.account.code === code)?.balance ?? 0;

  const results = [
    ["revenue", profitAndLoss.revenue.total],
    ["grossProfit", profitAndLoss.grossProfit],
    ["expenses", profitAndLoss.expenses.total],
    ["netProfit", profitAndLoss.netProfit],
  ] as const;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AccountingHeader active="overview" writer={accounts ? { accounts, today } : null} />

      <div
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-card-lg border px-4 py-3 shadow-xs",
          trialBalance.balanced
            ? "border-border bg-background text-foreground"
            : "border-error-border bg-error text-error-foreground",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 text-body-default sm:text-body-small">
          {trialBalance.balanced ? (
            <CircleCheck className="size-5 shrink-0 text-success-foreground sm:size-4" aria-hidden />
          ) : (
            <CircleAlert className="size-5 shrink-0 sm:size-4" aria-hidden />
          )}
          <span>{trialBalance.balanced ? t("overview.balanced") : t("overview.unbalanced")}</span>
        </span>
        <span className="ms-auto flex items-center gap-1.5 text-body-small text-muted-foreground sm:text-body-caption">
          <Lock className="size-4 shrink-0" aria-hidden />
          {settings.booksClosedThrough
            ? t("overview.closedThrough", { date: formatCafeDayMedium(settings.booksClosedThrough, locale) })
            : t("overview.noneClosed")}
        </span>
      </div>

      <section aria-labelledby="balances-heading" className="flex flex-col gap-3">
        <h2 id="balances-heading" className="text-body-strong text-foreground">
          {t("overview.balancesHeading")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BALANCES.map(({ key, code, icon }) => (
            <MetricCard
              key={key}
              label={t(`overview.balance.${key}`)}
              icon={icon}
              value={formatNumber(balanceOf(code), locale)}
              unit={moneyUnit(locale)}
              href={`/dashboard/accounting/accounts/${code}`}
            />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="results-heading"
        className="flex min-w-0 flex-col gap-5 rounded-card-lg border border-border bg-background p-5 shadow-xs"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="results-heading" className="text-body-strong text-foreground">
              {t("overview.resultsHeading")}
            </h2>
            <p className="text-body-small text-muted-foreground sm:text-body-caption">
              {t("period.caption", {
                from: formatCafeDayMedium(profitAndLoss.fromDay, locale),
                to: formatCafeDayMedium(profitAndLoss.toDay, locale),
              })}
            </p>
          </div>
          <ResultsPeriodSwitch current={period} />
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          {results.map(([key, value]) => (
            <div key={key} className="flex min-w-0 flex-col gap-1">
              <dt className="text-body-small text-muted-foreground sm:text-body-caption">{t(`overview.${key}`)}</dt>
              <dd
                className={cn(
                  "text-heading-subsection tracking-tight tabular-nums sm:text-heading-section",
                  value < 0 ? "text-error-foreground" : "text-foreground",
                )}
              >
                {formatNumber(value, locale)}
              </dd>
            </div>
          ))}
        </dl>
        <Link
          href={`/dashboard/accounting/statements/profit-and-loss?from=${profitAndLoss.fromDay}&to=${profitAndLoss.toDay}`}
          className="w-fit text-body-default font-medium text-primary underline-offset-4 hover:underline sm:text-body-small"
        >
          {t("overview.fullStatement")}
        </Link>
      </section>

      {accounts ? (
        <GatewaySettlementForm today={today} gatewayBalance={balanceOf(SYSTEM_ACCOUNTS.gatewayClearing)} />
      ) : null}
    </div>
  );
}
