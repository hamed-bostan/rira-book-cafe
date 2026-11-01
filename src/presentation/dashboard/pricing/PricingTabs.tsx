import { getTranslations } from "next-intl/server";

import { DashboardLinkTabs } from "../DashboardLinkTabs";

export type PricingTab = "items" | "ingredients" | "settings";

const TABS: readonly { tab: PricingTab; href: string }[] = [
  { tab: "items", href: "/dashboard/pricing" },
  { tab: "ingredients", href: "/dashboard/pricing/ingredients" },
  { tab: "settings", href: "/dashboard/pricing/settings" },
];

/** The page heading and the pricing section's tabs. */
export async function PricingTabs({
  active,
  title,
  subtitle,
}: {
  active: PricingTab;
  title: string;
  subtitle?: string;
}) {
  const t = await getTranslations("dashPricing");

  return (
    <>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="dashboard-page-title">{title}</h1>
        {subtitle ? (
          <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{subtitle}</p>
        ) : null}
      </div>
      <DashboardLinkTabs
        tabs={TABS.map(({ tab, href }) => ({ key: tab, label: t(`tab.${tab}`), href }))}
        current={active}
        label={t("tabsLabel")}
      />
    </>
  );
}
