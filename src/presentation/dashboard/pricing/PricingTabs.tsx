import { getTranslations } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system";

export type PricingTab = "items" | "ingredients" | "settings";

const TABS: readonly { tab: PricingTab; href: string }[] = [
  { tab: "items", href: "/dashboard/pricing" },
  { tab: "ingredients", href: "/dashboard/pricing/ingredients" },
  { tab: "settings", href: "/dashboard/pricing/settings" },
];

/** The page heading and the pricing section's tabs. */
export async function PricingTabs({ active, title, subtitle }: { active: PricingTab; title: string; subtitle?: string }) {
  const t = await getTranslations("dashPricing");

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
