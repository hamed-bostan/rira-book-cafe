import type { AuditHook } from "./AuditHook";
import type { Permission } from "../entities/Permission";
import type { RoleDefinition, RoleName, RolePolicy } from "../entities/Role";
import type { CustomRoleKey, GrantableBuiltInRole } from "../entities/User";

/** A custom role about to be created. Its key is the store's to generate. */
export type NewRole = {
  name: RoleName;
  permissions: Permission[];
};

/** What can change on a role. A built-in role's name is the app's, so only custom roles take one. */
export type RoleChanges = {
  name?: RoleName;
  permissions?: Permission[];
};

/**
 * The dashboard roles the owner manages, and the policy built from them.
 *
 * `policy()` is on every authorization path, so implementations cache it and drop
 * the cache whenever a write here changes a role — the next request sees the
 * change. Writes take an {@link AuditHook} that commits in the same transaction.
 */
export type IRoleRepository = {
  /** The editable built-in roles (stored or default) and every custom role, built-ins first. */
  list(): Promise<RoleDefinition[]>;
  get(key: GrantableBuiltInRole | CustomRoleKey): Promise<RoleDefinition | null>;
  /** The live policy every permission check asks. Cached; see above. */
  policy(): Promise<RolePolicy>;
  /** How many people hold each role, keyed by role. Roles nobody holds are absent. */
  memberCounts(): Promise<Record<string, number>>;
  create(input: NewRole, audit?: AuditHook<RoleDefinition>): Promise<RoleDefinition>;
  /** `NotFoundError` when it doesn't exist. */
  update(
    key: GrantableBuiltInRole | CustomRoleKey,
    changes: RoleChanges,
    audit?: AuditHook<RoleDefinition>,
  ): Promise<RoleDefinition>;
  /**
   * Delete a custom role. Refused with `ConflictError("ROLE_IN_USE")` while anyone
   * holds it — checked in the same transaction as the delete, so a grant can't
   * slip in between. `NotFoundError` when it doesn't exist.
   */
  delete(key: CustomRoleKey, audit?: AuditHook<RoleDefinition>): Promise<void>;
};
