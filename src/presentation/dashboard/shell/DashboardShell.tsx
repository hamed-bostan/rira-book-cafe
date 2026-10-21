"use client";

import * as React from "react";

import type { Permission } from "@/src/domain/entities/Permission";
import type { ThemeName } from "@/src/presentation/design-system/tokens/semantic/themes";

import { BottomNav } from "./BottomNav";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardTopBar } from "./DashboardTopBar";
import { NavDrawer } from "./NavDrawer";
import { SIDEBAR_COLLAPSED_COOKIE_MAX_AGE, SIDEBAR_COLLAPSED_COOKIE_NAME } from "./sidebarCollapseCookie";

import type { NewOrderNotice } from "./NotificationsMenu";
import type { DashboardNavBadges } from "./sections";
import type { DashboardViewer } from "./viewer";
import type { ReactNode } from "react";

/** The design-token theme every dashboard page renders in (see `themes.ts`). */
const DASHBOARD_THEME: ThemeName = "admin";

type DashboardShellProps = {
  permissions: readonly Permission[];
  viewer: DashboardViewer;
  /** The desktop rail's collapsed/expanded choice, read from its cookie in the layout so the first paint already matches. */
  initialSidebarCollapsed: boolean;
  /** Counts beside nav links (the order queue); fetched with the layout. */
  navBadges?: DashboardNavBadges;
  /** Orders waiting to be picked up, for the bell; `null` when they couldn't be read. */
  newOrders: NewOrderNotice[] | null;
  children: ReactNode;
};

/**
 * The dashboard's chrome: the desktop rail, the top bar, the mobile nav
 * drawer, and the mobile bottom tab bar, wrapped around the page body. Owns
 * the state the chrome needs — whether the drawer is open, and whether the
 * `xl`+ rail is collapsed — so the top bar's hamburger, the bottom bar's
 * `More` tab, and the rail's own toggle all agree with what's drawn.
 */
export function DashboardShell({
  permissions,
  viewer,
  initialSidebarCollapsed,
  navBadges,
  newOrders,
  children,
}: DashboardShellProps) {
  const [navOpen, setNavOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(initialSidebarCollapsed);

  function toggleSidebarCollapsed(): void {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      // No reload needed — unlike the locale cookie, this only ever changes a
      // client-side layout choice, not anything the server rendered.
      document.cookie = `${SIDEBAR_COLLAPSED_COOKIE_NAME}=${next ? "1" : "0"}; path=/; max-age=${SIDEBAR_COLLAPSED_COOKIE_MAX_AGE}; samesite=lax`;
      return next;
    });
  }

  // Menus, popovers, sheets and toasts portal to <body>, outside this tree, so the
  // theme goes on <html> too. The attribute below covers the server render, so the
  // first paint is already themed; the portals only open after this has run.
  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = DASHBOARD_THEME;
    return () => {
      delete root.dataset.theme;
    };
  }, []);

  return (
    <div data-theme={DASHBOARD_THEME} className="flex min-h-dvh bg-canvas text-foreground">
      <DashboardSidebar
        permissions={permissions}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        badges={navBadges}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopBar
          viewer={viewer}
          permissions={permissions}
          newOrders={newOrders}
          onOpenNav={() => setNavOpen(true)}
        />
        {/* Extra bottom padding below `md` clears the fixed BottomNav — without
            it the tab bar covers whatever the page renders last. */}
        <main className="mx-auto w-full max-w-[40.75rem] min-w-0 flex-1 border-x border-border bg-canvas px-4 pt-7 pb-28 sm:px-6 sm:pt-8 lg:px-8 xl:max-w-none xl:border-x-0 xl:pt-8 xl:pb-16 dashboard-landscape:max-w-none dashboard-landscape:border-x-0 dashboard-landscape:pt-6 dashboard-landscape:pb-6 dashboard-short:max-w-none dashboard-short:border-x-0 dashboard-short:pt-5 dashboard-short:pb-6 dashboard-phone:pt-5 dashboard-phone:pb-20">
          {children}
        </main>
      </div>

      <NavDrawer open={navOpen} onOpenChange={setNavOpen} permissions={permissions} badges={navBadges} />
      <BottomNav onOpenMore={() => setNavOpen(true)} />
    </div>
  );
}
