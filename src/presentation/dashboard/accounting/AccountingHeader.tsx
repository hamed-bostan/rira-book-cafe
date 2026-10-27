import { getTranslations } from "next-intl/server";

import type { Account } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { DashboardLinkTabs } from "../DashboardLinkTabs";

import { NewManualEntryButton } from "./NewManualEntryButton";

export type AccountingTab = "overview" | "journal" | "accounts" | "statements" | "bank" | "settings";

const TABS: readonly { tab: AccountingTab; href: string }[] = [
  { tab: "overview", href: "/dashboard/accounting" },
  { tab: "journal", href: "/dashboard/accounting/journal" },
  { tab: "accounts", href: "/dashboard/accounting/accounts" },
  { tab: "statements", href: "/dashboard/accounting/statements" },
  { tab: "bank", href: "/dashboard/accounting/bank" },
  { tab: "settings", href: "/dashboard/accounting/settings" },
];

type AccountingHeaderProps = {
  active: AccountingTab;
  /** A line under the tabs saying what this tab holds. The overview has none — the heading says it. */
  intro?: string;
  /**
   * What the header's "New manual entry" needs, for a viewer who can write to the
   * books; `null` for one who can't, and the header offers no actions.
   */
  writer: { accounts: readonly Account[]; today: string } | null;
};

/**
 * The top of every Accounting tab: the heading with what the books are, the two
 * things you come here to do — post a manual entry, record an expense — and the
 * tabs. The same on each tab, so switching tabs only changes what's under it.
 */
export async function AccountingHeader({ active, intro, writer }: AccountingHeaderProps) {
  const t = await getTranslations("dashAccounting");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("subtitle")}</p>
        </div>
        {writer ? (
          <div className="flex flex-wrap gap-2">
            <NewManualEntryButton accounts={writer.accounts} today={writer.today} />
            <Button size="control-md" asChild className="px-4">
              <Link href="/dashboard/expenses/new">{t("overview.recordExpense")}</Link>
            </Button>
          </div>
        ) : null}
      </div>

      <DashboardLinkTabs
        label={t("tabsLabel")}
        current={active}
        tabs={TABS.map(({ tab, href }) => ({ key: tab, label: t(`tab.${tab}`), href }))}
      />

      {intro ? <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{intro}</p> : null}
    </>
  );
}
