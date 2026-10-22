import { getLocale } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

export type DashboardLinkTab = {
  key: string;
  label: string;
  count: number;
  href: string;
};

type DashboardLinkTabsProps = {
  tabs: readonly DashboardLinkTab[];
  /** The `key` of the tab on screen. */
  current: string;
  /** Names the tab row for assistive tech ("Filter by status"). */
  label: string;
  className?: string;
};

/**
 * A row of underlined tabs, each with its count — the filter along the top of a
 * dashboard list. Plain links rather than a client widget: a tab is a URL, so it
 * can be bookmarked, and switching re-runs the server render like any filter.
 */
export async function DashboardLinkTabs({ tabs, current, label, className }: DashboardLinkTabsProps) {
  const locale = await getLocale();

  return (
    <nav
      aria-label={label}
      className={cn("scrollbar-hide flex gap-6 overflow-x-auto border-b border-border", className)}
    >
      {tabs.map((tab) => {
        const selected = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              // Equal top and bottom borders keep the label centred while only the
              // bottom one is ever coloured.
              "flex h-12 shrink-0 items-center gap-2 border-y-2 border-t-transparent text-body-default whitespace-nowrap transition-colors sm:text-body-small",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
              selected
                ? "border-b-primary font-semibold text-foreground"
                : "border-b-transparent font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "inline-flex h-5 min-w-6 items-center justify-center rounded-badge-md px-1.5 text-body-caption-bold tabular-nums",
                selected ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {formatNumber(tab.count, locale)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
