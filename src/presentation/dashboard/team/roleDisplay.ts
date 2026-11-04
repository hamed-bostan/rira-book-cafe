import type { RoleName } from "@/src/domain/entities/Role";
import { isBuiltInRole, type BuiltInRole, type GrantableRole, type UserRole } from "@/src/domain/entities/User";

/** Custom roles' names, keyed by role key — what screens that show roles are handed. */
export type RoleNames = Readonly<Record<string, RoleName>>;

/** A role on offer in a grant or role-change picker, already named in the reader's language. */
export type RoleOption = { value: GrantableRole; label: string };

/** Custom roles' names out of the roles list, for the screens that name roles. */
export function roleNamesOf(roles: readonly { key: string; name: RoleName | null }[]): RoleNames {
  return Object.fromEntries(roles.flatMap((role) => (role.name ? [[role.key, role.name] as const] : [])));
}

export type RoleBadgeVariant = "warning" | "success" | "info" | "neutral" | "primary";

/** Warmer as a built-in role gets more powerful; custom roles share one tone of their own. */
const BUILT_IN_VARIANT: Record<BuiltInRole, RoleBadgeVariant> = {
  owner: "warning",
  admin: "success",
  staff: "info",
  support: "neutral",
  customer: "neutral",
};

/** The badge tone for a role — the same role in the same colour wherever it's shown. */
export function roleBadgeVariant(role: UserRole): RoleBadgeVariant {
  return isBuiltInRole(role) ? BUILT_IN_VARIANT[role] : "primary";
}

/**
 * A role's name in the reader's language: the app's own word for a built-in role,
 * the owner's name for a custom one — or `fallback` for a custom role that has
 * since been deleted (an old activity entry, say).
 */
export function roleDisplayName(
  role: UserRole,
  options: {
    builtIn: (role: BuiltInRole) => string;
    names: RoleNames;
    locale: string;
    fallback: string;
  },
): string {
  if (isBuiltInRole(role)) return options.builtIn(role);
  const name = options.names[role];
  if (!name) return options.fallback;
  return options.locale === "fa" ? name.fa : name.en;
}
