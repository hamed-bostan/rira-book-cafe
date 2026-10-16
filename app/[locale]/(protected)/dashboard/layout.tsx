import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requirePermission, sessionPermissions } from "@/src/lib/require-permission";
import { DashboardShell } from "@/src/presentation/dashboard/shell/DashboardShell";
import { SIDEBAR_COLLAPSED_COOKIE_NAME } from "@/src/presentation/dashboard/shell/sidebarCollapseCookie";
import { dashboardViewerFor } from "@/src/presentation/dashboard/shell/viewer";

import type { ReactNode } from "react";

/**
 * Shell for the dashboard. Gates the whole `/dashboard` tree on `dashboard.view`,
 * which every dashboard role holds and no customer does; each page and endpoint
 * re-checks the *specific* permission it needs, so this is the door rather than the
 * whole lock. `DashboardShell` renders the persistent chrome (rail, top bar, mobile
 * drawer) around the section content — the storefront's mobile `max-w-md` lives in
 * `(main)`, not here.
 *
 * The viewer's permissions and display info are resolved once here and handed down,
 * so the sidebar, the drawer, and the top bar's user menu can't disagree. Hiding a
 * section nobody can use is presentation only — the routes are what actually stop
 * them, not the missing link.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requirePermission("dashboard.view");
  const viewer = await dashboardViewerFor();
  // The account backing an active session vanishing mid-request is not something
  // any page here can recover from — back to the door, same as no session at all.
  if (!viewer) redirect("/login");

  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COLLAPSED_COOKIE_NAME)?.value === "1";

  return (
    <DashboardShell
      permissions={await sessionPermissions(session)}
      viewer={viewer}
      initialSidebarCollapsed={sidebarCollapsed}
    >
      {children}
    </DashboardShell>
  );
}
