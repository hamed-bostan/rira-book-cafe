import { CalendarClock, ClipboardList, Coffee, History, LayoutDashboard, PartyPopper, ShieldCheck, Tag } from "lucide-react";

import type { Permission } from "@/src/domain/entities/Permission";

import type { LucideIcon } from "lucide-react";

/**
 * The dashboard's navigation, as data.
 *
 * Both renderings of the nav — the desktop rail and the mobile drawer — read this
 * one table, so a section can't appear in one and be missing from the other.
 *
 * Sections are grouped by *what the reader is doing*, not by which table they hit
 * (e.g. catalog = "what we sell", sales = "what happened today", store = the cafe's
 * own configuration). Add a section here when its page ships.
 */

/** A navigation group's stable id, which is also its label key under `dashboard`. */
export type DashboardSectionGroup = "groupOverview" | "groupService" | "groupMenu" | "groupStore";

/** A section's label key under the `dashboard` namespace — spelled out so `t()` can check it. */
export type DashboardSectionLabelKey =
  | "navDashboard"
  | "navOrders"
  | "navReservations"
  | "navEvents"
  | "navProducts"
  | "navCategories"
  | "navActivity"
  | "navTeam";

export type DashboardSection = {
  href: string;
  labelKey: DashboardSectionLabelKey;
  icon: LucideIcon;
  /** The permission that makes the section worth offering. */
  needs: Permission;
  group: DashboardSectionGroup;
};

const SECTIONS = [
  { href: "/dashboard", labelKey: "navDashboard", icon: LayoutDashboard, needs: "dashboard.view", group: "groupOverview" },

  // The live queue. Reading it is for everyone with the dashboard; moving orders is
  // `orders.fulfill`, gated inside the page.
  { href: "/dashboard/orders", labelKey: "navOrders", icon: ClipboardList, needs: "dashboard.view", group: "groupService" },
  // The day's bookings — readable by everyone on the floor; acting on them is
  // `reservations.manage`, gated inside the page.
  { href: "/dashboard/reservations", labelKey: "navReservations", icon: CalendarClock, needs: "dashboard.view", group: "groupService" },
  { href: "/dashboard/events", labelKey: "navEvents", icon: PartyPopper, needs: "dashboard.view", group: "groupService" },

  // The menu list is a read for everyone with the dashboard — it's how staff answer
  // "do we still have this?". The write controls inside it are gated on `catalog.write`.
  { href: "/dashboard/products", labelKey: "navProducts", icon: Coffee, needs: "dashboard.view", group: "groupMenu" },
  { href: "/dashboard/categories", labelKey: "navCategories", icon: Tag, needs: "catalog.write", group: "groupMenu" },

  // The cafe's own record of itself. Activity is visible to everyone holding
  // `activity.view` (team-access entries stay owner-only, see `activity-visibility`);
  // Team is the owner's alone.
  { href: "/dashboard/activity", labelKey: "navActivity", icon: History, needs: "activity.view", group: "groupStore" },
  { href: "/dashboard/team", labelKey: "navTeam", icon: ShieldCheck, needs: "team.manage", group: "groupStore" },
] as const satisfies readonly DashboardSection[];

/** The groups in sidebar order. */
const GROUP_ORDER: readonly DashboardSectionGroup[] = ["groupOverview", "groupService", "groupMenu", "groupStore"];

export type DashboardNavGroup = {
  id: DashboardSectionGroup;
  sections: readonly DashboardSection[];
};

/**
 * The groups a viewer may actually use, with empty ones dropped so no divider is
 * drawn around nothing.
 *
 * Navigation only — every page and endpoint re-checks independently. Hiding a link
 * keeps someone from walking into a redirect; it isn't what stops them.
 */
export function navGroupsFor(permissions: readonly Permission[]): DashboardNavGroup[] {
  return GROUP_ORDER.map((id) => ({
    id,
    sections: SECTIONS.filter((section) => section.group === id && permissions.includes(section.needs)),
  })).filter((group) => group.sections.length > 0);
}

/**
 * Whether a section owns the current path. The overview root matches only its
 * exact path; every other section owns its subtree (e.g. `/dashboard/menu/123/edit`).
 */
export function isSectionActive(href: string, pathname: string): boolean {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
}
