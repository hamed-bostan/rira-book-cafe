"use client";

import { useTranslations } from "next-intl";

import type { Permission } from "@/src/domain/entities/Permission";
import { Link, usePathname } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";

import { useDashboardCrumb } from "./DashboardCrumbProvider";
import { isSectionActive, navGroupsFor } from "./sections";

type DashboardBreadcrumbProps = {
  permissions: readonly Permission[];
  className?: string;
};

/**
 * Where the reader is: the nav group, then the section ("Service / Orders"), read
 * from the same table as the sidebar so the two can't disagree. The group has no
 * page of its own, so it's a label rather than a link; the overview has no group.
 * A full page below a section adds its own name, and the section becomes the way
 * back ("Service / Orders / #229").
 */
export function DashboardBreadcrumb({ permissions, className }: DashboardBreadcrumbProps) {
  const t = useTranslations("dashboard");
  const pathname = usePathname();
  const { crumb } = useDashboardCrumb();

  // The most specific match wins: `/dashboard` is a prefix of every section.
  const match = navGroupsFor(permissions)
    .flatMap((group) => group.sections.map((section) => ({ group, section })))
    .filter(({ section }) => isSectionActive(section.href, pathname))
    .sort((a, b) => b.section.href.length - a.section.href.length)[0];

  if (!match) return null;

  return (
    <nav aria-label={t("breadcrumb")} className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-2 text-body-small whitespace-nowrap">
        {match.group.id !== "groupOverview" ? (
          <>
            <li className="text-muted-foreground">{t(match.group.id)}</li>
            <li aria-hidden className="text-border-strong">
              /
            </li>
          </>
        ) : null}
        {crumb ? (
          <>
            <li>
              <Link href={match.section.href} className="text-muted-foreground hover:text-foreground">
                {t(match.section.labelKey)}
              </Link>
            </li>
            <li aria-hidden className="text-border-strong">
              /
            </li>
            <li aria-current="page" className="truncate font-semibold text-foreground tabular-nums">
              <bdi>{crumb}</bdi>
            </li>
          </>
        ) : (
          <li aria-current="page" className="truncate font-semibold text-foreground">
            {t(match.section.labelKey)}
          </li>
        )}
      </ol>
    </nav>
  );
}
