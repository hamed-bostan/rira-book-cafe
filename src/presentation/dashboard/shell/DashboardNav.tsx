"use client";

import { useLocale, useTranslations } from "next-intl";

import type { Permission } from "@/src/domain/entities/Permission";
import { Link, usePathname } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { isSectionActive, navGroupsFor, type DashboardNavBadges } from "./sections";

type DashboardNavProps = {
  /** What the viewer may do — decides which sections are offered. */
  permissions: readonly Permission[];
  /**
   * Icons only, for the collapsed desktop rail. The label stays in the accessible
   * name (and the native tooltip) rather than being dropped, so a narrow rail is
   * still navigable by screen reader and hover.
   */
  collapsed?: boolean;
  /** Called after a link is chosen — the drawer uses it to close itself. */
  onNavigate?: () => void;
  /** Counts beside some links — the orders waiting in the queue. Zero shows nothing. */
  badges?: DashboardNavBadges;
};

/**
 * The dashboard's section links, grouped and with the current section filled in.
 *
 * Shared by the desktop rail and the mobile drawer: both render this, so the two
 * can't drift apart. It owns no layout of its own beyond the list — the container
 * decides how wide it is and where it sits.
 */
export function DashboardNav({ permissions, badges, collapsed = false, onNavigate }: DashboardNavProps) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const pathname = usePathname();
  const groups = navGroupsFor(permissions);

  return (
    <nav className={cn("flex flex-col", collapsed ? "gap-2" : "gap-5")}>
      {groups.map((group, index) => (
        <div key={group.id} className="flex flex-col gap-0.5">
          {/* The first group is a single item (the overview) and needs no heading;
              every later group gets one. A collapsed rail swaps the wording for a
              rule — at 40px there is nowhere to put it, and the grouping still
              reads as grouping. */}
          {index > 0 &&
            (collapsed ? (
              <hr className="mb-2 border-border" />
            ) : (
              <p className="px-3 pt-1 pb-2 text-body-caption-bold tracking-wider text-muted-foreground uppercase">
                {t(group.id)}
              </p>
            ))}

          {group.sections.map((section) => {
            const active = isSectionActive(section.href, pathname);
            const label = t(section.labelKey);
            const badge = badges?.[section.labelKey];

            return (
              <Link
                key={section.href}
                href={section.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-button text-body-default transition-colors sm:text-body-small",
                  focusRing,
                  collapsed ? "size-11 shrink-0 justify-center self-center p-0" : "h-11 px-3 sm:h-10",
                  active
                    ? "bg-accent font-semibold text-accent-foreground [&>svg]:text-primary"
                    : "font-medium text-foreground/80 hover:bg-muted hover:text-foreground [&>svg]:text-muted-foreground",
                )}
              >
                <Icon icon={section.icon} size="md" className="sm:size-5" />
                <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>{label}</span>
                {badge ? (
                  collapsed ? (
                    // No room for a number on the rail: a dot says "something's waiting".
                    <span aria-hidden className="absolute end-2 top-2 size-2 rounded-full bg-primary" />
                  ) : (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-badge-md bg-primary px-1.5 text-body-caption-bold text-primary-foreground tabular-nums">
                      {formatNumber(badge, locale)}
                    </span>
                  )
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
