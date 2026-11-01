import { Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { INCOME_STATUSES, isIncomeTarget, type IncomeStatus } from "@/src/domain/entities/Income";
import type { Account } from "@/src/domain/entities/Ledger";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { moneyUnit } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { accountName } from "@/src/presentation/dashboard/accounting/accounting-format";
import { ListPager, ListSearchInput } from "@/src/presentation/dashboard/list";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { DashboardLinkTabs } from "../DashboardLinkTabs";
import { formatPersianMonth } from "../expenses/expenseFormat";
import { MetricCard } from "../MetricCard";
import { PAGE_CARD, ROW_CAPTION, ROW_TEXT } from "../pageStyles";

import { RecordIncomeButton } from "./RecordIncomeButton";
import { VoidIncomeButton } from "./VoidIncomeButton";

import type { IncomePageWire } from "./income-response-schema";

/** The tabs along the top of the list: everything, or one status. */
const INCOME_TABS = ["all", ...INCOME_STATUSES] as const;
type IncomeTab = (typeof INCOME_TABS)[number];

type IncomeScreenProps = {
  page: IncomePageWire;
  accounts: Account[];
  status: IncomeStatus | undefined;
  query: string | undefined;
  /** Today on the cafe calendar. */
  today: string;
  /** VAT included in prices, in basis points. */
  vatRateBps: number;
  canWrite: boolean;
};

/**
 * Money in outside orders: what came in this month, then every entry in All /
 * Received / Void tabs with a search. Sales through orders aren't here; they post
 * themselves. Presentational: the page fetches over the REST API (BFF); the tab and
 * search live in the URL, and every write `router.refresh()`es.
 */
export async function IncomeScreen({ page, accounts, status, query, today, vatRateBps, canWrite }: IncomeScreenProps) {
  const t = await getTranslations("dashIncome");
  const locale = await getLocale();

  const { summary } = page;
  const accountsByCode = new Map(accounts.map((account) => [account.code, account]));
  const current: IncomeTab = status ?? "all";
  const countOf = (tab: IncomeTab): number =>
    tab === "all" ? summary.counts.received + summary.counts.void : summary.counts[tab];
  const hrefFor = (tab: IncomeTab): string => {
    const params = new URLSearchParams();
    if (tab !== "all") params.set("status", tab);
    if (query) params.set("q", query);
    const qs = params.toString();
    return qs ? `/dashboard/income?${qs}` : "/dashboard/income";
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("subtitle")}</p>
        </div>
        {canWrite ? (
          <RecordIncomeButton
            accounts={accounts.filter((account) => account.isActive && isIncomeTarget(account))}
            today={today}
            vatRateBps={vatRateBps}
          />
        ) : null}
      </div>

      <MetricCard
        label={t("monthLabel", { month: formatPersianMonth(summary.month.fromDay, locale) })}
        icon={Wallet}
        value={formatNumber(summary.month.total, locale)}
        unit={moneyUnit(locale)}
        hint={t("monthHint", { count: summary.month.count, formatted: formatNumber(summary.month.count, locale) })}
      />

      <section aria-label={t("listLabel")} className={PAGE_CARD}>
        <DashboardLinkTabs
          className="px-4"
          label={t("tabsLabel")}
          current={current}
          tabs={INCOME_TABS.map((tab) => ({
            key: tab,
            label: tab === "all" ? t("tabAll") : t(`status.${tab}`),
            count: countOf(tab),
            href: hrefFor(tab),
          }))}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3">
          <ListSearchInput
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            className="min-w-0 flex-[1_1_15rem] sm:max-w-md"
          />
        </div>

        {page.items.length === 0 ? (
          <DashboardEmptyState
            title={countOf("all") > 0 ? t("noMatchesTitle") : t("emptyTitle")}
            body={countOf("all") > 0 ? t("noMatchesBody") : t("emptyBody")}
          />
        ) : (
          <ul>
            {page.items.map((income) => {
              const account = accountsByCode.get(income.accountCode);
              const isVoid = income.status === "void";
              return (
                <li
                  key={income.id}
                  className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border px-5 py-3 last:border-b-0"
                >
                  <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-0.5">
                    <span dir="auto" className={cn(ROW_TEXT, "font-medium [overflow-wrap:anywhere] text-foreground")}>
                      {income.description}
                    </span>
                    <span className={cn(ROW_CAPTION, "tabular-nums")}>
                      {[
                        `IN-${income.number}`,
                        formatCafeDayShort(income.date, locale),
                        income.payerName,
                        account ? accountName(account, locale) : income.accountCode,
                        t(`method.${income.method}`),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  {isVoid ? (
                    <Badge variant="neutral" appearance="outline" size="compact">
                      {t("status.void")}
                    </Badge>
                  ) : null}
                  <span
                    className={cn(
                      ROW_TEXT,
                      "font-semibold whitespace-nowrap tabular-nums",
                      isVoid ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    {formatNumber(income.amount, locale)}
                  </span>
                  {canWrite && !isVoid ? <VoidIncomeButton income={income} /> : null}
                </li>
              );
            })}
          </ul>
        )}
        <ListPager page={page} />
      </section>
    </div>
  );
}
