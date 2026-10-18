"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { BrandMark } from "./BrandMark";
import { UserMenu } from "./UserMenu";

import type { DashboardViewer } from "./viewer";

type DashboardTopBarProps = {
  viewer: DashboardViewer;
  /** Opens the mobile nav drawer — only the hamburger on short landscape viewports needs this. */
  onOpenNav: () => void;
};

/**
 * Persistent chrome above every dashboard page: the brand (where the rail is
 * hidden), the nav trigger, and the account menu. Global search and the
 * notification bell slot in here once those features exist.
 */
export function DashboardTopBar({ viewer, onOpenNav }: DashboardTopBarProps) {
  const t = useTranslations("dashboard");

  return (
    <header className="sticky top-0 z-30 mx-auto flex h-[5.625rem] w-full max-w-[40.75rem] items-center gap-2 border-x border-b border-border bg-background px-6 xl:h-16 xl:max-w-none xl:border-x-0 dashboard-landscape:h-16 dashboard-landscape:max-w-none dashboard-landscape:border-x-0 dashboard-short:h-16 dashboard-short:max-w-none dashboard-short:border-x-0 dashboard-short:px-5 dashboard-phone:h-16 dashboard-phone:px-4">
      <Link
        href="/dashboard"
        className="flex shrink-0 items-center gap-2 text-heading-subsection text-foreground xl:hidden dashboard-landscape:hidden"
      >
        <BrandMark />
        <span>{t("brand")}</span>
      </Link>

      <Button
        variant="ghost"
        iconOnly
        size="sm"
        aria-label={t("openNav")}
        onClick={onOpenNav}
        className="hidden size-11 dashboard-short:inline-flex"
      >
        <Icon icon={Menu} size="sm" />
      </Button>

      <div className="flex-1" />

      <UserMenu viewer={viewer} />
    </header>
  );
}
