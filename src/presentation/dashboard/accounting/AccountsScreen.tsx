import { getLocale, getTranslations } from "next-intl/server";

import type { TrialBalance } from "@/src/domain/entities/AccountingReports";
import { ACCOUNT_TYPES, type Account } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { AccountActiveSwitch } from "./AccountActiveSwitch";
import { accountName } from "./accounting-format";
import { AccountingTabs } from "./AccountingTabs";
import { NewAccountButton } from "./NewAccountButton";

type AccountsScreenProps = {
  accounts: Account[];
  /** Today's balances. */
  trialBalance: TrialBalance;
  canWrite: boolean;
};

/** The chart of accounts by type, each with today's balance and a link to its ledger. */
export async function AccountsScreen({ accounts, trialBalance, canWrite }: AccountsScreenProps) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();
  const balances = new Map(trialBalance.rows.map((row) => [row.account.code, row.balance]));

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AccountingTabs active="accounts" title={t("accounts.heading")} subtitle={t("accounts.subtitle")} />
      {canWrite ? (
        <div>
          <NewAccountButton />
        </div>
      ) : null}

      {ACCOUNT_TYPES.map((type) => {
        const rows = accounts.filter((account) => account.type === type);
        if (rows.length === 0) return null;
        return (
          <section key={type} className="min-w-0 overflow-hidden rounded-card-lg border border-border bg-background">
            <h2 className="border-b border-border bg-surface px-4 py-3 text-body-small-emphasis text-foreground">
              {t(`accountType.${type}`)}
            </h2>
            <ul className="divide-y divide-border">
              {rows.map((account) => (
                <li key={account.code} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="w-12 shrink-0 font-mono text-body-small text-muted-foreground" dir="ltr">
                    {account.code}
                  </span>
                  <Link
                    href={`/dashboard/accounting/accounts/${account.code}`}
                    className="min-w-0 flex-1 truncate text-body-small-emphasis text-foreground underline-offset-4 hover:underline"
                  >
                    {accountName(account, locale)}
                  </Link>
                  {account.isSystem ? (
                    <Badge size="sm" variant="neutral">
                      {t("accounts.system")}
                    </Badge>
                  ) : null}
                  {!account.isActive ? (
                    <Badge size="sm" variant="warning">
                      {t("accounts.inactive")}
                    </Badge>
                  ) : null}
                  <span className="text-body-small-emphasis whitespace-nowrap text-foreground">
                    {formatMoney(balances.get(account.code) ?? 0, locale)}
                  </span>
                  {canWrite && !account.isSystem ? (
                    <AccountActiveSwitch code={account.code} isActive={account.isActive} />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
