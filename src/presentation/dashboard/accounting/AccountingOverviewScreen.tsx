import { Banknote, CircleAlert, CircleCheck, Globe, HandCoins, Landmark, Lock, Percent, Truck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { ProfitAndLoss, TrialBalance } from "@/src/domain/entities/AccountingReports";
import { SYSTEM_ACCOUNTS, type AccountingSettings } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { Button } from "@/src/presentation/design-system";

import { StatCard } from "../StatCard";

import { AccountingTabs } from "./AccountingTabs";
import { GatewaySettlementForm } from "./GatewaySettlementForm";
import { PeriodPicker } from "./PeriodPicker";

type AccountingOverviewScreenProps = {
  /** Balances as of today. */
  trialBalance: TrialBalance;
  /** The selected period's results (default: this Persian month). */
  profitAndLoss: ProfitAndLoss;
  settings: AccountingSettings;
  canWrite: boolean;
  /** The cafe day today — the latest a payout can be dated. */
  today: string;
};

/** Where the money sits, as the books see it; liabilities read positive. */
const BALANCES = [
  { key: "cash", code: SYSTEM_ACCOUNTS.cash, icon: Banknote, tone: "brand" },
  { key: "bank", code: SYSTEM_ACCOUNTS.bank, icon: Landmark, tone: "brand" },
  { key: "gateway", code: SYSTEM_ACCOUNTS.gatewayClearing, icon: Globe, tone: "info" },
  { key: "receivables", code: SYSTEM_ACCOUNTS.guestReceivables, icon: HandCoins, tone: "info" },
  { key: "payables", code: SYSTEM_ACCOUNTS.accountsPayable, icon: Truck, tone: "warning" },
  { key: "vat", code: SYSTEM_ACCOUNTS.vatPayable, icon: Percent, tone: "warning" },
] as const;

/**
 * The books at a glance: today's balances in the money accounts and what's owed
 * either way, the period's profit, and whether the ledger balances.
 */
export async function AccountingOverviewScreen({ trialBalance, profitAndLoss, settings, canWrite, today }: AccountingOverviewScreenProps) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();
  const balanceOf = (code: string) => trialBalance.rows.find((row) => row.account.code === code)?.balance ?? 0;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AccountingTabs active="overview" title={t("heading")} subtitle={t("subtitle")} />

      <div
        className={
          trialBalance.balanced
            ? "flex items-center gap-2 rounded-card-md border border-border bg-surface px-4 py-3 text-body-small text-foreground"
            : "flex items-center gap-2 rounded-card-md border border-error-foreground bg-error px-4 py-3 text-body-small text-error-foreground"
        }
      >
        {trialBalance.balanced ? <CircleCheck className="size-4 shrink-0 text-success-foreground" aria-hidden /> : <CircleAlert className="size-4 shrink-0" aria-hidden />}
        <span>{trialBalance.balanced ? t("overview.balanced") : t("overview.unbalanced")}</span>
        <span className="ms-auto flex items-center gap-1.5 text-body-caption text-muted-foreground">
          <Lock className="size-3.5" aria-hidden />
          {settings.booksClosedThrough
            ? t("overview.closedThrough", { date: formatCafeDayMedium(settings.booksClosedThrough, locale) })
            : t("overview.noneClosed")}
        </span>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-body-lead text-foreground">{t("overview.balancesHeading")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {BALANCES.map(({ key, code, icon, tone }) => (
            <Link key={key} href={`/dashboard/accounting/accounts/${code}`} className="rounded-card-lg">
              <StatCard label={t(`overview.balance.${key}`)} value={formatMoney(balanceOf(code), locale)} icon={icon} tone={tone} />
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-card-lg border border-border bg-background p-4 md:p-6">
        <h2 className="text-body-lead text-foreground">{t("overview.resultsHeading")}</h2>
        <PeriodPicker fromDay={profitAndLoss.fromDay} toDay={profitAndLoss.toDay} />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 pt-2 md:grid-cols-4">
          {(
            [
              ["revenue", profitAndLoss.revenue.total],
              ["grossProfit", profitAndLoss.grossProfit],
              ["expenses", profitAndLoss.expenses.total],
              ["netProfit", profitAndLoss.netProfit],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="flex flex-col gap-1">
              <dt className="text-body-caption text-muted-foreground">{t(`overview.${key}`)}</dt>
              <dd className={value < 0 ? "text-body-strong text-error-foreground" : "text-body-strong text-foreground"}>{formatMoney(value, locale)}</dd>
            </div>
          ))}
        </dl>
        <Link
          href={`/dashboard/accounting/statements/profit-and-loss?from=${profitAndLoss.fromDay}&to=${profitAndLoss.toDay}`}
          className="text-body-small-emphasis text-primary underline-offset-4 hover:underline"
        >
          {t("overview.fullStatement")}
        </Link>
      </section>

      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard/expenses/new">{t("overview.recordExpense")}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/accounting/journal/new">{t("journal.newEntry")}</Link>
          </Button>
        </div>
      ) : null}

      {canWrite ? <GatewaySettlementForm today={today} /> : null}
    </div>
  );
}
