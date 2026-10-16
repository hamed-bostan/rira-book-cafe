"use client";

import { useTranslations } from "next-intl";

import type { Permission } from "@/src/domain/entities/Permission";
import { Link, usePathname } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Icon, focusRing } from "@/src/presentation/design-system";

import { isSectionActive, navGroupsFor } from "./sections";

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
};

/**
 * The dashboard's section links, grouped and with the current section filled in.
 *
 * Shared by the desktop rail and the mobile drawer: both render this, so the two
 * can't drift apart. It owns no layout of its own beyond the list — the container
 * decides how wide it is and where it sits.
 */
export function DashboardNav({ permissions, collapsed = false, onNavigate }: DashboardNavProps) {
  const t = useTranslations("dashboard");
  const pathname = usePathname();
  const groups = navGroupsFor(permissions);

  return (
    <nav className="flex flex-col gap-1">
      {groups.map((group, index) => (
        <div key={group.id} className="flex flex-col gap-1">
          {/* The first group is a single item (the overview) and needs no heading;
              every later group gets a rule to separate it from the one above. A
              collapsed rail keeps the rule and drops the wording — at 40px there
              is nowhere to put it, and the grouping still reads as grouping. */}
          {index > 0 &&
            (collapsed ? (
              <hr className="my-2 border-border" />
            ) : (
              <p className="mt-3 px-3 pb-1 text-body-small-bold uppercase tracking-wide text-muted-foreground">
                {t(group.id)}
              </p>
            ))}

          {group.sections.map((section) => {
            const active = isSectionActive(section.href, pathname);
            const label = t(section.labelKey);

            return (
              <Link
                key={section.href}
                href={section.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 text-body-small-emphasis transition-colors",
                  focusRing,
                  collapsed
                    ? "size-11 shrink-0 self-center justify-center rounded-xl p-0"
                    : "rounded-xl px-3 py-2",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-surface-sunken hover:text-foreground",
                )}
              >
                <Icon icon={section.icon} size="sm" />
                <span className={cn(collapsed && "sr-only")}>{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
