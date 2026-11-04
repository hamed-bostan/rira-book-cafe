import { diffFields, type ActivityActor, type NewActivityEntry } from "../../entities/ActivityEntry";
import {
  MAX_CUSTOM_ROLES,
  normalizeRoleName,
  normalizeRolePermissions,
  permissionsActivityValue,
  type RoleDefinition,
  type RoleName,
} from "../../entities/Role";
import { isCustomRoleKey, type CustomRoleKey, type GrantableBuiltInRole } from "../../entities/User";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { IRoleRepository } from "../../repositories/IRoleRepository";

/**
 * The owner's role editor: the built-in support/staff/admin roles' permissions,
 * and roles of their own making.
 *
 * Every change is an activity entry under the team's access (`user`, owner-only),
 * committed with the change. What the entry snapshots is what a reader needs years
 * later without the role still existing: its name in both languages and the
 * permission list before and after.
 */

/** Every role the owner can manage, with how many people hold each. */
export type RoleSummary = RoleDefinition & { memberCount: number };

export class ListRoles {
  constructor(private readonly roles: IRoleRepository) {}

  async execute(): Promise<RoleSummary[]> {
    const [definitions, counts] = await Promise.all([this.roles.list(), this.roles.memberCounts()]);
    return definitions.map((definition) => ({ ...definition, memberCount: counts[definition.key] ?? 0 }));
  }
}

/** How a role reads in the log: a built-in one by its key (the UI names it), a custom one by both its names. */
export function roleEntityLabel(role: Pick<RoleDefinition, "key" | "name">): string {
  return role.name ? `${role.name.en} / ${role.name.fa}` : role.key;
}

/** The flat snapshot a role's diff is built from. */
function roleSnapshot(role: Pick<RoleDefinition, "name" | "permissions">): Record<string, unknown> {
  return {
    nameEn: role.name?.en,
    nameFa: role.name?.fa,
    permissions: permissionsActivityValue(role.permissions),
  };
}

function roleEntry(
  actor: ActivityActor,
  action: "user.roleCreated" | "user.roleUpdated" | "user.roleDeleted",
  role: RoleDefinition,
  changes: NewActivityEntry["changes"],
): NewActivityEntry {
  return {
    actorId: actor.id,
    actorName: actor.name,
    action,
    entityType: "user",
    entityId: role.key,
    entityLabel: roleEntityLabel(role),
    changes,
  };
}

export class CreateRole {
  constructor(private readonly roles: IRoleRepository) {}

  async execute(
    input: { name: RoleName; permissions: readonly string[] },
    actor: ActivityActor,
  ): Promise<RoleDefinition> {
    const name = normalizeRoleName(input.name);
    const permissions = normalizeRolePermissions(input.permissions);

    const existing = await this.roles.list();
    const custom = existing.filter((role) => !role.builtIn);
    if (custom.length >= MAX_CUSTOM_ROLES) {
      throw new ValidationError("nameEn", `A cafe can have at most ${MAX_CUSTOM_ROLES} roles of its own.`);
    }
    refuseDuplicateName(existing, name);

    return this.roles.create({ name, permissions }, (created) =>
      roleEntry(actor, "user.roleCreated", created, diffFields({}, roleSnapshot(created))),
    );
  }
}

export class UpdateRole {
  constructor(private readonly roles: IRoleRepository) {}

  /**
   * Change a role's permissions, and — for a custom role — its name. A built-in
   * role's name belongs to the app and is refused here. Saving what's already
   * stored changes nothing and records nothing.
   */
  async execute(
    key: GrantableBuiltInRole | CustomRoleKey,
    input: { name?: RoleName; permissions?: readonly string[] },
    actor: ActivityActor,
  ): Promise<RoleDefinition> {
    const current = await this.roles.get(key);
    if (!current) throw new NotFoundError("role", key);
    if (input.name && current.builtIn) {
      throw new ValidationError("nameEn", "A built-in role keeps its name.");
    }

    const name = input.name ? normalizeRoleName(input.name) : undefined;
    const permissions = input.permissions ? normalizeRolePermissions(input.permissions) : undefined;
    if (name)
      refuseDuplicateName(
        (await this.roles.list()).filter((role) => role.key !== key),
        name,
      );

    const next: RoleDefinition = {
      ...current,
      ...(name ? { name } : {}),
      ...(permissions ? { permissions } : {}),
    };
    const changes = diffFields(roleSnapshot(current), roleSnapshot(next));
    if (changes.length === 0) return current;

    return this.roles.update(key, { ...(name ? { name } : {}), ...(permissions ? { permissions } : {}) }, (updated) =>
      roleEntry(actor, "user.roleUpdated", updated, diffFields(roleSnapshot(current), roleSnapshot(updated))),
    );
  }
}

export class DeleteRole {
  constructor(private readonly roles: IRoleRepository) {}

  /**
   * Delete a custom role. Built-in roles can't be deleted (the app's own screens
   * and copy name them); a role someone still holds is refused with `ROLE_IN_USE`
   * — move them to another role first, so nobody silently loses their access.
   */
  async execute(key: string, actor: ActivityActor): Promise<void> {
    if (!isCustomRoleKey(key)) throw new ConflictError("ROLE_BUILT_IN", "Built-in roles can't be deleted.");
    const current = await this.roles.get(key);
    if (!current) throw new NotFoundError("role", key);

    await this.roles.delete(key, (deleted) =>
      roleEntry(
        actor,
        "user.roleDeleted",
        deleted,
        // Every field to "not set", so the entry keeps what the role was.
        diffFields(roleSnapshot(deleted), { nameEn: undefined, nameFa: undefined, permissions: undefined }),
      ),
    );
  }
}

/** Two roles with one name would be two rows on the team page nobody could tell apart. */
function refuseDuplicateName(roles: readonly RoleDefinition[], name: RoleName): void {
  const same = (a: string, b: string): boolean => a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;
  for (const role of roles) {
    if (!role.name) continue;
    if (same(role.name.en, name.en))
      throw new ConflictError("ROLE_NAME_TAKEN", "A role already has that name.", { fields: ["nameEn"] });
    if (same(role.name.fa, name.fa))
      throw new ConflictError("ROLE_NAME_TAKEN", "A role already has that name.", { fields: ["nameFa"] });
  }
}
