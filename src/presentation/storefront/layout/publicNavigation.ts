import { CalendarClock, Coffee, Home, PartyPopper, UserRound } from "lucide-react";

import type { LucideIcon } from "lucide-react";

/** Label keys under the `site.nav` namespace. */
export type PublicNavKey = "home" | "menu" | "book" | "events" | "account";

export type PublicNavItem = { href: string; key: PublicNavKey; icon: LucideIcon };

/** The public site's sections — the header on wide screens, the bottom bar on phones. */
export const PUBLIC_NAV: readonly PublicNavItem[] = [
  { href: "/", key: "home", icon: Home },
  { href: "/menu", key: "menu", icon: Coffee },
  { href: "/book", key: "book", icon: CalendarClock },
  { href: "/events", key: "events", icon: PartyPopper },
  { href: "/account", key: "account", icon: UserRound },
];

/** Whether a nav item owns the path; home only matches itself, the rest their subtree. */
export function isPublicNavActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/account") {
    return ["/account", "/orders", "/reservations"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
