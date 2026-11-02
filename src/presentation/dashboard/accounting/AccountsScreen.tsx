import { getLocale, getTranslations } from "next-intl/server";

import type { TrialBalance } from "@/src/domain/entities/AccountingReports";
import { ACCOUNT_TYPES, type Account } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { AMOUNT, GROUP_BAND, PAGE_CARD, ROW_CAPTION, ROW_END, ROW_TEXT } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { AccountActiveSwitch } from "./AccountActiveSwitch";
import { accountName } from "./accounting-format";
import { AccountingHeader } from "./AccountingHeader";
import { NewAccountButton } from "./NewAccountButton";

type AccountsScreenProps = {
  accounts: Account[];
  /** Today's balances. */
  trialBalance: TrialBalance;
  canWrite: boolean;
  /** Today on the cafe calendar — for the header's "New manual entry". */
  today: string;
};

/** The chart of accounts by type, each with today's balance and a link to its ledger. */
export async function AccountsScreen({ accounts, trialBalance, canWrite, today }: AccountsScreenProps) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();
  const balances = new Map(trialBalance.rows.map((row) => [row.account.code, row.balance]));

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("tab.accounts")} />
      <AccountingHeader
        active="accounts"
        subtitle={t("accounts.subtitle")}
        writer={canWrite ? { accounts, today } : null}
      />
      {canWrite ? (
        <div className="flex">
          <NewAccountButton />
        </div>
      ) : null}

      {ACCOUNT_TYPES.map((type) => {
        const rows = accounts.filter((account) => account.type === type);
        if (rows.length === 0) return null;
        return (
          <section
            key={type}
            aria-label={t(`accountType.${type}`)}
            className={cn(PAGE_CARD, "@container/accounts overflow-hidden")}
          >
            <h2 className={GROUP_BAND}>{t(`accountType.${type}`)}</h2>
            <ul className={ROW_TEXT}>
              {rows.map((account, index) => (
                <li
                  key={account.code}
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3",
                    index > 0 && "border-t border-border",
                  )}
                >
                  <span className={cn(ROW_CAPTION, "w-12 shrink-0 tabular-nums")} dir="ltr">
                    {account.code}
                  </span>
                  <Link
                    href={`/dashboard/accounting/accounts/${account.code}`}
                    className={cn(
                      "-my-3 min-w-0 flex-1 py-3 font-medium [overflow-wrap:anywhere] transition-colors hover:text-primary sm:my-0 sm:py-0 @xl/accounts:truncate",
                      account.isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {accountName(account, locale)}
                  </Link>
                  {/* On a narrow card the name keeps the first line, and the rest takes a line under it. */}
                  <span className="flex basis-full items-center gap-3 ps-15 @xl/accounts:contents">
                    {account.isSystem ? (
                      <Badge size="compact" variant="neutral" appearance="outline">
                        {t("accounts.system")}
                      </Badge>
                    ) : null}
                    {!account.isActive ? (
                      <Badge size="compact" variant="warning" appearance="outline">
                        {t("accounts.inactive")}
                      </Badge>
                    ) : null}
                    <span className={ROW_END}>
                      <span className={cn(AMOUNT, "min-w-32 font-semibold text-foreground")}>
                        {formatNumber(balances.get(account.code) ?? 0, locale)}
                      </span>
                      {canWrite && !account.isSystem ? (
                        <AccountActiveSwitch code={account.code} isActive={account.isActive} />
                      ) : null}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
