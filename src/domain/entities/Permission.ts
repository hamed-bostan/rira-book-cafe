import type { UserRole } from "./User";

/**
 * What a dashboard user is allowed to *do*, as opposed to what they are called.
 *
 * Guards ask "may this session do X?", never "is this an admin?". A route asking
 * about a *role* has to be revisited every time the set of roles changes; a route
 * asking about a permission never does — adding a role is an edit to
 * `ROLE_PERMISSIONS` and nothing else.
 *
 * Granularity is set by the boundaries the app actually has — one permission per
 * group of endpoints that always travel together. Add a permission when a feature
 * introduces a boundary no existing one covers.
 */
export const PERMISSIONS = [
  /** Reach the dashboard at all, and read the lists inside it. Everyone with a dashboard role has this. */
  "dashboard.view",
  /** Move an order along (accept, prepare, serve/hand over, cancel). */
  "orders.fulfill",
  /** Write an internal note on an order — the one thing support can change. */
  "orders.note",
  /** Write to the menu and book catalog: items, prices, stock, categories, images. */
  "catalog.write",
  /** Approve or reject customer reviews. */
  "reviews.moderate",
  /** Create and change promo codes and other commercial levers. */
  "promotions.write",
  /** Confirm, seat and close table reservations — a floor job, so staff hold it. */
  "reservations.manage",
  /** Create and change events (book clubs, readings) and manage their sign-ups. */
  "events.manage",
  /** Read the activity log. */
  "activity.view",
  /** Grant and revoke dashboard access, and transfer ownership. Owner only. */
  "team.manage",
  /** Change cafe-wide configuration (tax, opening hours, …). Admin and owner. */
  "settings.write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * What each role may do. The whole authorization policy of the app, in one place.
 *
 * - `owner` is `admin` plus team management — the tier that keeps admin power from
 *   being symmetric, so that no admin can demote all the others.
 * - `staff` is the floor/barista role: moving orders, nothing about what the cafe
 *   sells or what it charges.
 * - `support` reads; the only thing they can write is an internal order note.
 * - `customer` holds nothing — the public site needs no permission, and this table
 *   is only consulted for the dashboard.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  customer: [],
  support: ["dashboard.view", "orders.note", "activity.view"],
  staff: ["dashboard.view", "orders.fulfill", "orders.note", "reservations.manage", "activity.view"],
  admin: [
    "dashboard.view",
    "orders.fulfill",
    "orders.note",
    "catalog.write",
    "reviews.moderate",
    "promotions.write",
    "reservations.manage",
    "events.manage",
    "activity.view",
    "settings.write",
  ],
  owner: [
    "dashboard.view",
    "orders.fulfill",
    "orders.note",
    "catalog.write",
    "reviews.moderate",
    "promotions.write",
    "reservations.manage",
    "events.manage",
    "activity.view",
    "team.manage",
    "settings.write",
  ],
};

/** Whether a role carries a permission. The single question every guard asks. */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
