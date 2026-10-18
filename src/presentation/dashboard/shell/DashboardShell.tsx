"use client";

import * as React from "react";

import type { Permission } from "@/src/domain/entities/Permission";

import { BottomNav } from "./BottomNav";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardTopBar } from "./DashboardTopBar";
import { NavDrawer } from "./NavDrawer";
import { SIDEBAR_COLLAPSED_COOKIE_MAX_AGE, SIDEBAR_COLLAPSED_COOKIE_NAME } from "./sidebarCollapseCookie";

import type { DashboardViewer } from "./viewer";
import type { ReactNode } from "react";

type DashboardShellProps = {
  permissions: readonly Permission[];
  viewer: DashboardViewer;
  /** The desktop rail's collapsed/expanded choice, read from its cookie in the layout so the first paint already matches. */
  initialSidebarCollapsed: boolean;
  children: ReactNode;
};

/**
 * The dashboard's chrome: the desktop rail, the top bar, the mobile nav
 * drawer, and the mobile bottom tab bar, wrapped around the page body. Owns
 * the state the chrome needs — whether the drawer is open, and whether the
 * `xl`+ rail is collapsed — so the top bar's hamburger, the bottom bar's
 * `More` tab, and the rail's own toggle all agree with what's drawn.
 */
export function DashboardShell({ permissions, viewer, initialSidebarCollapsed, children }: DashboardShellProps) {
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

  return (
    <div className="flex min-h-dvh bg-surface xl:bg-background dashboard-landscape:bg-background dashboard-short:bg-background">
      <DashboardSidebar
        permissions={permissions}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopBar viewer={viewer} onOpenNav={() => setNavOpen(true)} />
        {/* Extra bottom padding below `md` clears the fixed BottomNav — without
            it the tab bar covers whatever the page renders last. */}
        <main className="mx-auto w-full max-w-[40.75rem] min-w-0 flex-1 border-x border-border bg-background px-6 pt-7 pb-28 sm:pt-8 xl:max-w-none xl:border-x-0 xl:px-6 xl:pt-6 xl:pb-6 dashboard-landscape:max-w-none dashboard-landscape:border-x-0 dashboard-landscape:px-6 dashboard-landscape:pt-6 dashboard-landscape:pb-6 dashboard-short:max-w-none dashboard-short:border-x-0 dashboard-short:px-5 dashboard-short:pt-5 dashboard-short:pb-6 dashboard-phone:px-4 dashboard-phone:pt-5 dashboard-phone:pb-20">
          {children}
        </main>
      </div>

      <NavDrawer open={navOpen} onOpenChange={setNavOpen} permissions={permissions} />
      <BottomNav onOpenMore={() => setNavOpen(true)} />
    </div>
  );
}
