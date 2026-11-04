/**
 * Who a user is. What they may *do* is decided by the role policy (`RolePolicy` in
 * `Role.ts`) — this union names the jobs, the policy defines them, and every guard
 * asks the policy.
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
 * - `custom:<id>` — a role the owner made, with its own name and permission set
 *   (see `Role.ts`). Always a dashboard role.
 *
 * The built-in roles start with the permissions in `ROLE_PERMISSIONS`; the owner
 * can edit support, staff and admin. The owner's own set is fixed: everything.
 */
export type BuiltInRole = "customer" | "support" | "staff" | "admin" | "owner";

/** A role the owner created. The suffix is generated, never typed by anyone. */
export type CustomRoleKey = `custom:${string}`;

export type UserRole = BuiltInRole | CustomRoleKey;

/**
 * The built-in role values, for validating a string read from the database.
 *
 * A `const` tuple rather than a widened `readonly UserRole[]` so it can also be
 * handed straight to `z.enum` at the API boundary — a widened array only types as
 * `string[]` there, which would parse any string as a role.
 */
export const USER_ROLES = ["customer", "support", "staff", "admin", "owner"] as const satisfies readonly BuiltInRole[];

/** What a custom role's key looks like: `custom:` and a generated lowercase id. */
const CUSTOM_ROLE_KEY = /^custom:[a-z0-9]{6,40}$/;

/** True when the value is a well-formed custom role key. */
export function isCustomRoleKey(value: string): value is CustomRoleKey {
  return CUSTOM_ROLE_KEY.test(value);
}

/** True when the role is one of the app's own, as opposed to one the owner created. */
export function isBuiltInRole(value: string): value is BuiltInRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

/**
 * True when the role grants dashboard access.
 *
 * Every role but `customer` does: `dashboard.view` is part of every team role and
 * can't be taken off one (see `normalizeRolePermissions`), so this needs no lookup
 * — which is what lets the team use-cases ask it without reading the role table.
 */
export function isDashboardRole(role: UserRole): boolean {
  return role !== "customer";
}

/**
 * The built-in roles the team page can hand out. Custom roles can be handed out
 * too (see {@link GrantableRole}).
 *
 * `owner` is excluded because there is exactly one and it moves by transfer, not
 * by grant (see `TransferOwnership`) — offering it here would be a second, quieter
 * path to the same thing, without the "you will no longer be the owner" the
 * transfer makes explicit. `customer` is excluded because removing access is
 * `RevokeAdmin`, not a grant of the lowest role.
 */
export const GRANTABLE_ROLES = ["support", "staff", "admin"] as const satisfies readonly BuiltInRole[];

/** The built-in roles whose permissions the owner may edit — the same three a grant can give. */
export const EDITABLE_BUILT_IN_ROLES = GRANTABLE_ROLES;

export type GrantableBuiltInRole = (typeof GRANTABLE_ROLES)[number];

/** A role the team page can give someone: a built-in team role, or a custom one. */
export type GrantableRole = GrantableBuiltInRole | CustomRoleKey;

/** True when the value names a role a grant or a role change may give (a custom one still has to exist). */
export function isGrantableRole(value: string): value is GrantableRole {
  return (GRANTABLE_ROLES as readonly string[]).includes(value) || isCustomRoleKey(value);
}

/**
 * Narrow an arbitrary stored string to a `UserRole`, defaulting to the least
 * privilege. A custom key narrows to itself whether or not the role still exists:
 * a role that's gone holds no permissions (see `RolePolicy`), the same
 * least-privilege answer.
 */
export function toUserRole(value: string): UserRole {
  if (isBuiltInRole(value) || isCustomRoleKey(value)) return value;
  return "customer";
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
  /**
   * ISO 8601: when the phone first signed in. Absent on a guest profile staff made
   * for a guest who hasn't signed in yet (see `GuestProfile.ts`).
   */
  firstSignedInAt?: string;
  /** The staff member who made the profile for a guest; absent for one made by signing in. */
  createdById?: string;
};
