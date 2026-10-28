"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";

import type { Permission } from "@/src/domain/entities/Permission";
import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { BrandMark } from "./BrandMark";
import { DashboardBreadcrumb } from "./DashboardBreadcrumb";
import { HIDDEN_IN_FULL_SCREEN } from "./fullScreen";
import { NotificationsMenu, type NewOrderNotice } from "./NotificationsMenu";
import { UserMenu } from "./UserMenu";

import type { DashboardViewer } from "./viewer";

type DashboardTopBarProps = {
  viewer: DashboardViewer;
  permissions: readonly Permission[];
  /** Orders waiting to be picked up, for the bell; `null` when they couldn't be read. */
  newOrders: NewOrderNotice[] | null;
  /** Opens the mobile nav drawer — only the hamburger on short landscape viewports needs this. */
  onOpenNav: () => void;
};

/**
 * Persistent chrome above every dashboard page: the brand (where the rail is
 * hidden) or the breadcrumb (where it isn't), the nav trigger, the notifications
 * bell, and the account menu.
 */
export function DashboardTopBar({ viewer, permissions, newOrders, onOpenNav }: DashboardTopBarProps) {
  const t = useTranslations("dashboard");

  return (
    <header
      className={cn(
        "sticky top-0 z-30 mx-auto flex h-[5.625rem] w-full max-w-[40.75rem] items-center gap-2 border-x border-b border-border bg-background px-4 sm:px-6 lg:px-8 xl:h-16 xl:max-w-none xl:border-x-0 dashboard-landscape:h-16 dashboard-landscape:max-w-none dashboard-landscape:border-x-0 dashboard-short:h-16 dashboard-short:max-w-none dashboard-short:border-x-0 dashboard-phone:h-16",
        HIDDEN_IN_FULL_SCREEN,
      )}
    >
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

      <DashboardBreadcrumb permissions={permissions} className="hidden xl:block dashboard-landscape:block" />

      <div className="flex-1" />

      {newOrders ? <NotificationsMenu orders={newOrders} /> : null}
      <UserMenu viewer={viewer} />
    </header>
  );
}
