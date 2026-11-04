import { z } from "zod/mini";

import { PERMISSIONS, type Permission } from "@/src/domain/entities/Permission";
import { isCustomRoleKey, type CustomRoleKey, type GrantableBuiltInRole } from "@/src/domain/entities/User";

/**
 * What the team-security endpoints promise, as the client receives them: roles,
 * the team's settings and signed-in sessions. Only the frontend reads these shapes;
 * the routes build them from the domain.
 */

const roleKey = z.custom<GrantableBuiltInRole | CustomRoleKey>(
  (value) =>
    value === "support" ||
    value === "staff" ||
    value === "admin" ||
    (typeof value === "string" && isCustomRoleKey(value)),
);

export const roleResponseSchema = z.object({
  key: roleKey,
  builtIn: z.boolean(),
  name: z.nullable(z.object({ en: z.string(), fa: z.string() })),
  permissions: z.array(z.enum(PERMISSIONS as unknown as [Permission, ...Permission[]])),
  memberCount: z.number(),
});

export const roleListResponseSchema = z.array(roleResponseSchema);

/** One role on the roles tab. */
export type RoleWire = z.infer<typeof roleResponseSchema>;

export const teamSettingsResponseSchema = z.object({
  activityRetentionMonths: z.nullable(z.number()),
});

export type TeamSettingsWire = z.infer<typeof teamSettingsResponseSchema>;

export const sessionResponseSchema = z.object({
  id: z.string(),
  device: z.object({
    browser: z.nullable(z.string()),
    os: z.nullable(z.string()),
    kind: z.enum(["mobile", "tablet", "desktop", "unknown"]),
  }),
  signedInAt: z.string(),
  lastSeenAt: z.string(),
  current: z.boolean(),
});

export const sessionListResponseSchema = z.array(sessionResponseSchema);

/** One signed-in browser. */
export type SessionWire = z.infer<typeof sessionResponseSchema>;
