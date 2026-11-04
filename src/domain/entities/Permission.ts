import type { BuiltInRole } from "./User";

/**
 * What a dashboard user is allowed to *do*, as opposed to what they are called.
 *
 * Guards ask "may this session do X?", never "is this an admin?". A route asking
 * about a *role* has to be revisited every time the set of roles changes; a route
 * asking about a permission never does — which is what lets the owner edit roles
 * and add their own from the team page without any route changing.
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
  /** Confirm, seat and close table reservations and suite stays — a floor job, so staff hold it. */
  "reservations.manage",
  /** Lend books from the shelf and close loans (returned, lost) — a floor job, so staff hold it. */
  "loans.manage",
  /** Create and change events (book clubs, readings) and manage their sign-ups. */
  "events.manage",
  /** Read revenue and the sales, payment and guest reports. Admin and owner. */
  "reports.view",
  /** Read the activity log. */
  "activity.view",
  /** Grant and revoke dashboard access, and transfer ownership. Owner only. */
  "team.manage",
  /** Change cafe-wide configuration (tax, opening hours, …). Admin and owner. */
  "settings.write",
  /** Read the books: journal, accounts, statements, expenses. Admin and owner. */
  "accounting.view",
  /**
   * Write to the books: record and pay expenses, post and reverse manual entries,
   * manage accounts and suppliers, set the VAT rate and close periods. Admin and owner.
   */
  "accounting.write",
  /**
   * See and change who's paid what, and run payroll. Its own permission because pay
   * per person is more private than the books, which only ever show a month's total.
   */
  "payroll.manage",
  /** See stock levels and record waste — a floor job, so staff hold it. */
  "inventory.view",
  /** Receive deliveries, count stock, record opening stock and set reorder levels. Admin and owner. */
  "inventory.manage",
  /** Open and close till shifts (count the drawer) — a floor job, so staff hold it. */
  "shifts.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** True when the value is a permission this build knows. */
export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Permissions only the owner holds, and that no other role can be given.
 *
 * `team.manage` decides who holds every *other* permission. Handing it to a second
 * role would make that role an owner in all but name — able to edit its own
 * permission set, give itself the rest, and remove the person who granted it —
 * which is exactly the symmetry the owner tier exists to prevent. So it isn't a
 * box on the checklist: it moves only with ownership (`TransferOwnership`).
 */
export const OWNER_ONLY_PERMISSIONS = ["team.manage"] as const satisfies readonly Permission[];

/**
 * Permissions every team role holds, ticked and locked on the checklist. A role
 * without `dashboard.view` would be a team role that can't reach the team's tool —
 * and "every role but customer is a dashboard role" (`isDashboardRole`) is what
 * lets the team rules be checked without reading the role table.
 */
export const ALWAYS_GRANTED_PERMISSIONS = ["dashboard.view"] as const satisfies readonly Permission[];

/**
 * The permission checklist, grouped by the part of the cafe each one is about.
 * Every permission appears exactly once (a test holds it to that), in the order the
 * checklist shows it. The plain-language descriptions are the UI's, per locale.
 */
export const PERMISSION_GROUPS = [
  { key: "general", permissions: ["dashboard.view", "activity.view"] },
  { key: "orders", permissions: ["orders.fulfill", "orders.note"] },
  { key: "floor", permissions: ["reservations.manage", "loans.manage", "events.manage", "shifts.manage"] },
  { key: "menu", permissions: ["catalog.write", "reviews.moderate", "promotions.write"] },
  { key: "stock", permissions: ["inventory.view", "inventory.manage"] },
  { key: "money", permissions: ["reports.view", "accounting.view", "accounting.write", "payroll.manage"] },
  { key: "admin", permissions: ["settings.write", "team.manage"] },
] as const satisfies readonly { key: string; permissions: readonly Permission[] }[];

export type PermissionGroupKey = (typeof PERMISSION_GROUPS)[number]["key"];

/**
 * What each built-in role may do *by default* — the day-one policy, and what the
 * migration seeded the editable roles with. The live policy is `RolePolicy`
 * (`Role.ts`), built from the stored roles with this as the fallback for a built-in
 * role that has no row.
 *
 * - `owner` is `admin` plus team management — the tier that keeps admin power from
 *   being symmetric, so that no admin can demote all the others.
 * - `staff` is the floor/barista role: moving orders, nothing about what the cafe
 *   sells or what it charges.
 * - `support` reads; the only thing they can write is an internal order note.
 * - `customer` holds nothing — the public site needs no permission, and this table
 *   is only consulted for the dashboard.
 */
export const ROLE_PERMISSIONS: Record<BuiltInRole, readonly Permission[]> = {
  customer: [],
  support: ["dashboard.view", "orders.note", "activity.view"],
  staff: [
    "dashboard.view",
    "orders.fulfill",
    "orders.note",
    "reservations.manage",
    "loans.manage",
    "activity.view",
    "inventory.view",
    "shifts.manage",
  ],
  admin: [
    "dashboard.view",
    "orders.fulfill",
    "orders.note",
    "catalog.write",
    "reviews.moderate",
    "promotions.write",
    "reservations.manage",
    "loans.manage",
    "events.manage",
    "reports.view",
    "activity.view",
    "settings.write",
    "accounting.view",
    "accounting.write",
    "payroll.manage",
    "inventory.view",
    "inventory.manage",
    "shifts.manage",
  ],
  owner: [
    "dashboard.view",
    "orders.fulfill",
    "orders.note",
    "catalog.write",
    "reviews.moderate",
    "promotions.write",
    "reservations.manage",
    "loans.manage",
    "events.manage",
    "reports.view",
    "activity.view",
    "team.manage",
    "settings.write",
    "accounting.view",
    "accounting.write",
    "payroll.manage",
    "inventory.view",
    "inventory.manage",
    "shifts.manage",
  ],
};
