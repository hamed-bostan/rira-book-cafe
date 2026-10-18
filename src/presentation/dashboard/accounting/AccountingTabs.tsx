import { getTranslations } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

export type AccountingTab = "overview" | "journal" | "accounts" | "statements" | "bank" | "settings";

const TABS: readonly { tab: AccountingTab; href: string }[] = [
  { tab: "overview", href: "/dashboard/accounting" },
  { tab: "journal", href: "/dashboard/accounting/journal" },
  { tab: "accounts", href: "/dashboard/accounting/accounts" },
  { tab: "statements", href: "/dashboard/accounting/statements" },
  { tab: "bank", href: "/dashboard/accounting/bank" },
  { tab: "settings", href: "/dashboard/accounting/settings" },
];

/** The page heading and the accounting section's tabs. */
export async function AccountingTabs({
  active,
  title,
  subtitle,
}: {
  active: AccountingTab;
  title: string;
  subtitle?: string;
}) {
  const t = await getTranslations("dashAccounting");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="dashboard-page-title">{title}</h1>
        {subtitle ? <p className="mt-1 text-body-small text-muted-foreground">{subtitle}</p> : null}
      </div>
      <nav aria-label={t("tabsLabel")} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map(({ tab, href }) => (
          <Link
            key={tab}
            href={href}
            aria-current={tab === active ? "page" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center rounded-full border px-4 text-button-default-medium transition-colors",
              focusRing,
              tab === active ? "border-primary bg-accent text-primary" : "border-border text-foreground hover:bg-muted",
            )}
          >
            {t(`tab.${tab}`)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
