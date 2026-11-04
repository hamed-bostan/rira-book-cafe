import { ValidationError } from "../errors/ValidationError";

import {
  ALWAYS_GRANTED_PERMISSIONS,
  OWNER_ONLY_PERMISSIONS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  isPermission,
  type Permission,
} from "./Permission";
import { isBuiltInRole, type CustomRoleKey, type GrantableBuiltInRole, type UserRole } from "./User";

/**
 * A dashboard role as the owner manages it: which permissions it carries and, for
 * one the owner made, what it's called.
 *
 * The built-in roles (support, staff, admin) are named by the app's own catalog in
 * each language, so their `name` is `null`; a custom role carries its own name in
 * both. The owner role never appears here — it always holds every permission and
 * can't be edited — and neither does customer, which holds none.
 */
export type RoleDefinition = {
  key: GrantableBuiltInRole | CustomRoleKey;
  builtIn: boolean;
  name: RoleName | null;
  /** In {@link PERMISSIONS} order, `dashboard.view` always included. */
  permissions: Permission[];
};

/** A custom role's name in both of the app's languages. */
export type RoleName = { en: string; fa: string };

/** Longest role name accepted, in either language. */
export const MAX_ROLE_NAME_LENGTH = 40;

/** How many custom roles a cafe may define — a backstop, not a product limit anyone should meet. */
export const MAX_CUSTOM_ROLES = 30;

/**
 * Tidy a permission set for storage: known permissions only, each once, in the
 * catalog's order, with the always-granted ones added.
 *
 * Refuses an owner-only permission rather than quietly dropping it: a request
 * asking to give `team.manage` to a role is either a bug or an attempt, and either
 * way the caller should hear no (see `OWNER_ONLY_PERMISSIONS` for why).
 */
export function normalizeRolePermissions(requested: readonly string[]): Permission[] {
  const asked = new Set(requested);
  for (const permission of OWNER_ONLY_PERMISSIONS) {
    if (asked.has(permission)) {
      throw new ValidationError("permissions", "Only the owner can manage the team.");
    }
  }
  for (const value of asked) {
    if (!isPermission(value)) throw new ValidationError("permissions", `Unknown permission: ${value}.`);
  }
  for (const permission of ALWAYS_GRANTED_PERMISSIONS) asked.add(permission);
  return PERMISSIONS.filter((permission) => asked.has(permission));
}

/** Trim and check a custom role's name in both languages. */
export function normalizeRoleName(name: RoleName): RoleName {
  const en = name.en.trim();
  const fa = name.fa.trim();
  if (!en) throw new ValidationError("nameEn", "Enter the role's name.");
  if (!fa) throw new ValidationError("nameFa", "Enter the role's name.");
  if (en.length > MAX_ROLE_NAME_LENGTH) throw new ValidationError("nameEn", "That name is too long.");
  if (fa.length > MAX_ROLE_NAME_LENGTH) throw new ValidationError("nameFa", "That name is too long.");
  return { en, fa };
}

/** How a role's permissions read in an activity entry: "a, b, c" — stable, so two saves compare equal. */
export function permissionsActivityValue(permissions: readonly Permission[]): string {
  return permissions.join(", ");
}

/**
 * The live answer to "what may this role do?", built from the stored roles.
 *
 * - `owner` holds every permission, always — it is not stored and not editable.
 * - `customer` holds none.
 * - A built-in role uses its stored set, or its {@link ROLE_PERMISSIONS} default
 *   when it has no row (a database the seed didn't reach): day one stays day one.
 * - A custom role uses its stored set; one that no longer exists holds nothing.
 *
 * Immutable and cheap to query, so a snapshot can be cached and shared between
 * requests (see the role repository) and replaced whole when a role changes.
 */
export class RolePolicy {
  private readonly byRole: ReadonlyMap<string, readonly Permission[]>;

  constructor(definitions: readonly RoleDefinition[]) {
    const byRole = new Map<string, readonly Permission[]>();
    for (const definition of definitions) {
      // A stored row can't widen a role past what a non-owner may hold, whatever
      // reached the table: the owner-only permissions are stripped on the way in.
      byRole.set(
        definition.key,
        definition.permissions.filter(
          (permission) => !(OWNER_ONLY_PERMISSIONS as readonly Permission[]).includes(permission),
        ),
      );
    }
    this.byRole = byRole;
  }

  /** The policy with nothing stored: every built-in role at its default. */
  static defaults(): RolePolicy {
    return new RolePolicy([]);
  }

  permissionsOf(role: UserRole): readonly Permission[] {
    if (role === "owner") return PERMISSIONS;
    if (role === "customer") return [];
    const stored = this.byRole.get(role);
    if (stored) return stored;
    return isBuiltInRole(role) ? ROLE_PERMISSIONS[role] : [];
  }

  has(role: UserRole, permission: Permission): boolean {
    return this.permissionsOf(role).includes(permission);
  }
}
