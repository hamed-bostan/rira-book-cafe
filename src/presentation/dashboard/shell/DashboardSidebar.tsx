"use client";

import type { Permission } from "@/src/domain/entities/Permission";
import { cn } from "@/src/lib/utils";

import { DashboardNav } from "./DashboardNav";
import { SidebarBrand } from "./SidebarBrand";
import { SidebarCollapseToggle } from "./SidebarCollapseToggle";
import { ViewStoreLink } from "./ViewStoreLink";

type DashboardSidebarProps = {
  /** What the viewer may do — decides which sections are offered. */
  permissions: readonly Permission[];
  /** Whether the `xl`+ rail is showing its icon-only ("tablet") look. */
  collapsed: boolean;
  /** Flips `collapsed` — the toggle only appears at `xl`+, next to the brand. */
  onToggleCollapsed: () => void;
};

/**
 * Persistent left rail for `md` and up (below that, `NavDrawer` takes over).
 *
 * Two independent things decide how narrow it is:
 *  - Between `md` and `xl` it's *always* the icon-only rail — there just isn't
 *    room for labels yet, and that's a plain breakpoint with no state behind it.
 *  - At `xl`+ there's room for the full labelled rail, but a reader with a lot
 *    of screen may still prefer the narrow look, so `collapsed` (persisted via
 *    cookie, see `DashboardShell`) lets them choose it there too.
 *
 * Both looks render the same brand/nav/view-store pieces, so there is exactly
 * one source for the section list and its active state either way.
 */
export function DashboardSidebar({ permissions, collapsed, onToggleCollapsed }: DashboardSidebarProps) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh w-20 shrink-0 flex-col border-e border-border bg-background dashboard-landscape:flex xl:flex",
        collapsed ? "xl:w-20" : "xl:w-64",
      )}
    >
      {/* The `md`–`xl` tier: always the icon-only rail, no toggle — there's nowhere to put one. */}
      <div className="hidden h-full flex-col dashboard-landscape:flex">
        <SidebarBrand collapsed />
        <div className="flex-1 overflow-y-auto px-3 py-2 [scrollbar-gutter:stable_both-edges]">
          <DashboardNav permissions={permissions} collapsed />
        </div>
        <ViewStoreLink collapsed />
      </div>

      {/* The `xl`+ tier: follows `collapsed`, with the toggle that controls it. */}
      <div className="hidden xl:flex xl:h-full xl:flex-col">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <SidebarBrand collapsed />
            <SidebarCollapseToggle collapsed={collapsed} onToggle={onToggleCollapsed} className="mb-2" />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <SidebarBrand />
            <SidebarCollapseToggle collapsed={collapsed} onToggle={onToggleCollapsed} className="me-3" />
          </div>
        )}

        <div
          className={cn(
            "flex-1 overflow-y-auto px-3 py-2",
            collapsed && "[scrollbar-gutter:stable_both-edges]",
          )}
        >
          <DashboardNav permissions={permissions} collapsed={collapsed} />
        </div>

        <ViewStoreLink collapsed={collapsed} />
      </div>
    </aside>
  );
}
