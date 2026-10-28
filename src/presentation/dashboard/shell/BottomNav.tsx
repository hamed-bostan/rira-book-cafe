"use client";

import { ClipboardList, Coffee, LayoutDashboard, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { HIDDEN_IN_FULL_SCREEN } from "./fullScreen";
import { isSectionActive } from "./sections";

import type { LucideIcon } from "lucide-react";

type BottomNavItem = {
  href: string;
  /** Label key under `dashboard.bottomNav`. */
  labelKey: "dashboard" | "orders" | "products";
  icon: LucideIcon;
};

/**
 * The sections a mobile viewer reaches for most (at most four), fixed rather than
 * driven by `sections.ts`: the rail's full, permission-filtered list belongs in the
 * drawer (the `More` tab opens it), not spread across cramped icons. Only list
 * sections every `dashboard.view` holder can open, so there is no permission check
 * to thread through here.
 */
const ITEMS: readonly BottomNavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/dashboard/orders", labelKey: "orders", icon: ClipboardList },
  { href: "/dashboard/products", labelKey: "products", icon: Coffee },
];

type BottomNavProps = {
  /** Opens the same nav drawer the top bar's hamburger does — the `More` tab's whole list. */
  onOpenMore: () => void;
};

/**
 * Thumb-reach tab bar for phone-width viewports: the sections used every day sit
 * one tap away instead of two (open drawer, then pick). It supplements the drawer
 * rather than replacing it — `More` opens the exact same `NavDrawer` the top bar's
 * hamburger does, so the full, permission-filtered section list still lives in one
 * place.
 *
 * Hidden at the breakpoint the persistent rail takes over at, so exactly one of the
 * two navigations is ever on screen.
 */
export function BottomNav({ onOpenMore }: BottomNavProps) {
  const t = useTranslations("dashboard.bottomNav");
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[40.75rem] items-stretch justify-around border-x border-t border-border bg-background xl:hidden dashboard-landscape:hidden dashboard-short:hidden",
        "pb-[env(safe-area-inset-bottom)]",
        HIDDEN_IN_FULL_SCREEN,
      )}
    >
      {ITEMS.map((item) => {
        const active = isSectionActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              focusRing,
              "flex flex-1 flex-col items-center gap-1 pt-7 pb-4 text-body-caption-emphasis transition-colors dashboard-phone:pt-3 dashboard-phone:pb-2",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon icon={item.icon} size="sm" />
            {t(item.labelKey)}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={onOpenMore}
        aria-label={t("moreAria")}
        className={cn(
          focusRing,
          "flex flex-1 flex-col items-center gap-1 pt-7 pb-4 text-body-caption-emphasis text-muted-foreground transition-colors hover:text-foreground dashboard-phone:pt-3 dashboard-phone:pb-2",
        )}
      >
        <Icon icon={MoreHorizontal} size="sm" />
        {t("more")}
      </button>
    </nav>
  );
}
