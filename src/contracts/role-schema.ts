import { OWNER_ONLY_PERMISSIONS, PERMISSIONS, type Permission } from "@/src/domain/entities/Permission";
import { MAX_ROLE_NAME_LENGTH } from "@/src/domain/entities/Role";
import * as z from "@/src/lib/zod";

/**
 * The owner's role editor, shared by its form and the roles route (which re-checks
 * it). Messages are `formErrors` keys, translated at display time.
 *
 * Only the permissions a non-owner role may hold are accepted: `team.manage` moves
 * with ownership and is never a box on the checklist (see `OWNER_ONLY_PERMISSIONS`).
 * The domain refuses it too; refusing it here as well keeps a tampered request
 * from even reaching the use-case.
 */
export const ASSIGNABLE_PERMISSIONS = PERMISSIONS.filter(
  (permission) => !(OWNER_ONLY_PERMISSIONS as readonly Permission[]).includes(permission),
) as Exclude<Permission, (typeof OWNER_ONLY_PERMISSIONS)[number]>[];

const roleName = z
  .string()
  .check(z.trim(), z.minLength(1, "roleNameRequired"), z.maxLength(MAX_ROLE_NAME_LENGTH, "roleNameTooLong"));

const permissionList = z.array(z.enum(ASSIGNABLE_PERMISSIONS as [Permission, ...Permission[]]));

/** A new custom role: its name in both languages, and what it may do. */
export const createRoleSchema = z.object({
  nameEn: roleName,
  nameFa: roleName,
  permissions: permissionList,
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

/**
 * Changing a role. A built-in role takes only `permissions` (its name is the
 * app's); a custom one may take its names too. Both names travel together.
 */
export const updateRoleSchema = z.object({
  nameEn: z.optional(roleName),
  nameFa: z.optional(roleName),
  permissions: z.optional(permissionList),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
