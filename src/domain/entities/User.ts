// Value import, and the dependency only goes this way: `Permission.ts` imports
// `UserRole` as a *type*, which erases, so there is no runtime cycle.
import { roleHasPermission } from "./Permission";

/**
 * Who a user is. What they may *do* is {@link ROLE_PERMISSIONS} — this union names
 * the jobs, that table defines them, and every guard asks the table.
 *
 * - `customer` — the storefront only. Everyone starts here.
 * - `support` — reads the dashboard and answers questions about orders. The only
 *   thing they can change is an internal note.
 * - `staff` — fulfilment: moves orders along, resolves out-of-stock lines, handles
 *   returns. Can't touch the catalog, prices or the team.
 * - `admin` — runs the store: catalog, orders, reviews, promotions, customers.
 * - `owner` — an admin who also manages the team, and the one account no peer can
 *   remove. Exactly one exists. This is the tier that keeps admin power from
 *   being symmetric: without it, any admin could demote all the others.
 *
 * Ordered least to most privileged, and it's a real hierarchy — each role's
 * permissions are a superset of the one before it. Nothing in the code relies on
 * that ordering (the permission table is consulted directly, so a non-nested role
 * could be added without breaking anything), but it's what makes the ladder
 * explicable to the person assigning it.
 */
export type UserRole = "customer" | "support" | "staff" | "admin" | "owner";

/**
 * The persisted role values, for validating a string read from the database.
 *
 * A `const` tuple rather than a widened `readonly UserRole[]` so it can also be
 * handed straight to `z.enum` at the API boundary — a widened array only types as
 * `string[]` there, which would parse any string as a role.
 */
export const USER_ROLES = ["customer", "support", "staff", "admin", "owner"] as const satisfies readonly UserRole[];

/**
 * The roles that can reach the dashboard.
 *
 * Derived from the permission table rather than listed again, so a role added
 * there can't be forgotten here — the two disagreeing would mean a role that holds
 * permissions but can't get to the screen that uses them.
 */
export const DASHBOARD_ROLES: readonly UserRole[] = USER_ROLES.filter((role) =>
  roleHasPermission(role, "dashboard.view"),
);

/** True when the role grants dashboard access. */
export function isDashboardRole(role: UserRole): boolean {
  return roleHasPermission(role, "dashboard.view");
}

/**
 * The roles the team page can hand out.
 *
 * `owner` is excluded because there is exactly one and it moves by transfer, not
 * by grant (see `TransferOwnership`) — offering it here would be a second, quieter
 * path to the same thing, without the "you will no longer be the owner" the
 * transfer makes explicit. `customer` is excluded because removing access is
 * `RevokeAdmin`, not a grant of the lowest role.
 */
export const GRANTABLE_ROLES = ["support", "staff", "admin"] as const satisfies readonly UserRole[];

export type GrantableRole = (typeof GRANTABLE_ROLES)[number];

/** Narrow an arbitrary stored string to a `UserRole`, defaulting to the least privilege. */
export function toUserRole(value: string): UserRole {
  return USER_ROLES.includes(value as UserRole) ? (value as UserRole) : "customer";
}

/**
 * Stand-in name for a user whose row exists before they've ever signed in —
 * someone granted dashboard access ahead of their first login. Theirs to
 * overwrite once they complete their profile. Matches the placeholder OTP
 * sign-in seeds a brand-new user with, so both paths produce the same row.
 */
export const PLACEHOLDER_USER_NAME = "Rira Guest";

export type User = {
  /** Stable identifier — the user's normalized phone digits (also the session id). */
  id: string;
  /** The phone the user signed in with (display form, e.g. with country code). */
  phone: string;
  /** Display/full name. Falls back to a placeholder until the profile is completed. */
  name: string;
  /** Contact email, once provided. */
  email: string | null;
  /** Public URL of the profile picture, once uploaded. */
  avatarUrl: string | null;
  /** Access level. Everyone is a `"customer"` until an admin promotes them. */
  role: UserRole;
};
